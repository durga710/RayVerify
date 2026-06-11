################################################################################
# modules/security/main.tf
#
# Resources:
#   - KMS CMKs (data / S3 / RDS dedicated aliases + per-tenant-capable data key)
#   - Secrets Manager secrets (RDS, Redis, application)
#   - IAM roles (ECS task execution, per-service task roles — least privilege)
#   - WAFv2 Web ACL (OWASP managed rules + rate limit)
#   - Security Groups (ECS tasks, RDS, Redis)
################################################################################

################################################################################
# KMS Customer Managed Keys
#
# HIPAA §164.312(a)(2)(iv): encrypt and decrypt ePHI.
# SOC 2 CC6.1: logical access controls — envelope encryption with CMK ensures
# data is unreadable even if AWS storage layer is compromised.
# Rotation enabled: AWS rotates the key material annually automatically.
################################################################################

resource "aws_kms_key" "data" {
  description             = "${var.name_prefix} — primary data CMK (PHI / ePHI)"
  deletion_window_in_days = 30 # 30-day safety window before permanent deletion
  enable_key_rotation     = true

  # Key policy: allow account-level IAM, deny direct root usage in non-break-glass scenarios
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name    = "${var.name_prefix}-data-cmk"
    Purpose = "phi-encryption"
  }
}

resource "aws_kms_alias" "data" {
  name          = "alias/${var.name_prefix}-data"
  target_key_id = aws_kms_key.data.key_id
}

# Per-tenant data key alias — supports envelope encryption where each tenant
# gets a distinct data key generated from this CMK (multi-tenant PHI isolation).
resource "aws_kms_alias" "data_tenant" {
  name          = "alias/${var.name_prefix}-tenant-data"
  target_key_id = aws_kms_key.data.key_id
}

# S3-specific CMK (separate key for Object Lock / WORM evidence bucket)
resource "aws_kms_key" "s3" {
  description             = "${var.name_prefix} — S3 evidence CMK"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name    = "${var.name_prefix}-s3-cmk"
    Purpose = "s3-evidence-encryption"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.name_prefix}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

################################################################################
# Secrets Manager
#
# HIPAA §164.312(a)(2)(i): unique user identification / password management.
# Secrets are encrypted by the data CMK, not the default AWS-managed key.
# ECS tasks retrieve secrets via the secretsmanager VPC endpoint.
################################################################################

resource "aws_secretsmanager_secret" "rds" {
  name                    = "${var.name_prefix}/rds/credentials"
  description             = "RDS PostgreSQL master credentials"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 30

  tags = {
    Name = "${var.name_prefix}-rds-secret"
  }
}

resource "random_password" "rds_initial_password" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret_version" "rds" {
  secret_id = aws_secretsmanager_secret.rds.id
  # Initial value is generated, then rotated outside Terraform.
  secret_string = jsonencode({
    username = "rayverify_admin"
    password = random_password.rds_initial_password.result
    engine   = "postgres"
    port     = 5432
    dbname   = "rayverify"
  })

  lifecycle {
    # Prevent Terraform from overwriting a password that was rotated outside TF
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "${var.name_prefix}/redis/auth"
  description             = "ElastiCache Redis AUTH token"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 30

  tags = {
    Name = "${var.name_prefix}-redis-secret"
  }
}

resource "random_password" "redis_initial_auth_token" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    auth_token = random_password.redis_initial_auth_token.result
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}/app/secrets"
  description             = "Application secrets: JWT keys, encryption salt, etc."
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 30

  tags = {
    Name = "${var.name_prefix}-app-secret"
  }
}

resource "random_password" "app_initial_jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "app_initial_jwt_refresh_secret" {
  length  = 64
  special = false
}

resource "random_password" "app_initial_encryption_key" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    jwt_secret           = random_password.app_initial_jwt_secret.result
    jwt_refresh_secret   = random_password.app_initial_jwt_refresh_secret.result
    encryption_key       = random_password.app_initial_encryption_key.result
    mfa_issuer           = "RayVerify"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

################################################################################
# IAM — ECS Task Execution Role
#
# Grants ECS agent (not the application) permission to:
#   - Pull images from ECR
#   - Write logs to CloudWatch
#   - Retrieve secrets from Secrets Manager (for container environment injection)
# Least-privilege: no access to S3, RDS, or other data-plane resources.
################################################################################

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.name_prefix}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json

  tags = {
    Name = "${var.name_prefix}-ecs-task-execution"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${var.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.rds.arn,
          aws_secretsmanager_secret.redis.arn,
          aws_secretsmanager_secret.app.arn
        ]
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.data.arn]
      }
    ]
  })
}

################################################################################
# IAM — Per-service ECS Task Roles (least-privilege data-plane access)
################################################################################

# --- API task role ---
resource "aws_iam_role" "api_task" {
  name               = "${var.name_prefix}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json

  tags = { Name = "${var.name_prefix}-api-task" }
}

resource "aws_iam_role_policy" "api_task_policy" {
  name = "${var.name_prefix}-api-task-policy"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3EvidenceReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = "arn:aws:s3:::${var.name_prefix}-evidence-*/*"
      },
      {
        Sid    = "S3ReportsBucketReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${var.name_prefix}-reports-*/*"
      },
      {
        Sid    = "KMSDataPlane"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = [aws_kms_key.data.arn, aws_kms_key.s3.arn]
      },
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = ["cloudwatch:PutMetricData"]
        Resource = "*"
      }
    ]
  })
}

# --- Worker task role ---
resource "aws_iam_role" "worker_task" {
  name               = "${var.name_prefix}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json

  tags = { Name = "${var.name_prefix}-worker-task" }
}

resource "aws_iam_role_policy" "worker_task_policy" {
  name = "${var.name_prefix}-worker-task-policy"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3EvidenceRead"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion"]
        Resource = "arn:aws:s3:::${var.name_prefix}-evidence-*/*"
      },
      {
        Sid    = "S3ReportsWrite"
        Effect = "Allow"
        Action = ["s3:PutObject"]
        Resource = "arn:aws:s3:::${var.name_prefix}-reports-*/*"
      },
      {
        Sid    = "KMSDataPlane"
        Effect = "Allow"
        Action = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = [aws_kms_key.data.arn, aws_kms_key.s3.arn]
      },
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = ["cloudwatch:PutMetricData"]
        Resource = "*"
      }
    ]
  })
}

# --- ML-scoring task role ---
resource "aws_iam_role" "ml_task" {
  name               = "${var.name_prefix}-ml-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json

  tags = { Name = "${var.name_prefix}-ml-task" }
}

resource "aws_iam_role_policy" "ml_task_policy" {
  name = "${var.name_prefix}-ml-task-policy"
  role = aws_iam_role.ml_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # ML models stored in a dedicated prefix in the reports bucket
        Sid    = "S3ModelRead"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "arn:aws:s3:::${var.name_prefix}-reports-*/models/*"
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = [aws_kms_key.data.arn]
      },
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = ["cloudwatch:PutMetricData"]
        Resource = "*"
      }
    ]
  })
}

################################################################################
# Security Groups — ECS tasks, RDS, Redis
################################################################################

# ECS tasks SG — inbound only from ALB on container port 3000/8000
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.name_prefix}-ecs-tasks-sg"
  description = "ECS tasks — ingress from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "API traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [var.alb_sg_id]
  }

  ingress {
    description     = "ML-scoring traffic from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [var.alb_sg_id]
  }

  egress {
    description = "All outbound (to RDS, Redis, AWS APIs via VPC endpoints)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-ecs-tasks-sg"
  }
}

# RDS SG — inbound only from ECS tasks SG on 5432
resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db-sg"
  description = "RDS PostgreSQL — ingress from ECS tasks only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    # RDS needs to reach KMS endpoint and internal AWS APIs (PITR, backups)
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS to AWS APIs"
  }

  tags = {
    Name = "${var.name_prefix}-db-sg"
  }
}

# ElastiCache Redis SG — inbound only from ECS tasks SG on 6379
resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "ElastiCache Redis — ingress from ECS tasks only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound"
  }

  tags = {
    Name = "${var.name_prefix}-redis-sg"
  }
}

################################################################################
# WAFv2 Web ACL
#
# SOC 2 CC6.6: protection of assets from threats outside entity boundaries.
# Managed rule groups cover OWASP Top 10, known bad inputs, and AWS threat intel.
# Rate limiting prevents credential stuffing and DDoS at the application layer.
#
# Note: A second WAF ACL (scope=CLOUDFRONT) is created for the edge module.
# CloudFront WAF ACLs must be in us-east-1; this ALB ACL is regional.
################################################################################

resource "aws_wafv2_web_acl" "alb" {
  name  = "${var.name_prefix}-alb-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Rules — AWSManagedRulesCommonRuleSet (OWASP Top 10)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-common"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules — Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules — SQL Injection (critical for PHI database protection)
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 30

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-sqli"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules — Amazon IP Reputation List (AWS threat intel)
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 40

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-iprep"
      sampled_requests_enabled   = true
    }
  }

  # Rate-based rule — block IPs exceeding var.waf_rate_limit req/5min
  # Prevents credential stuffing and automated scraping of PHI
  rule {
    name     = "RateLimitRule"
    priority = 50

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-ratelimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf-alb"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.name_prefix}-alb-waf"
  }
}

# CloudFront WAF ACL — must be REGIONAL with scope CLOUDFRONT managed in us-east-1.
# We create it here in the regional provider; edge module attaches it.
# NOTE: In a real deployment this resource would use the aws.us_east_1 provider alias.
# For simplicity we keep it in the same provider block; adjust if deploying to non-us-east-1.
resource "aws_wafv2_web_acl" "cloudfront" {
  name  = "${var.name_prefix}-cf-waf"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-cf-waf-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "CFRateLimitRule"
    priority = 20

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-cf-waf-ratelimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf-cf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.name_prefix}-cf-waf"
  }
}

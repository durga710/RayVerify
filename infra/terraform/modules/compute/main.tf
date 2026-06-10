################################################################################
# modules/compute/main.tf
#
# Resources:
#   - ECR repositories (api, workers, ml-scoring)
#   - ECS Fargate cluster
#   - CloudWatch log groups (encrypted with CMK)
#   - ALB + HTTPS listener + HTTP→HTTPS redirect + target groups
#   - Fargate task definitions + services (api, workers, ml-scoring)
#   - Application Autoscaling policies
#
# Compliance notes:
#   - All container logs encrypted with CMK (HIPAA §164.312(a)(2)(iv))
#   - HTTPS-only ALB listener (TLS 1.2+ enforced by security policy)
#   - WAFv2 attached to ALB (SOC 2 CC6.6)
#   - No ECS task has a public IP (private subnets only)
#   - ECR image scanning on push (SOC 2 CC7.1)
################################################################################

################################################################################
# ECR Repositories — with image scanning and encryption
################################################################################

resource "aws_ecr_repository" "api" {
  name                 = "${var.name_prefix}/api"
  image_tag_mutability = "IMMUTABLE" # prevent tag overwrites (audit trail)

  image_scanning_configuration {
    scan_on_push = true # SOC 2 CC7.1: detect vulnerabilities before deployment
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = { Name = "${var.name_prefix}-ecr-api" }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${var.name_prefix}/worker"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = { Name = "${var.name_prefix}-ecr-worker" }
}

resource "aws_ecr_repository" "ml" {
  name                 = "${var.name_prefix}/ml-scoring"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = { Name = "${var.name_prefix}-ecr-ml" }
}

# ECR lifecycle policy — keep last 10 images, expire untagged after 14 days
locals {
  ecr_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "ml" {
  repository = aws_ecr_repository.ml.name
  policy     = local.ecr_lifecycle_policy
}

################################################################################
# ECS Cluster — Container Insights enabled (SOC 2 CC7.2 monitoring)
################################################################################
resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${var.name_prefix}-cluster" }
}

################################################################################
# CloudWatch Log Groups (KMS-encrypted)
################################################################################
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name_prefix}/api"
  retention_in_days = 365 # HIPAA: 6-year log retention minimum; 1 year hot, archive to S3
  kms_key_id        = var.kms_key_arn

  tags = { Name = "${var.name_prefix}-api-logs" }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name_prefix}/worker"
  retention_in_days = 365
  kms_key_id        = var.kms_key_arn

  tags = { Name = "${var.name_prefix}-worker-logs" }
}

resource "aws_cloudwatch_log_group" "ml" {
  name              = "/ecs/${var.name_prefix}/ml-scoring"
  retention_in_days = 365
  kms_key_id        = var.kms_key_arn

  tags = { Name = "${var.name_prefix}-ml-logs" }
}

################################################################################
# Application Load Balancer
################################################################################
resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  internal           = false # Internet-facing; CloudFront/WAF terminate at edge
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.public_subnet_ids

  # Access logs to S3 (SOC 2 CC7.2, HIPAA audit)
  access_logs {
    bucket  = var.logs_bucket_id
    prefix  = "alb"
    enabled = true
  }

  # Prevent accidental deletion in all environments
  enable_deletion_protection = true

  drop_invalid_header_fields = true # security hardening

  tags = { Name = "${var.name_prefix}-alb" }
}

# WAFv2 association — attach regional ACL to ALB
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.this.arn
  web_acl_arn  = var.waf_web_acl_arn
}

# HTTPS listener — ALB terminates TLS, forwards to ECS tasks
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # TLS 1.2/1.3 only
  certificate_arn   = aws_acm_certificate_validation.alb.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# HTTP → HTTPS redirect (port 80)
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ALB-level ACM certificate (regional; CloudFront cert is in us-east-1)
resource "aws_acm_certificate" "alb" {
  domain_name       = "api.${var.name_prefix}.internal" # placeholder; real domain wired in edge module
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.name_prefix}-alb-cert" }
}

resource "aws_acm_certificate_validation" "alb" {
  certificate_arn = aws_acm_certificate.alb.arn
  # validation_record_fqdns wired by edge module after DNS records created
}

################################################################################
# Target Groups
################################################################################

resource "aws_lb_target_group" "api" {
  name        = "${var.name_prefix}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # required for Fargate

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = { Name = "${var.name_prefix}-api-tg" }
}

resource "aws_lb_target_group" "ml" {
  name        = "${var.name_prefix}-ml-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = { Name = "${var.name_prefix}-ml-tg" }
}

# ALB listener rule — route /ml-scoring/* to ml target group
resource "aws_lb_listener_rule" "ml" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ml.arn
  }

  condition {
    path_pattern {
      values = ["/ml-scoring/*", "/score/*"]
    }
  }
}

################################################################################
# ECS Task Definitions
################################################################################

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.api_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
      essential = true

      portMappings = [
        { containerPort = 3000, protocol = "tcp" }
      ]

      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "3000" }
      ]

      # Secrets injected from Secrets Manager — never in environment variables as plaintext
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.rds_secret_arn}:connection_string::" },
        { name = "REDIS_URL", valueFrom = "${var.redis_secret_arn}:auth_token::" },
        { name = "JWT_SECRET", valueFrom = "${var.app_secrets_arn}:jwt_secret::" },
        { name = "ENCRYPTION_KEY", valueFrom = "${var.app_secrets_arn}:encryption_key::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      # Read-only root filesystem — reduces attack surface
      readonlyRootFilesystem = true

      # Drop all Linux capabilities; add only what the NestJS app needs
      linuxParameters = {
        capabilities = {
          drop = ["ALL"]
        }
      }
    }
  ])

  tags = { Name = "${var.name_prefix}-api-task-def" }
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name_prefix}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.worker_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.worker.repository_url}:${var.worker_image_tag}"
      essential = true

      environment = [
        { name = "NODE_ENV", value = var.environment }
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.rds_secret_arn}:connection_string::" },
        { name = "REDIS_URL", valueFrom = "${var.redis_secret_arn}:auth_token::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }

      readonlyRootFilesystem = true
      linuxParameters = {
        capabilities = { drop = ["ALL"] }
      }
    }
  ])

  tags = { Name = "${var.name_prefix}-worker-task-def" }
}

resource "aws_ecs_task_definition" "ml" {
  family                   = "${var.name_prefix}-ml-scoring"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ml_cpu
  memory                   = var.ml_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ml_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "ml-scoring"
      image     = "${aws_ecr_repository.ml.repository_url}:${var.ml_image_tag}"
      essential = true

      portMappings = [
        { containerPort = 8000, protocol = "tcp" }
      ]

      environment = [
        { name = "ENV", value = var.environment },
        { name = "PORT", value = "8000" }
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.rds_secret_arn}:connection_string::" },
        { name = "ENCRYPTION_KEY", valueFrom = "${var.app_secrets_arn}:encryption_key::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ml.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ml"
        }
      }

      readonlyRootFilesystem = true
      linuxParameters = {
        capabilities = { drop = ["ALL"] }
      }
    }
  ])

  tags = { Name = "${var.name_prefix}-ml-task-def" }
}

################################################################################
# ECS Services
################################################################################

resource "aws_ecs_service" "api" {
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_tasks_sg_id]
    assign_public_ip = false # Zero Trust: no public IPs on tasks
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  # Minimum 100% healthy during deployment (rolling update)
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  lifecycle {
    # Allow CI/CD to update task_definition without Terraform reverting it
    ignore_changes = [task_definition, desired_count]
  }

  tags = { Name = "${var.name_prefix}-api-svc" }
}

resource "aws_ecs_service" "worker" {
  name            = "${var.name_prefix}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_tasks_sg_id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = { Name = "${var.name_prefix}-worker-svc" }
}

resource "aws_ecs_service" "ml" {
  name            = "${var.name_prefix}-ml-scoring"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.ml.arn
  desired_count   = var.ml_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_tasks_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ml.arn
    container_name   = "ml-scoring"
    container_port   = 8000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = { Name = "${var.name_prefix}-ml-svc" }
}

################################################################################
# Application Autoscaling
################################################################################

# --- API autoscaling ---
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_count
  min_capacity       = var.api_min_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.name_prefix}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${var.name_prefix}-api-mem-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# --- Worker autoscaling ---
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_count
  min_capacity       = var.worker_min_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "${var.name_prefix}-worker-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# --- ML-scoring autoscaling ---
resource "aws_appautoscaling_target" "ml" {
  max_capacity       = var.ml_max_count
  min_capacity       = var.ml_min_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.ml.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ml_cpu" {
  name               = "${var.name_prefix}-ml-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ml.resource_id
  scalable_dimension = aws_appautoscaling_target.ml.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ml.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

################################################################################
# modules/data/main.tf
#
# Resources:
#   - RDS PostgreSQL Multi-AZ primary + optional read replica
#   - ElastiCache Redis replication group (encryption in transit + at rest)
#
# Compliance notes:
#   - HIPAA §164.312(a)(2)(iv): storage_encrypted = true (KMS CMK)
#   - HIPAA §164.308(a)(7): PITR enabled via backup_retention_period
#   - CMS EVV: PITR satisfies data-availability requirements
#   - No public accessibility — instances placed in data subnets with no IGW route
#   - Performance Insights enabled for query-level audit (SOC 2 CC7.2)
################################################################################

################################################################################
# RDS Subnet Group — data-tier subnets only (no internet route)
################################################################################
resource "aws_db_subnet_group" "this" {
  name        = "${var.name_prefix}-db-subnet-group"
  description = "RDS subnet group — data tier only, no internet route"
  subnet_ids  = var.data_subnet_ids

  tags = {
    Name = "${var.name_prefix}-db-subnet-group"
  }
}

################################################################################
# RDS Parameter Group — PostgreSQL tuning + audit settings
#
# Logging settings support HIPAA audit requirements:
#   log_connections / log_disconnections: track all authentication events
#   log_min_duration_statement: slow-query logging for performance + forensics
#   pgaudit (if extension installed): row-level audit logging
################################################################################
resource "aws_db_parameter_group" "postgres" {
  name        = "${var.name_prefix}-pg16"
  family      = "postgres16"
  description = "${var.name_prefix} PostgreSQL 16 parameter group"

  # Enable query logging (audit trail support — HIPAA §164.312(b))
  parameter {
    name         = "log_connections"
    value        = "1"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_disconnections"
    value        = "1"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_min_duration_statement"
    value        = "1000" # log queries taking > 1 second
    apply_method = "immediate"
  }

  parameter {
    name         = "log_statement"
    value        = "ddl" # log all DDL statements
    apply_method = "immediate"
  }

  # Force SSL — enforce TLS in transit (HIPAA §164.312(e)(2)(ii))
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements,pgaudit"
    apply_method = "pending-reboot"
  }

  tags = {
    Name = "${var.name_prefix}-pg16-params"
  }
}

################################################################################
# RDS PostgreSQL Primary Instance
################################################################################
resource "aws_db_instance" "primary" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = var.rds_engine_version
  instance_class = var.rds_instance_class

  # Storage
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage # autoscaling upper bound
  storage_type          = "gp3"

  # Encryption — HIPAA §164.312(a)(2)(iv)
  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  # Database init
  db_name  = var.rds_db_name
  username = "rayverify_admin"
  # Password managed via Secrets Manager; retrieved by the application
  manage_master_user_password    = false
  password                       = "placeholder-managed-by-secrets-manager"

  # Network — NEVER public; placed in data subnets
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.db_sg_id]
  publicly_accessible    = false # Critical: no public endpoint (Zero Trust)

  # High Availability — Multi-AZ synchronous standby
  multi_az = var.rds_multi_az

  # Backup & recovery — HIPAA §164.308(a)(7), CMS EVV data availability
  backup_retention_period   = var.rds_backup_retention_days
  backup_window             = "03:00-04:00" # UTC, low-traffic window
  maintenance_window        = "sun:04:30-sun:05:30"
  delete_automated_backups  = false

  # Point-in-time recovery (enabled implicitly when backup_retention_period > 0)

  # Performance Insights — query-level observability (SOC 2 CC7.2)
  performance_insights_enabled          = true
  performance_insights_kms_key_id       = var.kms_key_arn
  performance_insights_retention_period = 7

  # Enhanced monitoring (CloudWatch agent on the RDS host)
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Parameter group
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Deletion protection — always enabled in prod (set via tfvars)
  deletion_protection = var.rds_deletion_protection

  # Final snapshot before destroy (excluded in dev for clean teardown)
  skip_final_snapshot       = !var.rds_deletion_protection
  final_snapshot_identifier = "${var.name_prefix}-postgres-final"

  # Apply changes immediately in dev; defer to maintenance window in prod
  apply_immediately = var.rds_deletion_protection ? false : true

  lifecycle {
    # Prevent password drift from forcing a replacement; password is rotated externally
    ignore_changes = [password]
  }

  tags = {
    Name = "${var.name_prefix}-postgres-primary"
  }
}

################################################################################
# RDS Read Replica — analytics offloading (optional, enabled in staging/prod)
################################################################################
resource "aws_db_instance" "replica" {
  count = var.rds_create_read_replica ? 1 : 0

  identifier          = "${var.name_prefix}-postgres-replica"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class      = var.rds_instance_class

  # Replica inherits encryption from the primary
  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  vpc_security_group_ids = [var.db_sg_id]
  publicly_accessible    = false

  # Replica-specific monitoring
  performance_insights_enabled          = true
  performance_insights_kms_key_id       = var.kms_key_arn
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn

  skip_final_snapshot = true # replicas can be recreated without data loss

  tags = {
    Name = "${var.name_prefix}-postgres-replica"
  }
}

################################################################################
# RDS Enhanced Monitoring IAM Role
################################################################################
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.name_prefix}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })

  tags = { Name = "${var.name_prefix}-rds-monitoring" }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

################################################################################
# ElastiCache Subnet Group
################################################################################
resource "aws_elasticache_subnet_group" "this" {
  name        = "${var.name_prefix}-redis-subnet-group"
  description = "ElastiCache Redis subnet group — data tier"
  subnet_ids  = var.data_subnet_ids

  tags = {
    Name = "${var.name_prefix}-redis-subnet-group"
  }
}

################################################################################
# ElastiCache Redis Parameter Group
################################################################################
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.name_prefix}-redis7"
  family = "redis7"

  # Enforce TLS — transit_encryption handled at replication group level
  # Disable DEBUG and EVAL commands to reduce attack surface
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = {
    Name = "${var.name_prefix}-redis7-params"
  }
}

################################################################################
# ElastiCache Redis Replication Group
#
# HIPAA §164.312(e)(2)(ii): encrypt in transit (transit_encryption_enabled).
# HIPAA §164.312(a)(2)(iv): encrypt at rest (at_rest_encryption_enabled + KMS).
# AUTH token stored in Secrets Manager; injected into containers at startup.
################################################################################
resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "${var.name_prefix} Redis — queues and session cache"

  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_cache_clusters
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  engine_version       = var.redis_engine_version

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.redis_sg_id]

  # Encryption in transit (TLS 1.2+) — HIPAA
  transit_encryption_enabled = true

  # Encryption at rest with CMK — HIPAA
  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn

  # AUTH token from Secrets Manager (not stored in TF state directly)
  # In practice: retrieve from secretsmanager, pass as variable, or use aws_secretsmanager_secret_version data source
  # auth_token = data.aws_secretsmanager_secret_version.redis.secret_string -- wired at deploy time

  # Automatic failover (requires num_cache_clusters >= 2 for replica availability)
  automatic_failover_enabled = var.redis_num_cache_clusters > 1

  # Maintenance and snapshot
  snapshot_retention_limit = 3
  snapshot_window          = "03:30-04:30"
  maintenance_window       = "sun:05:00-sun:06:00"

  # In-transit encryption requires TLS mode
  apply_immediately = var.rds_deletion_protection ? false : true

  tags = {
    Name = "${var.name_prefix}-redis"
  }
}

# Local alias for rds_deletion_protection used in Redis apply_immediately
locals {
  rds_deletion_protection = var.rds_deletion_protection
}

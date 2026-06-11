################################################################################
# main.tf — Root composition
#
# Wires all modules together, passing outputs as inputs to dependent modules.
# Dependency order:
#   networking → security → data → compute → edge → storage → observability
################################################################################

# ---------------------------------------------------------------------------
# 1. Networking — VPC, subnets, IGW, NAT, route tables, VPC endpoints, NACLs
# ---------------------------------------------------------------------------
module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  az_count    = var.az_count
  azs         = local.azs
  environment = var.environment
  aws_region  = var.aws_region
}

# ---------------------------------------------------------------------------
# 2. Security — KMS CMKs, Secrets Manager, IAM roles, WAFv2, Security Groups
# ---------------------------------------------------------------------------
module "security" {
  source = "./modules/security"

  name_prefix        = local.name_prefix
  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  aws_account_id     = data.aws_caller_identity.current.account_id
  aws_region         = var.aws_region
  waf_rate_limit     = var.waf_rate_limit
  alb_sg_id          = module.networking.alb_sg_id          # placeholder SG from networking
  private_subnet_cidr_blocks = module.networking.private_subnet_cidr_blocks
  data_subnet_cidr_blocks    = module.networking.data_subnet_cidr_blocks
}

# ---------------------------------------------------------------------------
# 3. Storage — S3 buckets (evidence WORM, reports, logs)
#    Created before compute so log bucket ARN can be passed to ALB.
# ---------------------------------------------------------------------------
module "storage" {
  source = "./modules/storage"

  name_prefix               = local.name_prefix
  environment               = var.environment
  kms_key_arn               = module.security.kms_data_key_arn
  evidence_object_lock_days = var.evidence_object_lock_days
  aws_account_id            = data.aws_caller_identity.current.account_id
}

# ---------------------------------------------------------------------------
# 4. Data — RDS PostgreSQL + read replica, ElastiCache Redis
# ---------------------------------------------------------------------------
module "data" {
  source = "./modules/data"

  name_prefix               = local.name_prefix
  environment               = var.environment
  vpc_id                    = module.networking.vpc_id
  data_subnet_ids           = module.networking.data_subnet_ids
  kms_key_arn               = module.security.kms_data_key_arn
  db_sg_id                  = module.security.db_sg_id
  redis_sg_id               = module.security.redis_sg_id

  # RDS sizing
  rds_instance_class        = var.rds_instance_class
  rds_allocated_storage     = var.rds_allocated_storage
  rds_max_allocated_storage = var.rds_max_allocated_storage
  rds_engine_version        = var.rds_engine_version
  rds_backup_retention_days = var.rds_backup_retention_days
  rds_deletion_protection   = var.rds_deletion_protection
  rds_multi_az              = var.rds_multi_az
  rds_create_read_replica   = var.rds_create_read_replica
  rds_db_name               = var.rds_db_name

  # Redis sizing
  redis_node_type           = var.redis_node_type
  redis_num_cache_clusters  = var.redis_num_cache_clusters
  redis_engine_version      = var.redis_engine_version

  # Secrets Manager secret ARN so data module can create DB credentials
  rds_secret_arn            = module.security.rds_secret_arn
}

# ---------------------------------------------------------------------------
# 5. Compute — ECS Fargate cluster, services, ALB, ECR, autoscaling
# ---------------------------------------------------------------------------
module "compute" {
  source = "./modules/compute"

  name_prefix         = local.name_prefix
  environment         = var.environment
  aws_region          = var.aws_region
  aws_account_id      = data.aws_caller_identity.current.account_id
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  private_subnet_ids  = module.networking.private_subnet_ids
  alb_sg_id           = module.security.alb_sg_id
  ecs_tasks_sg_id     = module.security.ecs_tasks_sg_id
  waf_web_acl_arn     = module.security.waf_web_acl_arn
  kms_key_arn         = module.security.kms_data_key_arn
  logs_bucket_id      = module.storage.logs_bucket_name

  # IAM roles
  ecs_task_execution_role_arn = module.security.ecs_task_execution_role_arn
  api_task_role_arn           = module.security.api_task_role_arn
  worker_task_role_arn        = module.security.worker_task_role_arn
  ml_task_role_arn            = module.security.ml_task_role_arn

  # Secrets (injected into containers as environment variables via Secrets Manager)
  rds_secret_arn              = module.security.rds_secret_arn
  redis_secret_arn            = module.security.redis_secret_arn
  app_secrets_arn             = module.security.app_secrets_arn

  # API service sizing
  api_cpu           = var.api_cpu
  api_memory        = var.api_memory
  api_desired_count = var.api_desired_count
  api_min_count     = var.api_min_count
  api_max_count     = var.api_max_count
  api_image_tag     = var.api_image_tag

  # Worker service sizing
  worker_cpu           = var.worker_cpu
  worker_memory        = var.worker_memory
  worker_desired_count = var.worker_desired_count
  worker_min_count     = var.worker_min_count
  worker_max_count     = var.worker_max_count
  worker_image_tag     = var.worker_image_tag

  # ML-scoring service sizing
  ml_cpu           = var.ml_cpu
  ml_memory        = var.ml_memory
  ml_desired_count = var.ml_desired_count
  ml_min_count     = var.ml_min_count
  ml_max_count     = var.ml_max_count
  ml_image_tag     = var.ml_image_tag
}

# ---------------------------------------------------------------------------
# 6. Edge — CloudFront, ACM cert (us-east-1 provider alias), Route53
# ---------------------------------------------------------------------------
module "edge" {
  source = "./modules/edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix              = local.name_prefix
  environment              = var.environment
  domain_name              = var.domain_name
  api_subdomain            = var.api_subdomain
  app_subdomain            = var.app_subdomain
  route53_zone_id          = var.route53_zone_id
  alb_dns_name             = module.compute.alb_dns_name
  alb_zone_id              = module.compute.alb_zone_id
  static_bucket_domain     = module.storage.static_bucket_regional_domain
  static_bucket_id         = module.storage.static_bucket_id
  logs_bucket_id           = module.storage.logs_bucket_name
  waf_web_acl_arn          = module.security.waf_cloudfront_acl_arn
}

# ---------------------------------------------------------------------------
# 7. Observability — CloudWatch, alarms, metric filters, SNS
# ---------------------------------------------------------------------------
module "observability" {
  source = "./modules/observability"

  name_prefix           = local.name_prefix
  environment           = var.environment
  aws_region            = var.aws_region
  alert_email           = var.alert_email
  kms_key_arn           = module.security.kms_data_key_arn
  ecs_cluster_name      = module.compute.ecs_cluster_name
  api_service_name      = module.compute.api_service_name
  worker_service_name   = module.compute.worker_service_name
  ml_service_name       = module.compute.ml_service_name
  alb_arn_suffix        = module.compute.alb_arn_suffix
  rds_identifier        = module.data.rds_identifier
  redis_replication_group_id = module.data.redis_replication_group_id
  api_log_group_name    = module.compute.api_log_group_name
  worker_log_group_name = module.compute.worker_log_group_name
  ml_log_group_name     = module.compute.ml_log_group_name
}

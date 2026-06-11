################################################################################
# outputs.tf — Root outputs
#
# Exposed to CI/CD pipelines and the deployment runbook for post-apply wiring.
################################################################################

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID."
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (ECS tasks, Lambda)."
  value       = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALB, NAT GW)."
  value       = module.networking.public_subnet_ids
}

output "data_subnet_ids" {
  description = "Data subnet IDs (RDS, ElastiCache — no route to IGW)."
  value       = module.networking.data_subnet_ids
}

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

output "kms_data_key_arn" {
  description = "ARN of the primary data KMS CMK (PHI encryption)."
  value       = module.security.kms_data_key_arn
}

output "kms_data_key_alias" {
  description = "KMS CMK alias for the data key."
  value       = module.security.kms_data_key_alias
}

output "waf_web_acl_arn" {
  description = "WAFv2 Web ACL ARN (attached to ALB)."
  value       = module.security.waf_web_acl_arn
}

# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS primary cluster writer endpoint."
  value       = module.data.rds_endpoint
  sensitive   = true
}

output "rds_read_replica_endpoint" {
  description = "RDS read-replica endpoint (empty string if not created)."
  value       = module.data.rds_read_replica_endpoint
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint."
  value       = module.data.redis_primary_endpoint
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------

output "ecr_api_repository_url" {
  description = "ECR repository URL for the API service."
  value       = module.compute.ecr_api_repository_url
}

output "ecr_worker_repository_url" {
  description = "ECR repository URL for the worker service."
  value       = module.compute.ecr_worker_repository_url
}

output "ecr_ml_repository_url" {
  description = "ECR repository URL for the ml-scoring service."
  value       = module.compute.ecr_ml_repository_url
}

output "alb_dns_name" {
  description = "ALB DNS name (before Route53 alias)."
  value       = module.compute.alb_dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.compute.ecs_cluster_name
}

# ---------------------------------------------------------------------------
# Edge
# ---------------------------------------------------------------------------

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = module.edge.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidations in CI/CD)."
  value       = module.edge.cloudfront_distribution_id
}

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

output "evidence_bucket_name" {
  description = "S3 evidence bucket name (WORM / Object Lock)."
  value       = module.storage.evidence_bucket_name
}

output "reports_bucket_name" {
  description = "S3 reports bucket name."
  value       = module.storage.reports_bucket_name
}

output "logs_bucket_name" {
  description = "S3 access-logs bucket name."
  value       = module.storage.logs_bucket_name
}

# ---------------------------------------------------------------------------
# Observability
# ---------------------------------------------------------------------------

output "sns_alert_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms."
  value       = module.observability.sns_alert_topic_arn
}

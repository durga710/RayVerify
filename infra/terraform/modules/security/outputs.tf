output "kms_data_key_arn" {
  description = "Primary data CMK ARN."
  value       = aws_kms_key.data.arn
}

output "kms_data_key_id" {
  description = "Primary data CMK key ID."
  value       = aws_kms_key.data.key_id
}

output "kms_data_key_alias" {
  description = "Primary data CMK alias name."
  value       = aws_kms_alias.data.name
}

output "kms_s3_key_arn" {
  description = "S3 evidence CMK ARN."
  value       = aws_kms_key.s3.arn
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN for RDS credentials."
  value       = aws_secretsmanager_secret.rds.arn
}

output "redis_secret_arn" {
  description = "Secrets Manager ARN for Redis AUTH token."
  value       = aws_secretsmanager_secret.redis.arn
}

output "app_secrets_arn" {
  description = "Secrets Manager ARN for application secrets."
  value       = aws_secretsmanager_secret.app.arn
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution IAM role ARN."
  value       = aws_iam_role.ecs_task_execution.arn
}

output "api_task_role_arn" {
  description = "ECS task role ARN for the API service."
  value       = aws_iam_role.api_task.arn
}

output "worker_task_role_arn" {
  description = "ECS task role ARN for the worker service."
  value       = aws_iam_role.worker_task.arn
}

output "ml_task_role_arn" {
  description = "ECS task role ARN for the ml-scoring service."
  value       = aws_iam_role.ml_task.arn
}

output "waf_web_acl_arn" {
  description = "WAFv2 regional Web ACL ARN (attached to ALB)."
  value       = aws_wafv2_web_acl.alb.arn
}

output "waf_cloudfront_acl_arn" {
  description = "WAFv2 CLOUDFRONT-scoped Web ACL ARN (attached to CloudFront)."
  value       = aws_wafv2_web_acl.cloudfront.arn
}

output "alb_sg_id" {
  description = "ALB security group ID (passed through from networking module)."
  value       = var.alb_sg_id
}

output "ecs_tasks_sg_id" {
  description = "ECS tasks security group ID."
  value       = aws_security_group.ecs_tasks.id
}

output "db_sg_id" {
  description = "RDS security group ID."
  value       = aws_security_group.db.id
}

output "redis_sg_id" {
  description = "ElastiCache Redis security group ID."
  value       = aws_security_group.redis.id
}

variable "name_prefix" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications."
  type        = string
}
variable "kms_key_arn" {
  description = "KMS CMK ARN for SNS topic encryption."
  type        = string
}
variable "ecs_cluster_name" { type = string }
variable "api_service_name" { type = string }
variable "worker_service_name" { type = string }
variable "ml_service_name" { type = string }
variable "alb_arn_suffix" { type = string }
variable "rds_identifier" { type = string }
variable "redis_replication_group_id" { type = string }
variable "api_log_group_name" { type = string }
variable "worker_log_group_name" { type = string }
variable "ml_log_group_name" { type = string }

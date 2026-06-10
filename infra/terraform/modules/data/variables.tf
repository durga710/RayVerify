variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "data_subnet_ids" {
  description = "Subnet IDs for the data tier (RDS + ElastiCache)."
  type        = list(string)
}

variable "kms_key_arn" {
  description = "KMS CMK ARN for RDS storage and Redis encryption."
  type        = string
}

variable "db_sg_id" {
  description = "Security group ID for the RDS instance."
  type        = string
}

variable "redis_sg_id" {
  description = "Security group ID for the ElastiCache cluster."
  type        = string
}

variable "rds_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "rds_allocated_storage" {
  type    = number
  default = 100
}

variable "rds_max_allocated_storage" {
  type    = number
  default = 500
}

variable "rds_engine_version" {
  type    = string
  default = "16.3"
}

variable "rds_backup_retention_days" {
  type    = number
  default = 7
}

variable "rds_deletion_protection" {
  type    = bool
  default = false
}

variable "rds_multi_az" {
  type    = bool
  default = false
}

variable "rds_create_read_replica" {
  type    = bool
  default = false
}

variable "rds_db_name" {
  type    = string
  default = "rayverify"
}

variable "rds_secret_arn" {
  description = "Secrets Manager secret ARN with DB credentials."
  type        = string
}

variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

variable "redis_num_cache_clusters" {
  type    = number
  default = 1
}

variable "redis_engine_version" {
  type    = string
  default = "7.1"
}

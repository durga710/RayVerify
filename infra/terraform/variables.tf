################################################################################
# variables.tf — Root input variables
#
# All sizing defaults represent the DEVELOPMENT tier.
# Staging and prod values are provided via .tfvars files.
################################################################################

# ---------------------------------------------------------------------------
# Core deployment context
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "Primary AWS region for deployment."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment: dev | staging | prod"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "az_count" {
  description = "Number of availability zones to use (2 for dev/staging, 3 for prod)."
  type        = number
  default     = 2
}

# ---------------------------------------------------------------------------
# Domain / DNS
# ---------------------------------------------------------------------------

variable "domain_name" {
  description = "Root domain for the platform, e.g. rayverify.com"
  type        = string
}

variable "api_subdomain" {
  description = "Subdomain for the API endpoint (ALB / CloudFront)."
  type        = string
  default     = "api"
}

variable "app_subdomain" {
  description = "Subdomain for the investigator dashboard (CloudFront)."
  type        = string
  default     = "app"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for var.domain_name."
  type        = string
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
  default     = "10.0.0.0/16"
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL
# ---------------------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance type."
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Maximum autoscaling storage in GiB."
  type        = number
  default     = 500
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.3"
}

variable "rds_backup_retention_days" {
  description = "PITR retention period in days (minimum 7 for HIPAA)."
  type        = number
  default     = 7
}

variable "rds_deletion_protection" {
  description = "Enable RDS deletion protection.  Always true in prod."
  type        = bool
  default     = false
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ standby replica for RDS."
  type        = bool
  default     = false
}

variable "rds_create_read_replica" {
  description = "Create a read replica for analytics offloading."
  type        = bool
  default     = false
}

variable "rds_db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "rayverify"
}

# ---------------------------------------------------------------------------
# ElastiCache Redis
# ---------------------------------------------------------------------------

variable "redis_node_type" {
  description = "ElastiCache Redis node type."
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_clusters" {
  description = "Number of nodes in the Redis replication group (1 = no replica)."
  type        = number
  default     = 1
}

variable "redis_engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

# ---------------------------------------------------------------------------
# ECS / Fargate services
# ---------------------------------------------------------------------------

variable "api_cpu" {
  description = "CPU units for the API Fargate task (1 vCPU = 1024)."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory in MiB for the API Fargate task."
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired number of API service tasks."
  type        = number
  default     = 1
}

variable "api_min_count" {
  description = "Minimum task count for API autoscaling."
  type        = number
  default     = 1
}

variable "api_max_count" {
  description = "Maximum task count for API autoscaling."
  type        = number
  default     = 4
}

variable "worker_cpu" {
  description = "CPU units for worker Fargate tasks."
  type        = number
  default     = 512
}

variable "worker_memory" {
  description = "Memory in MiB for worker Fargate tasks."
  type        = number
  default     = 1024
}

variable "worker_desired_count" {
  description = "Desired number of worker tasks."
  type        = number
  default     = 1
}

variable "worker_min_count" {
  description = "Minimum worker task count for autoscaling."
  type        = number
  default     = 1
}

variable "worker_max_count" {
  description = "Maximum worker task count for autoscaling."
  type        = number
  default     = 4
}

variable "ml_cpu" {
  description = "CPU units for the ml-scoring Fargate task."
  type        = number
  default     = 1024
}

variable "ml_memory" {
  description = "Memory in MiB for the ml-scoring Fargate task."
  type        = number
  default     = 2048
}

variable "ml_desired_count" {
  description = "Desired number of ml-scoring tasks."
  type        = number
  default     = 1
}

variable "ml_min_count" {
  description = "Minimum ml-scoring task count."
  type        = number
  default     = 1
}

variable "ml_max_count" {
  description = "Maximum ml-scoring task count."
  type        = number
  default     = 4
}

# ---------------------------------------------------------------------------
# Container image tags
# ---------------------------------------------------------------------------

variable "api_image_tag" {
  description = "Docker image tag for the API service."
  type        = string
  default     = "latest"
}

variable "worker_image_tag" {
  description = "Docker image tag for the worker service."
  type        = string
  default     = "latest"
}

variable "ml_image_tag" {
  description = "Docker image tag for the ml-scoring service."
  type        = string
  default     = "latest"
}

# ---------------------------------------------------------------------------
# WAF
# ---------------------------------------------------------------------------

variable "waf_rate_limit" {
  description = "Maximum requests per 5-minute window per IP before WAF blocks."
  type        = number
  default     = 2000
}

# ---------------------------------------------------------------------------
# SNS alerts
# ---------------------------------------------------------------------------

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications."
  type        = string
}

# ---------------------------------------------------------------------------
# S3 Object Lock — evidence bucket
# ---------------------------------------------------------------------------

variable "evidence_object_lock_days" {
  description = "Object Lock retention period (days) for the evidence S3 bucket. WORM compliance."
  type        = number
  default     = 2555 # 7 years — HIPAA minimum record retention
}

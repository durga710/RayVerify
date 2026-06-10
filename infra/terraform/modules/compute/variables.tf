variable "name_prefix" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "aws_account_id" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "alb_sg_id" { type = string }
variable "ecs_tasks_sg_id" { type = string }
variable "waf_web_acl_arn" { type = string }
variable "kms_key_arn" { type = string }
variable "logs_bucket_id" { type = string }

variable "ecs_task_execution_role_arn" { type = string }
variable "api_task_role_arn" { type = string }
variable "worker_task_role_arn" { type = string }
variable "ml_task_role_arn" { type = string }

variable "rds_secret_arn" { type = string }
variable "redis_secret_arn" { type = string }
variable "app_secrets_arn" { type = string }

variable "api_cpu" { type = number; default = 512 }
variable "api_memory" { type = number; default = 1024 }
variable "api_desired_count" { type = number; default = 1 }
variable "api_min_count" { type = number; default = 1 }
variable "api_max_count" { type = number; default = 4 }
variable "api_image_tag" { type = string; default = "latest" }

variable "worker_cpu" { type = number; default = 512 }
variable "worker_memory" { type = number; default = 1024 }
variable "worker_desired_count" { type = number; default = 1 }
variable "worker_min_count" { type = number; default = 1 }
variable "worker_max_count" { type = number; default = 4 }
variable "worker_image_tag" { type = string; default = "latest" }

variable "ml_cpu" { type = number; default = 1024 }
variable "ml_memory" { type = number; default = 2048 }
variable "ml_desired_count" { type = number; default = 1 }
variable "ml_min_count" { type = number; default = 1 }
variable "ml_max_count" { type = number; default = 4 }
variable "ml_image_tag" { type = string; default = "latest" }

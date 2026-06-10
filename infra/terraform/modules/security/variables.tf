variable "name_prefix" {
  description = "Resource name prefix."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
}

variable "waf_rate_limit" {
  description = "Max requests per 5-min window per IP."
  type        = number
  default     = 2000
}

variable "alb_sg_id" {
  description = "ALB security group ID (created in networking module)."
  type        = string
}

variable "private_subnet_cidr_blocks" {
  description = "CIDR blocks of private subnets (for SG ingress rules)."
  type        = list(string)
}

variable "data_subnet_cidr_blocks" {
  description = "CIDR blocks of data subnets."
  type        = list(string)
}

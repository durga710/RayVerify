variable "name_prefix" {
  description = "Resource name prefix, e.g. rv-dev"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
}

variable "az_count" {
  description = "Number of AZs to spread subnets across."
  type        = number
}

variable "azs" {
  description = "List of AZ names (length must equal az_count)."
  type        = list(string)
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
}

variable "aws_region" {
  description = "AWS region (used for VPC endpoint service names)."
  type        = string
}

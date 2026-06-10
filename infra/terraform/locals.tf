################################################################################
# locals.tf — Computed values & naming helpers
#
# All resource names are prefixed rv-<env>- to avoid collisions across
# environments deployed in the same AWS account (dev/staging share an account
# in cost-conscious setups; prod is always isolated).
################################################################################

locals {
  # ---------------------------------------------------------------------------
  # Name prefix — used by every module for consistent resource naming
  # Example:  rv-dev-api  |  rv-prod-rds
  # ---------------------------------------------------------------------------
  name_prefix = "rv-${var.environment}"

  # ---------------------------------------------------------------------------
  # Derived CIDR blocks — each AZ gets a /24 slice of the /16 VPC CIDR.
  # Layout (per AZ):
  #   10.<env_octet>.0.0/24  — public   (ALB, NAT EIP)
  #   10.<env_octet>.10.0/24 — private  (ECS tasks, Lambda)
  #   10.<env_octet>.20.0/24 — data     (RDS, ElastiCache — no route to IGW)
  # ---------------------------------------------------------------------------
  env_octet = {
    dev     = 0
    staging = 1
    prod    = 2
  }

  # ---------------------------------------------------------------------------
  # Availability zones — first N AZs in the deployment region
  # ---------------------------------------------------------------------------
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # ---------------------------------------------------------------------------
  # Common tags merged onto every resource (supplements provider default_tags)
  # ---------------------------------------------------------------------------
  common_tags = {
    Project     = "RayVerify"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Discover the AZs available in the current region
data "aws_availability_zones" "available" {
  state = "available"
}

# Current AWS account ID — used in IAM policy ARN construction
data "aws_caller_identity" "current" {}

# Current region — used wherever aws_region is needed without a variable
data "aws_region" "current" {}

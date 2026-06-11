################################################################################
# versions.tf — Terraform core and provider version constraints
#
# Pin provider versions explicitly to prevent unintended upgrades in CI.
# Upgrade by editing the constraint and running `terraform init -upgrade`.
################################################################################

terraform {
  required_version = ">= 1.7.0, < 2.0.0"

  required_providers {
    # Primary cloud provider
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }

    # aws provider alias for us-east-1 (ACM certs for CloudFront must be in us-east-1)
    # The alias is declared in providers.tf; the version constraint applies to both.

    # Random suffix for globally-unique resource names (S3 buckets, etc.)
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

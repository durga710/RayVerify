################################################################################
# providers.tf — AWS provider configuration
#
# default_tags are applied to every taggable resource automatically.
# Tagging strategy supports SOC 2 CC6.3 (asset inventory) and
# HIPAA §164.308(a)(1) (risk analysis: data classification label PHI).
################################################################################

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project            = "RayVerify"
      Environment        = var.environment
      ManagedBy          = "terraform"
      DataClassification = "PHI"          # HIPAA: flag all resources that may handle PHI
      Owner              = "platform-team"
      CostCenter         = "medicaid-fraud"
      Compliance         = "HIPAA,SOC2,CMS-EVV"
    }
  }
}

# ---------------------------------------------------------------------------
# Secondary provider alias — us-east-1
# ACM certificates used by CloudFront must be provisioned in us-east-1
# regardless of the primary deployment region.
# ---------------------------------------------------------------------------
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project            = "RayVerify"
      Environment        = var.environment
      ManagedBy          = "terraform"
      DataClassification = "PHI"
      Owner              = "platform-team"
      CostCenter         = "medicaid-fraud"
      Compliance         = "HIPAA,SOC2,CMS-EVV"
    }
  }
}

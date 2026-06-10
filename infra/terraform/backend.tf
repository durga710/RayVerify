################################################################################
# backend.tf — Remote state: S3 (encrypted) + DynamoDB (atomic lock)
#
# HIPAA/SOC 2 note: state files may contain secrets and resource metadata.
# The state bucket is KMS-encrypted, versioned, and access-logged.
# Never commit a terraform.tfstate file to source control.
#
# Override per environment via:
#   terraform init -backend-config="key=env/<env>/rayverify.tfstate"
#
# One-time bootstrap is documented in README.md.
################################################################################

terraform {
  backend "s3" {
    # ---------------------------------------------------------------------------
    # Replace placeholder values before running `terraform init`.
    # These are intentionally left as descriptive comments rather than real
    # values so that each environment configures them via -backend-config flags.
    # ---------------------------------------------------------------------------

    # bucket         = "rayverify-tfstate-<aws-account-id>"   # versioned + KMS-encrypted
    # key            = "env/dev/rayverify.tfstate"             # per-environment key
    # region         = "us-east-1"
    # dynamodb_table = "rayverify-tfstate-lock"                # partition key: LockID (S)
    # encrypt        = true                                    # SSE-KMS
    # kms_key_id     = "alias/rayverify-tfstate"               # optional dedicated CMK

    # ---------------------------------------------------------------------------
    # Example development defaults (uncomment and edit for local use):
    # ---------------------------------------------------------------------------
    bucket         = "rayverify-tfstate-CHANGE_ME"
    key            = "env/dev/rayverify.tfstate"
    region         = "us-east-1"
    dynamodb_table = "rayverify-tfstate-lock"
    encrypt        = true
  }
}

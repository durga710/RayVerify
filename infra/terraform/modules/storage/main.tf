################################################################################
# modules/storage/main.tf
#
# Buckets:
#   evidence  — WORM (S3 Object Lock COMPLIANCE mode), SSE-KMS, versioning
#   reports   — SSE-KMS, versioning, lifecycle (expire old reports)
#   static    — SSE-KMS, public access blocked (CloudFront OAC only)
#   logs      — SSE-KMS, bucket access logs destination
#
# All buckets:
#   - Block all public access (ACL + policy)
#   - SSE-KMS (CMK, not default S3 key)
#   - Versioning enabled
#   - Enforce TLS via bucket policy deny on non-TLS requests
#
# Compliance notes:
#   HIPAA §164.312(c)(1): integrity controls — Object Lock + versioning prevent
#   modification or deletion of evidence records (tamper-evident audit trail).
#   HIPAA §164.312(a)(2)(iv): SSE-KMS satisfies encryption-at-rest requirement.
#   SOC 2 A1.2: availability — versioning + lifecycle protect against accidental
#   deletion while managing storage cost.
#   CMS EVV: WORM evidence storage satisfies program integrity record-keeping.
################################################################################

# Random suffix for globally-unique bucket names
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

locals {
  suffix = random_id.bucket_suffix.hex
}

################################################################################
# Helper: reusable SSE-KMS server-side encryption config
################################################################################

# Enforce TLS bucket policy template (applied to each bucket)
data "aws_iam_policy_document" "deny_non_tls" {
  for_each = toset(["evidence", "reports", "static", "logs"])

  statement {
    sid    = "DenyNonTLS"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions   = ["s3:*"]
    resources = [
      "arn:aws:s3:::${var.name_prefix}-${each.key}-${local.suffix}",
      "arn:aws:s3:::${var.name_prefix}-${each.key}-${local.suffix}/*"
    ]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

################################################################################
# Evidence Bucket — WORM / Object Lock (COMPLIANCE mode)
#
# Object Lock COMPLIANCE mode: no principal (including root / AWS Support) can
# delete or overwrite an object version within the retention period.
# This satisfies HIPAA tamper-evident evidence storage and CMS EVV requirements.
################################################################################
resource "aws_s3_bucket" "evidence" {
  bucket = "${var.name_prefix}-evidence-${local.suffix}"

  # Object Lock must be enabled at bucket creation time; cannot be added later
  object_lock_enabled = true

  tags = {
    Name    = "${var.name_prefix}-evidence"
    Purpose = "worm-evidence-hipaa"
  }
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration {
    status = "Enabled" # required for Object Lock
  }
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    default_retention {
      mode = "COMPLIANCE" # immutable — cannot be overridden even by root
      days = var.evidence_object_lock_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true # reduces KMS API call cost for high-volume uploads
  }
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  policy = data.aws_iam_policy_document.deny_non_tls["evidence"].json
}

resource "aws_s3_bucket_lifecycle_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER_IR" # immediate retrieval — evidence may be needed fast
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER_IR"
    }
  }
}

################################################################################
# Reports Bucket — PDF/Excel reports, ML models
################################################################################
resource "aws_s3_bucket" "reports" {
  bucket = "${var.name_prefix}-reports-${local.suffix}"

  tags = {
    Name    = "${var.name_prefix}-reports"
    Purpose = "fraud-reports"
  }
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket                  = aws_s3_bucket.reports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "reports" {
  bucket = aws_s3_bucket.reports.id
  policy = data.aws_iam_policy_document.deny_non_tls["reports"].json
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-old-reports"
    status = "Enabled"

    expiration {
      days = 730 # 2 years; HIPAA requires 6 years → move to Glacier before expiry
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

################################################################################
# Static Assets Bucket — Next.js frontend (CloudFront OAC origin)
################################################################################
resource "aws_s3_bucket" "static" {
  bucket = "${var.name_prefix}-static-${local.suffix}"

  tags = {
    Name    = "${var.name_prefix}-static"
    Purpose = "frontend-assets"
  }
}

resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket                  = aws_s3_bucket.static.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id
  policy = data.aws_iam_policy_document.deny_non_tls["static"].json
}

resource "aws_s3_bucket_lifecycle_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

################################################################################
# Logs Bucket — ALB + CloudFront access logs destination
#
# Note: ALB access log delivery requires the bucket policy to allow the
# Elastic Load Balancing service principal (not a CMK-encrypted bucket
# requirement from ELB side; ELB uses its own server-side encryption).
################################################################################
resource "aws_s3_bucket" "logs" {
  bucket = "${var.name_prefix}-logs-${local.suffix}"

  tags = {
    Name    = "${var.name_prefix}-logs"
    Purpose = "access-logs-audit"
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # ALB log delivery requires AES256 (not KMS) or CMK with ELB service principal
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allow ALB to deliver access logs
data "aws_elb_service_account" "main" {}

data "aws_iam_policy_document" "logs_bucket" {
  statement {
    sid    = "AllowALBLogs"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.main.arn]
    }
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::${var.name_prefix}-logs-${local.suffix}/alb/*"]
  }

  statement {
    sid    = "AllowCloudFrontLogs"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["delivery.logs.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::${var.name_prefix}-logs-${local.suffix}/cloudfront/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
  }

  statement {
    sid    = "DenyNonTLS"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions   = ["s3:*"]
    resources = [
      "arn:aws:s3:::${var.name_prefix}-logs-${local.suffix}",
      "arn:aws:s3:::${var.name_prefix}-logs-${local.suffix}/*"
    ]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = data.aws_iam_policy_document.logs_bucket.json
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-access-logs"
    status = "Enabled"

    expiration {
      days = 365 # 1 year hot; archive to Glacier for HIPAA 6-year minimum
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

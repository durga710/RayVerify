variable "name_prefix" { type = string }
variable "environment" { type = string }
variable "kms_key_arn" {
  description = "KMS CMK ARN for S3 SSE-KMS encryption."
  type        = string
}
variable "evidence_object_lock_days" {
  description = "Object Lock retention period in days (WORM — HIPAA 7-year minimum)."
  type        = number
  default     = 2555
}
variable "aws_account_id" { type = string }

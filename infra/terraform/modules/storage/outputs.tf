output "evidence_bucket_name" {
  description = "Evidence S3 bucket name (WORM)."
  value       = aws_s3_bucket.evidence.id
}

output "evidence_bucket_arn" {
  description = "Evidence S3 bucket ARN."
  value       = aws_s3_bucket.evidence.arn
}

output "reports_bucket_name" {
  description = "Reports S3 bucket name."
  value       = aws_s3_bucket.reports.id
}

output "reports_bucket_arn" {
  description = "Reports S3 bucket ARN."
  value       = aws_s3_bucket.reports.arn
}

output "static_bucket_id" {
  description = "Static assets S3 bucket ID."
  value       = aws_s3_bucket.static.id
}

output "static_bucket_arn" {
  description = "Static assets S3 bucket ARN."
  value       = aws_s3_bucket.static.arn
}

output "static_bucket_regional_domain" {
  description = "Static bucket regional domain name (for CloudFront origin)."
  value       = aws_s3_bucket.static.bucket_regional_domain_name
}

output "logs_bucket_name" {
  description = "Access-logs S3 bucket name."
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "Access-logs S3 bucket ARN."
  value       = aws_s3_bucket.logs.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.app.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidations)."
  value       = aws_cloudfront_distribution.app.id
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID."
  value       = aws_cloudfront_distribution.app.hosted_zone_id
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN (us-east-1)."
  value       = aws_acm_certificate.this.arn
}

output "app_url" {
  description = "HTTPS URL for the investigator dashboard."
  value       = "https://${var.app_subdomain}.${var.domain_name}"
}

output "api_url" {
  description = "HTTPS URL for the API."
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

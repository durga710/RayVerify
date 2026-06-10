################################################################################
# modules/edge/main.tf
#
# Resources:
#   - ACM certificate (us-east-1 — required for CloudFront)
#   - CloudFront distributions (app frontend + API proxy)
#   - Route53 alias records
#
# Providers used:
#   aws           — primary region (for Route53, data sources)
#   aws.us_east_1 — ACM + WAF for CloudFront (must be us-east-1)
#
# Compliance notes:
#   - minimum_protocol_version = TLSv1.2_2021 (TLS 1.2/1.3 only)
#   - WAFv2 CLOUDFRONT ACL attached
#   - All CloudFront access logs written to S3
#   - HTTPS-only viewer protocol (no plain HTTP to origin)
################################################################################

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

################################################################################
# ACM Certificate — must be in us-east-1 for CloudFront
################################################################################
resource "aws_acm_certificate" "this" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = [
    "*.${var.domain_name}",
    "${var.api_subdomain}.${var.domain_name}",
    "${var.app_subdomain}.${var.domain_name}"
  ]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.name_prefix}-cloudfront-cert"
  }
}

# DNS validation records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "this" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

################################################################################
# CloudFront Origin Access Control — S3 static assets (no OAI; OAC is current)
################################################################################
resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "${var.name_prefix}-static-oac"
  description                       = "OAC for static asset S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

################################################################################
# CloudFront Distribution — App (investigator dashboard)
################################################################################
resource "aws_cloudfront_distribution" "app" {
  comment             = "${var.name_prefix} — Investigator Dashboard"
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US + EU only (data residency awareness)

  aliases = ["${var.app_subdomain}.${var.domain_name}"]

  # S3 static asset origin
  origin {
    domain_name              = var.static_bucket_domain
    origin_id                = "static-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  # ALB API origin (for SSR / proxy pass-through)
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb-api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only" # force TLS to origin
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behaviour — static assets from S3
  default_cache_behavior {
    target_origin_id       = "static-s3"
    viewer_protocol_policy = "redirect-to-https" # no plain HTTP
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    compress               = true
    min_ttl                = 0
    default_ttl            = 86400   # 1 day
    max_ttl                = 2592000 # 30 days
  }

  # /api/* cache behaviour — forward to ALB, no caching (PHI responses)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb-api"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Accept", "Content-Type", "Origin"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0 # No caching for API responses (PHI)
    max_ttl     = 0
    compress    = true
  }

  # TLS configuration — enforce TLS 1.2 minimum
  viewer_certificate {
    acm_certificate_arn            = aws_acm_certificate_validation.this.certificate_arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
    cloudfront_default_certificate = false
  }

  # WAFv2 ACL (CLOUDFRONT scope) — SOC 2 CC6.6
  web_acl_id = var.waf_web_acl_arn

  restrictions {
    geo_restriction {
      restriction_type = "none" # State agencies operate nationwide; no geo-block
    }
  }

  # Access logs — S3 (audit trail)
  logging_config {
    bucket          = "${var.logs_bucket_id}.s3.amazonaws.com"
    prefix          = "cloudfront/"
    include_cookies = false
  }

  tags = {
    Name = "${var.name_prefix}-cf-app"
  }

  depends_on = [aws_acm_certificate_validation.this]
}

################################################################################
# Route53 Records
################################################################################

# App subdomain → CloudFront
resource "aws_route53_record" "app" {
  zone_id = var.route53_zone_id
  name    = "${var.app_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

# API subdomain → ALB
resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# AAAA (IPv6) records
resource "aws_route53_record" "app_aaaa" {
  zone_id = var.route53_zone_id
  name    = "${var.app_subdomain}.${var.domain_name}"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

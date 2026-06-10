variable "name_prefix" { type = string }
variable "environment" { type = string }
variable "domain_name" { type = string }
variable "api_subdomain" { type = string; default = "api" }
variable "app_subdomain" { type = string; default = "app" }
variable "route53_zone_id" { type = string }
variable "alb_dns_name" { type = string }
variable "alb_zone_id" { type = string }
variable "static_bucket_domain" { type = string }
variable "static_bucket_id" { type = string }
variable "logs_bucket_id" { type = string }
variable "waf_web_acl_arn" { type = string }

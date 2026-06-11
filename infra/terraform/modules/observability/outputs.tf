output "sns_alert_topic_arn" {
  description = "SNS alert topic ARN."
  value       = aws_sns_topic.alerts.arn
}

output "sns_alert_topic_name" {
  description = "SNS alert topic name."
  value       = aws_sns_topic.alerts.name
}

output "dashboard_name" {
  description = "CloudWatch dashboard name."
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

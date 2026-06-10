################################################################################
# modules/observability/main.tf
#
# Resources:
#   - SNS alert topic (KMS-encrypted)
#   - CloudWatch alarms (ECS, RDS, Redis, ALB, fraud-specific)
#   - CloudWatch log metric filters (error rates, authentication events)
#   - CloudWatch dashboard (operational overview)
#
# Compliance notes:
#   SOC 2 CC7.2: system monitoring — alarms fire on anomalies, capacity, and
#   errors. CloudWatch logs provide continuous monitoring of security events.
#   HIPAA §164.308(a)(1): risk analysis — monitoring surfaces threats in real time.
#   HIPAA §164.312(b): audit controls — metric filters detect failed logins,
#   unauthorized access attempts, and data export events.
################################################################################

################################################################################
# SNS Alert Topic (KMS-encrypted)
################################################################################
resource "aws_sns_topic" "alerts" {
  name              = "${var.name_prefix}-alerts"
  kms_master_key_id = var.kms_key_arn

  tags = {
    Name = "${var.name_prefix}-alerts"
  }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

################################################################################
# ECS Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${var.name_prefix}-api-cpu-high"
  alarm_description   = "API service CPU utilization > 85% for 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-api-cpu-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "api_memory_high" {
  alarm_name          = "${var.name_prefix}-api-memory-high"
  alarm_description   = "API service memory utilization > 90%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 90.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-api-memory-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "api_task_count_low" {
  alarm_name          = "${var.name_prefix}-api-tasks-low"
  alarm_description   = "API running task count dropped below minimum (possible crash loop)"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = 1.0
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-api-tasks-alarm" }
}

################################################################################
# RDS Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.name_prefix}-rds-cpu-high"
  alarm_description   = "RDS CPU utilization > 80%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-rds-cpu-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${var.name_prefix}-rds-storage-low"
  alarm_description   = "RDS free storage < 10 GiB — risk of data loss"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GiB in bytes
  treat_missing_data  = "breaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-rds-storage-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.name_prefix}-rds-connections-high"
  alarm_description   = "RDS connection count > 400 (nearing max)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 400.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-rds-conn-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "rds_replica_lag" {
  alarm_name          = "${var.name_prefix}-rds-replica-lag"
  alarm_description   = "RDS read replica lag > 30 seconds"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReplicaLag"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 30.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = "${var.rds_identifier}-replica"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-rds-replica-alarm" }
}

################################################################################
# ElastiCache Redis Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${var.name_prefix}-redis-cpu-high"
  alarm_description   = "Redis engine CPU > 70%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 70.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-redis-cpu-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${var.name_prefix}-redis-memory-high"
  alarm_description   = "Redis database memory usage > 80%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 80.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-redis-mem-alarm" }
}

################################################################################
# ALB Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "alb_5xx_high" {
  alarm_name          = "${var.name_prefix}-alb-5xx-high"
  alarm_description   = "ALB HTTP 5xx error rate > 5%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 50.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-alb-5xx-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  alarm_name          = "${var.name_prefix}-alb-p99-latency"
  alarm_description   = "ALB P99 target response time > 5s"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p99"
  threshold           = 5.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-alb-latency-alarm" }
}

################################################################################
# Log Metric Filters — security and fraud signals
#
# HIPAA §164.312(b): audit controls — detect and alert on suspicious patterns.
################################################################################

# Failed authentication attempts
resource "aws_cloudwatch_log_metric_filter" "failed_auth" {
  name           = "${var.name_prefix}-failed-auth"
  log_group_name = var.api_log_group_name
  pattern        = "[timestamp, requestId, level=\"ERROR\", ..., message=\"*authentication*failed*\"]"

  metric_transformation {
    name      = "FailedAuthCount"
    namespace = "RayVerify/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "failed_auth_high" {
  alarm_name          = "${var.name_prefix}-failed-auth-spike"
  alarm_description   = "Failed authentication rate spike — possible credential stuffing"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailedAuthCount"
  namespace           = "RayVerify/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = 50.0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-failed-auth-alarm" }
}

# High fraud score detections
resource "aws_cloudwatch_log_metric_filter" "high_fraud_score" {
  name           = "${var.name_prefix}-high-fraud-score"
  log_group_name = var.ml_log_group_name
  pattern        = "[..., score >= 90]"

  metric_transformation {
    name      = "HighFraudScoreCount"
    namespace = "RayVerify/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "fraud_spike" {
  alarm_name          = "${var.name_prefix}-fraud-score-spike"
  alarm_description   = "Unusual spike in high fraud-score visits — investigate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HighFraudScoreCount"
  namespace           = "RayVerify/${var.environment}"
  period              = 3600 # 1 hour
  statistic           = "Sum"
  threshold           = 100.0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-fraud-spike-alarm" }
}

# Application errors
resource "aws_cloudwatch_log_metric_filter" "app_errors" {
  name           = "${var.name_prefix}-app-errors"
  log_group_name = var.api_log_group_name
  pattern        = "[timestamp, requestId, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "AppErrorCount"
    namespace = "RayVerify/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "app_error_high" {
  alarm_name          = "${var.name_prefix}-app-errors-high"
  alarm_description   = "Application error rate > 100/min"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "AppErrorCount"
  namespace           = "RayVerify/${var.environment}"
  period              = 60
  statistic           = "Sum"
  threshold           = 100.0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = { Name = "${var.name_prefix}-app-errors-alarm" }
}

################################################################################
# CloudWatch Dashboard — Operational Overview
################################################################################

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-operations"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: ECS CPU utilization
      {
        type = "metric"
        x = 0; y = 0; width = 8; height = 6
        properties = {
          title  = "ECS CPU Utilization"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.api_service_name, { label = "API" }],
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.worker_service_name, { label = "Worker" }],
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ml_service_name, { label = "ML-Scoring" }]
          ]
          period = 60
          yAxis  = { left = { min = 0, max = 100 } }
        }
      },
      # Row 1: ECS Memory utilization
      {
        type = "metric"
        x = 8; y = 0; width = 8; height = 6
        properties = {
          title  = "ECS Memory Utilization"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.api_service_name, { label = "API" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.worker_service_name, { label = "Worker" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ml_service_name, { label = "ML-Scoring" }]
          ]
          period = 60
          yAxis  = { left = { min = 0, max = 100 } }
        }
      },
      # Row 1: ALB request count + error rates
      {
        type = "metric"
        x = 16; y = 0; width = 8; height = 6
        properties = {
          title  = "ALB Requests & Errors"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { label = "Requests", stat = "Sum" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, { label = "5xx Errors", stat = "Sum", color = "#d62728" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", var.alb_arn_suffix, { label = "4xx Errors", stat = "Sum", color = "#ff7f0e" }]
          ]
          period = 60
        }
      },
      # Row 2: RDS
      {
        type = "metric"
        x = 0; y = 6; width = 12; height = 6
        properties = {
          title  = "RDS PostgreSQL"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_identifier, { label = "CPU %" }],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_identifier, { label = "Connections", yAxis = "right" }]
          ]
          period = 60
        }
      },
      # Row 2: Redis
      {
        type = "metric"
        x = 12; y = 6; width = 12; height = 6
        properties = {
          title  = "ElastiCache Redis"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", var.redis_replication_group_id, { label = "CPU %" }],
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "ReplicationGroupId", var.redis_replication_group_id, { label = "Memory %", yAxis = "right" }]
          ]
          period = 60
        }
      },
      # Row 3: Security / Fraud signals
      {
        type = "metric"
        x = 0; y = 12; width = 12; height = 6
        properties = {
          title  = "Security Events"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["RayVerify/${var.environment}", "FailedAuthCount", { label = "Failed Auth", stat = "Sum", color = "#d62728" }],
            ["RayVerify/${var.environment}", "AppErrorCount", { label = "App Errors", stat = "Sum", color = "#ff7f0e" }]
          ]
          period = 300
        }
      },
      {
        type = "metric"
        x = 12; y = 12; width = 12; height = 6
        properties = {
          title  = "Fraud Intelligence"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["RayVerify/${var.environment}", "HighFraudScoreCount", { label = "High Fraud Score Visits", stat = "Sum", color = "#e377c2" }]
          ]
          period = 3600
        }
      }
    ]
  })
}

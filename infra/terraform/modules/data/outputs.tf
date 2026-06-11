output "rds_endpoint" {
  description = "RDS primary writer endpoint (host:port)."
  value       = aws_db_instance.primary.endpoint
  sensitive   = true
}

output "rds_address" {
  description = "RDS primary endpoint hostname."
  value       = aws_db_instance.primary.address
  sensitive   = true
}

output "rds_port" {
  description = "RDS port."
  value       = aws_db_instance.primary.port
}

output "rds_identifier" {
  description = "RDS instance identifier (used in CloudWatch metrics)."
  value       = aws_db_instance.primary.identifier
}

output "rds_read_replica_endpoint" {
  description = "RDS read-replica endpoint (empty string if not created)."
  value       = var.rds_create_read_replica ? aws_db_instance.replica[0].endpoint : ""
  sensitive   = true
}

output "rds_arn" {
  description = "RDS primary instance ARN."
  value       = aws_db_instance.primary.arn
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint address."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "ElastiCache Redis reader endpoint (for read replicas)."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port (TLS enabled)."
  value       = aws_elasticache_replication_group.this.port
}

output "redis_replication_group_id" {
  description = "ElastiCache replication group ID (used in CloudWatch metrics)."
  value       = aws_elasticache_replication_group.this.id
}

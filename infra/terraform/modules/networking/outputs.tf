output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs (one per AZ)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (one per AZ)."
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "Data subnet IDs (one per AZ — no internet route)."
  value       = aws_subnet.data[*].id
}

output "private_subnet_cidr_blocks" {
  description = "CIDR blocks for private subnets."
  value       = aws_subnet.private[*].cidr_block
}

output "data_subnet_cidr_blocks" {
  description = "CIDR blocks for data subnets."
  value       = aws_subnet.data[*].cidr_block
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs."
  value       = aws_nat_gateway.this[*].id
}

output "alb_sg_id" {
  description = "ALB security group ID (created in networking to avoid circular deps)."
  value       = aws_security_group.alb.id
}

output "vpce_sg_id" {
  description = "VPC endpoints security group ID."
  value       = aws_security_group.vpce.id
}

output "s3_vpc_endpoint_id" {
  description = "S3 Gateway VPC endpoint ID."
  value       = aws_vpc_endpoint.s3.id
}

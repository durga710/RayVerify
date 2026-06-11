################################################################################
# modules/networking/main.tf
#
# Zero Trust network design:
#   - Three subnet tiers per AZ: public / private / data
#   - Only the public tier has a route to the Internet Gateway (ALB + NAT EIP)
#   - Private tier routes internet-bound traffic through NAT Gateway
#   - Data tier has NO route to the internet at all
#   - VPC endpoints eliminate public AWS API routes (SOC 2 / Zero Trust)
#   - NACLs default-deny; allow-list only required traffic
################################################################################

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true # required for RDS endpoint resolution inside VPC

  tags = {
    Name = "${var.name_prefix}-vpc"
  }
}

# ---------------------------------------------------------------------------
# Internet Gateway (public subnets only)
# ---------------------------------------------------------------------------
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.name_prefix}-igw"
  }
}

# ---------------------------------------------------------------------------
# Subnets — three tiers across each AZ
#
# CIDR strategy (per AZ index i, 0-based):
#   public  = 10.x.(i*3+0).0/24   e.g. 10.0.0.0/24, 10.0.3.0/24, 10.0.6.0/24
#   private = 10.x.(i*3+1).0/24   e.g. 10.0.1.0/24, 10.0.4.0/24, 10.0.7.0/24
#   data    = 10.x.(i*3+2).0/24   e.g. 10.0.2.0/24, 10.0.5.0/24, 10.0.8.0/24
# ---------------------------------------------------------------------------

locals {
  # Extract the second octet from the VPC CIDR (e.g. "10.0.0.0/16" → "0")
  vpc_second_octet = split(".", var.vpc_cidr)[1]
}

resource "aws_subnet" "public" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = "10.${local.vpc_second_octet}.${count.index * 3}.0/24"
  availability_zone = var.azs[count.index]

  # Do NOT auto-assign public IPs — ALB ENIs get EIPs; we do not want random
  # public IPs on ECS tasks (Zero Trust: tasks live in private subnets only).
  map_public_ip_on_launch = false

  tags = {
    Name = "${var.name_prefix}-public-${var.azs[count.index]}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = "10.${local.vpc_second_octet}.${count.index * 3 + 1}.0/24"
  availability_zone = var.azs[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name = "${var.name_prefix}-private-${var.azs[count.index]}"
    Tier = "private"
  }
}

resource "aws_subnet" "data" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = "10.${local.vpc_second_octet}.${count.index * 3 + 2}.0/24"
  availability_zone = var.azs[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name = "${var.name_prefix}-data-${var.azs[count.index]}"
    Tier = "data"
  }
}

# ---------------------------------------------------------------------------
# NAT Gateways — one per AZ for high availability (prod) or one shared (dev)
# The count is controlled by var.az_count: for prod all AZs get a NAT GW;
# for dev a single NAT GW suffices (cheaper).
# ---------------------------------------------------------------------------
resource "aws_eip" "nat" {
  count  = var.az_count
  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-nat-eip-${count.index}"
  }
}

resource "aws_nat_gateway" "this" {
  count         = var.az_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.name_prefix}-natgw-${var.azs[count.index]}"
  }

  depends_on = [aws_internet_gateway.this]
}

# ---------------------------------------------------------------------------
# Route tables
# ---------------------------------------------------------------------------

# Public — default route to IGW
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name = "${var.name_prefix}-rt-public"
  }
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private — default route to NAT GW (per-AZ for resilience)
resource "aws_route_table" "private" {
  count  = var.az_count
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[count.index].id
  }

  tags = {
    Name = "${var.name_prefix}-rt-private-${var.azs[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Data — NO default route (no internet access for DB/cache tier)
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.this.id

  # Intentionally no default route — data tier is fully isolated.

  tags = {
    Name = "${var.name_prefix}-rt-data"
  }
}

resource "aws_route_table_association" "data" {
  count          = var.az_count
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.data.id
}

# ---------------------------------------------------------------------------
# VPC Endpoints — replace public AWS API routes with private connections.
# Zero Trust: traffic to AWS services never leaves the AWS network.
# Required services: S3 (Gateway), ECR, CloudWatch Logs, Secrets Manager, KMS.
# ---------------------------------------------------------------------------

# S3 Gateway endpoint (free, no ENI needed)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = concat(
    [aws_route_table.public.id],
    aws_route_table.private[*].id,
    [aws_route_table.data.id]
  )

  tags = {
    Name = "${var.name_prefix}-vpce-s3"
  }
}

# Interface endpoints — require ENIs in private subnets
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.name_prefix}-vpce-ecr-api"
  }
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.name_prefix}-vpce-ecr-dkr"
  }
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.name_prefix}-vpce-logs"
  }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.name_prefix}-vpce-secretsmanager"
  }
}

resource "aws_vpc_endpoint" "kms" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.kms"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.name_prefix}-vpce-kms"
  }
}

resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ssm"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.name_prefix}-vpce-ssm"
  }
}

# ---------------------------------------------------------------------------
# Security Group for VPC Endpoints — allow HTTPS from VPC CIDR only
# ---------------------------------------------------------------------------
resource "aws_security_group" "vpce" {
  name        = "${var.name_prefix}-vpce-sg"
  description = "Allow HTTPS from VPC to interface VPC endpoints"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-vpce-sg"
  }
}

# ---------------------------------------------------------------------------
# Placeholder ALB Security Group (referenced in security module to avoid cycle)
# The security module will extend rules; we create the SG here to own lifecycle.
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "ALB — internet-facing HTTPS (443) only"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-alb-sg"
  }
}

# ---------------------------------------------------------------------------
# Network ACLs — default-deny posture
#
# HIPAA §164.312(e)(1): implement technical security measures to guard against
# unauthorized access to PHI transmitted over networks.
#
# Default VPC NACL allows all traffic; we replace it with explicit allow-lists.
# ---------------------------------------------------------------------------

# Public NACL
resource "aws_network_acl" "public" {
  vpc_id     = aws_vpc.this.id
  subnet_ids = aws_subnet.public[*].id

  # Inbound: allow HTTPS (443) and HTTP (80) from internet, ephemeral return traffic
  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }
  ingress {
    rule_no    = 110
    action     = "allow"
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
  }
  ingress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }
  # Deny all other inbound (implicit; add explicit deny at 32766)
  ingress {
    rule_no    = 32766
    action     = "deny"
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  # Outbound: allow all (NAT GW, VPC internal)
  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = {
    Name = "${var.name_prefix}-nacl-public"
  }
}

# Private NACL — allow traffic from/to VPC CIDR, ephemeral TCP, and HTTPS out
resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.this.id
  subnet_ids = aws_subnet.private[*].id

  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 65535
  }
  # Ephemeral return traffic from NAT GW (internet responses)
  ingress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }
  ingress {
    rule_no    = 32766
    action     = "deny"
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = {
    Name = "${var.name_prefix}-nacl-private"
  }
}

# Data NACL — allow only from private subnets (DB ports), deny everything else
resource "aws_network_acl" "data" {
  vpc_id     = aws_vpc.this.id
  subnet_ids = aws_subnet.data[*].id

  # PostgreSQL from private subnet range
  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    cidr_block = var.vpc_cidr  # tightened further by SG rules in security module
    from_port  = 5432
    to_port    = 5432
  }
  # Redis from private subnet range
  ingress {
    rule_no    = 110
    action     = "allow"
    protocol   = "tcp"
    cidr_block = var.vpc_cidr
    from_port  = 6379
    to_port    = 6379
  }
  # Ephemeral return traffic
  ingress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    cidr_block = var.vpc_cidr
    from_port  = 1024
    to_port    = 65535
  }
  ingress {
    rule_no    = 32766
    action     = "deny"
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    cidr_block = var.vpc_cidr
    from_port  = 1024
    to_port    = 65535
  }
  egress {
    rule_no    = 32766
    action     = "deny"
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = {
    Name = "${var.name_prefix}-nacl-data"
  }
}

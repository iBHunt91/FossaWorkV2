terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }
  
  backend "s3" {
    bucket         = "fossawork-terraform-state"
    key            = "fossawork-v2/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "fossawork-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "FossaWork-V2"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_id]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_id]
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

data "aws_caller_identity" "current" {}

# VPC Module
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Enable flow logs for security monitoring
  enable_flow_log                      = true
  create_flow_log_cloudwatch_iam_role  = true
  create_flow_log_cloudwatch_log_group = true

  tags = {
    "kubernetes.io/cluster/${var.project_name}-${var.environment}" = "shared"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.project_name}-${var.environment}" = "shared"
    "kubernetes.io/role/elb"                                       = 1
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.project_name}-${var.environment}" = "shared"
    "kubernetes.io/role/internal-elb"                              = 1
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = var.kubernetes_version

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true
  cluster_endpoint_private_access = true

  # Cluster endpoint access
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # Cluster logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  # Cluster security
  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }

  # Node groups
  eks_managed_node_groups = {
    general = {
      name = "general"

      instance_types = var.node_instance_types
      
      min_size     = var.node_group_min_size
      max_size     = var.node_group_max_size
      desired_size = var.node_group_desired_size

      # Use the most recent EKS optimized AMI
      ami_type = "AL2_x86_64"
      
      # Enable detailed monitoring
      enable_monitoring = true
      
      # Security group rules
      create_security_group = true
      
      # Disk configuration
      disk_size = 50
      disk_type = "gp3"
      
      # Taints and labels
      labels = {
        Environment = var.environment
        NodeGroup   = "general"
      }
      
      # User data for additional security hardening
      user_data_template_path = "${path.module}/user_data.sh"
      
      # Instance refresh
      update_config = {
        max_unavailable_percentage = 25
      }
    }
    
    # Spot instances for non-critical workloads
    spot = {
      name = "spot"
      
      instance_types = var.spot_instance_types
      capacity_type  = "SPOT"
      
      min_size     = 0
      max_size     = 10
      desired_size = 2
      
      labels = {
        Environment = var.environment
        NodeGroup   = "spot"
      }
      
      taints = {
        spotInstance = {
          key    = "spot-instance"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      }
    }
  }

  # OIDC Provider
  enable_irsa = true

  tags = {
    Environment = var.environment
  }
}

# KMS Key for EKS encryption
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-eks-key"
  }
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${var.project_name}-${var.environment}-eks"
  target_key_id = aws_kms_key.eks.key_id
}

# RDS PostgreSQL Database
module "rds" {
  source = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "${var.project_name}-${var.environment}-db"

  # Database configuration
  engine               = "postgres"
  engine_version       = "15.4"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn

  # Database settings
  db_name  = var.db_name
  username = var.db_username
  port     = 5432

  # Password will be auto-generated and stored in Secrets Manager
  manage_master_user_password = true
  master_user_secret_kms_key_id = aws_kms_key.rds.arn

  # Network configuration
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [module.database_security_group.security_group_id]

  # Backup configuration
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:00-Sun:05:00"

  # Performance and monitoring
  performance_insights_enabled = true
  monitoring_interval         = 60
  monitoring_role_arn        = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Security
  deletion_protection      = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
  final_snapshot_identifier_prefix = "${var.project_name}-${var.environment}-final"

  tags = {
    Name = "${var.project_name}-${var.environment}-database"
  }
}

# RDS KMS Key
resource "aws_kms_key" "rds" {
  description             = "RDS encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-key"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# RDS Monitoring Role
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ElastiCache Redis Cluster
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-${var.environment}-redis"
  subnet_ids = module.vpc.elasticache_subnets
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  description                = "Redis cluster for FossaWork V2"
  
  node_type               = var.redis_node_type
  port                    = 6379
  parameter_group_name    = "default.redis7"
  
  num_cache_clusters      = var.redis_num_cache_nodes
  
  engine_version          = "7.0"
  
  # Security
  subnet_group_name       = aws_elasticache_subnet_group.redis.name
  security_group_ids      = [module.redis_security_group.security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token             = random_password.redis_auth_token.result
  
  # Backup
  automatic_failover_enabled = true
  multi_az_enabled          = true
  snapshot_retention_limit  = var.environment == "production" ? 7 : 1
  snapshot_window          = "03:00-05:00"
  
  # Maintenance
  maintenance_window = "sun:05:00-sun:07:00"
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}-redis/slow-log"
  retention_in_days = 30
}

# Application Load Balancer
module "alb" {
  source = "terraform-aws-modules/alb/aws"
  version = "~> 8.0"

  name = "${var.project_name}-${var.environment}-alb"

  load_balancer_type = "application"

  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.public_subnets
  security_groups = [module.alb_security_group.security_group_id]

  # SSL Certificate
  target_groups = [
    {
      name                 = "${var.project_name}-${var.environment}-tg"
      backend_protocol     = "HTTP"
      backend_port         = 80
      target_type          = "ip"
      deregistration_delay = 10
      
      health_check = {
        enabled             = true
        healthy_threshold   = 2
        interval            = 30
        matcher             = "200"
        path                = "/health"
        port                = "traffic-port"
        protocol            = "HTTP"
        timeout             = 5
        unhealthy_threshold = 2
      }
    }
  ]

  https_listeners = [
    {
      port               = 443
      protocol           = "HTTPS"
      certificate_arn    = aws_acm_certificate_validation.this.certificate_arn
      target_group_index = 0
    }
  ]

  http_tcp_listeners = [
    {
      port               = 80
      protocol           = "HTTP"
      target_group_index = 0
      action_type        = "redirect"
      redirect = {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# ACM Certificate
resource "aws_acm_certificate" "this" {
  domain_name       = var.domain_name
  validation_method = "DNS"
  
  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

# Route53 Domain Validation
resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.this.zone_id
}

data "aws_route53_zone" "this" {
  name         = var.domain_name
  private_zone = false
}

# S3 Bucket for static assets
module "s3_bucket" {
  source = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 3.0"

  bucket = "${var.project_name}-${var.environment}-assets-${random_id.bucket_suffix.hex}"

  # Versioning
  versioning = {
    enabled = true
  }

  # Server-side encryption
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        kms_master_key_id = aws_kms_key.s3.arn
        sse_algorithm     = "aws:kms"
      }
      bucket_key_enabled = true
    }
  }

  # Public access block
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  # Lifecycle configuration
  lifecycle_configuration = {
    rule = {
      id     = "delete_old_versions"
      status = "Enabled"
      
      noncurrent_version_expiration = {
        noncurrent_days = 30
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-assets"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 8
}

# S3 KMS Key
resource "aws_kms_key" "s3" {
  description             = "S3 bucket encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-s3-key"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.project_name}-${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "this" {
  origin {
    domain_name = module.s3_bucket.s3_bucket_bucket_domain_name
    origin_id   = "S3-${module.s3_bucket.s3_bucket_id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.this.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = [var.domain_name]

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${module.s3_bucket.s3_bucket_id}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # Price class
  price_class = var.environment == "production" ? "PriceClass_All" : "PriceClass_100"

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate_validation.this.certificate_arn
    ssl_support_method  = "sni-only"
  }

  # Logging
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "cloudfront/"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cloudfront"
  }
}

resource "aws_cloudfront_origin_access_identity" "this" {
  comment = "OAI for ${var.project_name}-${var.environment}"
}

# S3 bucket for CloudFront logs
resource "aws_s3_bucket" "cloudfront_logs" {
  bucket = "${var.project_name}-${var.environment}-cloudfront-logs-${random_id.logs_suffix.hex}"
}

resource "random_id" "logs_suffix" {
  byte_length = 8
}

resource "aws_s3_bucket_versioning" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  rule {
    id     = "delete_old_logs"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Secrets Manager for application secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}-${var.environment}-secrets"
  description             = "Application secrets for FossaWork V2"
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    database_url = "postgresql://${var.db_username}:${module.rds.db_instance_password}@${module.rds.db_instance_endpoint}/${var.db_name}"
    redis_url    = "redis://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
    jwt_secret   = random_password.jwt_secret.result
  })
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Secrets Manager KMS Key
resource "aws_kms_key" "secrets" {
  description             = "Secrets Manager encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets-key"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.project_name}-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}
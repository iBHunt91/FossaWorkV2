# VPC and Network Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnets
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = module.vpc.natgw_ids
}

# EKS Cluster Outputs
output "cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_version" {
  description = "The Kubernetes version for the EKS cluster"
  value       = module.eks.cluster_version
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster for the OpenID Connect identity provider"
  value       = module.eks.cluster_oidc_issuer_url
}

output "node_security_group_id" {
  description = "ID of the EKS node shared security group"
  value       = module.eks.node_security_group_id
}

output "eks_managed_node_groups" {
  description = "Map of attribute maps for all EKS managed node groups created"
  value       = module.eks.eks_managed_node_groups
  sensitive   = true
}

# Database Outputs
output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = module.rds.db_instance_id
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = module.rds.db_instance_arn
}

output "db_instance_username" {
  description = "RDS instance root username"
  value       = module.rds.db_instance_username
  sensitive   = true
}

output "db_subnet_group_name" {
  description = "RDS subnet group name"
  value       = module.rds.db_subnet_group_name
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_auth_token" {
  description = "Redis auth token"
  value       = random_password.redis_auth_token.result
  sensitive   = true
}

# Load Balancer Outputs
output "alb_arn" {
  description = "Application Load Balancer ARN"
  value       = module.alb.lb_arn
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.alb.lb_dns_name
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = module.alb.lb_zone_id
}

output "alb_target_groups" {
  description = "Target groups ARN"
  value       = module.alb.target_group_arns
}

# S3 and CloudFront Outputs
output "s3_bucket_id" {
  description = "S3 bucket ID"
  value       = module.s3_bucket.s3_bucket_id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3_bucket.s3_bucket_arn
}

output "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = module.s3_bucket.s3_bucket_bucket_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.this.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.this.domain_name
}

# Security Outputs
output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID"
  value       = aws_guardduty_detector.main.id
}

# SSL Certificate Outputs
output "acm_certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate_validation.this.certificate_arn
}

output "acm_certificate_status" {
  description = "ACM certificate status"
  value       = aws_acm_certificate.this.status
}

# Secrets Manager Outputs
output "secrets_manager_secret_arn" {
  description = "Secrets Manager secret ARN"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "secrets_manager_secret_name" {
  description = "Secrets Manager secret name"
  value       = aws_secretsmanager_secret.app_secrets.name
}

# KMS Key Outputs
output "eks_kms_key_arn" {
  description = "EKS KMS key ARN"
  value       = aws_kms_key.eks.arn
}

output "rds_kms_key_arn" {
  description = "RDS KMS key ARN"
  value       = aws_kms_key.rds.arn
}

output "s3_kms_key_arn" {
  description = "S3 KMS key ARN"
  value       = aws_kms_key.s3.arn
}

output "secrets_kms_key_arn" {
  description = "Secrets Manager KMS key ARN"
  value       = aws_kms_key.secrets.arn
}

# IAM Role Outputs
output "backend_service_account_role_arn" {
  description = "Backend service account IAM role ARN"
  value       = aws_iam_role.backend_service_account.arn
}

output "aws_load_balancer_controller_role_arn" {
  description = "AWS Load Balancer Controller IAM role ARN"
  value       = aws_iam_role.aws_load_balancer_controller.arn
}

output "cloudwatch_agent_role_arn" {
  description = "CloudWatch agent IAM role ARN"
  value       = aws_iam_role.cloudwatch_agent.arn
}

output "ebs_csi_driver_role_arn" {
  description = "EBS CSI driver IAM role ARN"
  value       = aws_iam_role.ebs_csi_driver.arn
}

# Monitoring Outputs
output "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "application_log_group_name" {
  description = "Application CloudWatch log group name"
  value       = aws_cloudwatch_log_group.application.name
}

output "nginx_log_group_name" {
  description = "Nginx CloudWatch log group name"
  value       = aws_cloudwatch_log_group.nginx.name
}

# Configuration Outputs for Applications
output "database_connection_string" {
  description = "Database connection string template"
  value       = "postgresql://${var.db_username}:{{password}}@${module.rds.db_instance_endpoint}:${module.rds.db_instance_port}/${var.db_name}"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string template"
  value       = "redis://:{{auth_token}}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  sensitive   = true
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

# Kubectl Configuration Command
output "kubectl_config_command" {
  description = "Command to configure kubectl for this cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}"
}

# Terraform State Information
output "terraform_state_bucket" {
  description = "Terraform state bucket name"
  value       = "fossawork-terraform-state"
}

output "terraform_state_key" {
  description = "Terraform state key"
  value       = "fossawork-v2/terraform.tfstate"
}

# Application URLs
output "application_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}

output "api_url" {
  description = "API URL"
  value       = "https://${var.domain_name}/api"
}

# Security Group IDs for reference
output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = module.alb_security_group.security_group_id
}

output "database_security_group_id" {
  description = "Database security group ID"
  value       = module.database_security_group.security_group_id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = module.redis_security_group.security_group_id
}

# Backup and Recovery Information
output "rds_automated_backup_arn" {
  description = "RDS automated backup ARN"
  value       = module.rds.db_instance_arn
}

output "s3_backup_bucket" {
  description = "S3 backup bucket name (if cross-region backup is enabled)"
  value       = var.enable_cross_region_backup ? aws_s3_bucket.cloudfront_logs.bucket : null
}

# Cost Optimization Information
output "spot_instances_enabled" {
  description = "Whether spot instances are enabled"
  value       = var.enable_spot_instances
}

output "autoscaling_enabled" {
  description = "Whether autoscaling is enabled"
  value       = var.enable_autoscaling
}

# Compliance and Governance
output "data_classification" {
  description = "Data classification level"
  value       = var.data_classification
}

output "compliance_standards" {
  description = "Compliance standards"
  value       = var.compliance_standards
}

# Health Check Endpoints
output "health_check_endpoints" {
  description = "Health check endpoints"
  value = {
    alb_health_check = "https://${var.domain_name}/health"
    api_health_check = "https://${var.domain_name}/api/health"
    database_health  = "${module.rds.db_instance_endpoint}:${module.rds.db_instance_port}"
    redis_health     = "${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  }
}

# Resource Counts for Cost Tracking
output "resource_counts" {
  description = "Count of major resources for cost tracking"
  value = {
    eks_nodes              = var.node_group_desired_size
    rds_instances         = 1
    redis_nodes           = var.redis_num_cache_nodes
    load_balancers        = 1
    s3_buckets           = 3 # Main bucket + logs + config
    cloudfront_distributions = 1
    kms_keys             = 4
    security_groups      = 3
  }
}

# Disaster Recovery Information
output "disaster_recovery_info" {
  description = "Disaster recovery configuration"
  value = {
    cross_region_backup_enabled = var.enable_cross_region_backup
    disaster_recovery_region     = var.disaster_recovery_region
    backup_retention_days        = var.backup_retention_period
    rds_backup_window           = var.backup_window
    rds_maintenance_window      = var.maintenance_window
  }
}
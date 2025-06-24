# Core Configuration Variables
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "fossawork"
}

variable "environment" {
  description = "Environment name (e.g., staging, production)"
  type        = string
  validation {
    condition = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
}

# EKS Configuration
variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.27"
}

variable "node_instance_types" {
  description = "Instance types for EKS worker nodes"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "spot_instance_types" {
  description = "Instance types for EKS spot worker nodes"
  type        = list(string)
  default     = ["t3.medium", "t3.large", "t3.xlarge"]
}

variable "node_group_min_size" {
  description = "Minimum number of nodes in the node group"
  type        = number
  default     = 1
}

variable "node_group_max_size" {
  description = "Maximum number of nodes in the node group"
  type        = number
  default     = 5
}

variable "node_group_desired_size" {
  description = "Desired number of nodes in the node group"
  type        = number
  default     = 2
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "List of CIDR blocks that can access the EKS cluster endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "RDS maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "fossawork"
}

variable "db_username" {
  description = "Database administrator username"
  type        = string
  default     = "fossawork_admin"
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster"
  type        = number
  default     = 2
}

# Domain and SSL Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "fossawork.com"
}

# Monitoring and Alerting
variable "alert_email_addresses" {
  description = "List of email addresses for CloudWatch alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30
}

# Security Configuration
variable "enable_waf" {
  description = "Enable AWS WAF for the load balancer"
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

# Application Configuration
variable "app_image_tag" {
  description = "Docker image tag for the application"
  type        = string
  default     = "latest"
}

variable "app_replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 2
}

variable "app_cpu_requests" {
  description = "CPU requests for application pods"
  type        = string
  default     = "100m"
}

variable "app_memory_requests" {
  description = "Memory requests for application pods"
  type        = string
  default     = "128Mi"
}

variable "app_cpu_limits" {
  description = "CPU limits for application pods"
  type        = string
  default     = "500m"
}

variable "app_memory_limits" {
  description = "Memory limits for application pods"
  type        = string
  default     = "512Mi"
}

# Backup and Disaster Recovery
variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup for critical resources"
  type        = bool
  default     = false
}

variable "disaster_recovery_region" {
  description = "AWS region for disaster recovery"
  type        = string
  default     = "us-west-2"
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization"
  type        = bool
  default     = true
}

variable "enable_autoscaling" {
  description = "Enable cluster autoscaling"
  type        = bool
  default     = true
}

# Feature Flags
variable "enable_container_insights" {
  description = "Enable Container Insights for EKS"
  type        = bool
  default     = true
}

variable "enable_pod_security_policy" {
  description = "Enable Pod Security Policy"
  type        = bool
  default     = true
}

variable "enable_network_policy" {
  description = "Enable Kubernetes Network Policies"
  type        = bool
  default     = true
}

variable "enable_secrets_encryption" {
  description = "Enable secrets encryption at rest"
  type        = bool
  default     = true
}

# Development/Testing Configuration
variable "create_test_data" {
  description = "Create test data and users (non-production only)"
  type        = bool
  default     = false
}

variable "enable_debug_logging" {
  description = "Enable debug level logging"
  type        = bool
  default     = false
}

variable "allow_ssh_access" {
  description = "Allow SSH access to worker nodes (non-production only)"
  type        = bool
  default     = false
}

# External Integrations
variable "external_secrets_operator_enabled" {
  description = "Enable External Secrets Operator"
  type        = bool
  default     = false
}

variable "cert_manager_enabled" {
  description = "Enable cert-manager for automatic SSL certificate management"
  type        = bool
  default     = true
}

variable "nginx_ingress_enabled" {
  description = "Enable NGINX Ingress Controller"
  type        = bool
  default     = true
}

variable "prometheus_enabled" {
  description = "Enable Prometheus monitoring stack"
  type        = bool
  default     = false
}

variable "grafana_enabled" {
  description = "Enable Grafana dashboards"
  type        = bool
  default     = false
}

# Load Balancer Configuration
variable "lb_deletion_protection" {
  description = "Enable deletion protection for load balancer"
  type        = bool
  default     = true
}

variable "lb_access_logs_enabled" {
  description = "Enable access logs for load balancer"
  type        = bool
  default     = true
}

variable "lb_idle_timeout" {
  description = "Load balancer idle timeout in seconds"
  type        = number
  default     = 60
}

# Auto Scaling Configuration
variable "target_cpu_utilization" {
  description = "Target CPU utilization for auto scaling"
  type        = number
  default     = 70
}

variable "target_memory_utilization" {
  description = "Target memory utilization for auto scaling"
  type        = number
  default     = 80
}

variable "scale_down_delay" {
  description = "Scale down delay in seconds"
  type        = number
  default     = 300
}

variable "scale_up_delay" {
  description = "Scale up delay in seconds"
  type        = number
  default     = 60
}

# Compliance and Governance
variable "required_tags" {
  description = "Required tags for all resources"
  type        = map(string)
  default = {
    Project     = "FossaWork-V2"
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
    CostCenter  = "Engineering"
  }
}

variable "data_classification" {
  description = "Data classification level"
  type        = string
  default     = "internal"
  validation {
    condition = contains(["public", "internal", "confidential", "restricted"], var.data_classification)
    error_message = "Data classification must be one of: public, internal, confidential, restricted."
  }
}

variable "compliance_standards" {
  description = "List of compliance standards to adhere to"
  type        = list(string)
  default     = ["SOC2", "GDPR"]
}

# Performance and Scaling
variable "database_performance_insights_retention" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS"
  type        = bool
  default     = true
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
  validation {
    condition = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "CloudFront price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

# Emergency and Disaster Recovery
variable "emergency_contact_email" {
  description = "Emergency contact email for critical alerts"
  type        = string
  default     = ""
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}
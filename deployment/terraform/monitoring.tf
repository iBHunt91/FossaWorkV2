# CloudWatch Dashboards and Alarms for comprehensive monitoring

# Application Dashboard
resource "aws_cloudwatch_dashboard" "application" {
  dashboard_name = "${var.project_name}-${var.environment}-application"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", module.alb.lb_arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", module.rds.db_instance_id],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Database Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", aws_elasticache_replication_group.redis.id],
            [".", "CurrConnections", ".", "."],
            [".", "NetworkBytesIn", ".", "."],
            [".", "NetworkBytesOut", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Redis Cache Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EKS", "cluster_node_count", "cluster_name", module.eks.cluster_id],
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", module.eks.eks_managed_node_groups.general.asg_name],
            [".", "MemoryUtilization", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EKS Cluster Metrics"
          period  = 300
        }
      }
    ]
  })
}

# Security Dashboard
resource "aws_cloudwatch_dashboard" "security" {
  dashboard_name = "${var.project_name}-${var.environment}-security"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/WAFV2", "AllowedRequests", "WebACL", aws_wafv2_web_acl.main.name, "Region", var.aws_region, "Rule", "ALL"],
            [".", "BlockedRequests", ".", ".", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "WAF Requests"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/GuardDuty", "FindingCount", "DetectorId", aws_guardduty_detector.main.id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "GuardDuty Findings"
          period  = 300
        }
      }
    ]
  })
}

# CloudWatch Alarms

# ALB High Response Time
resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2"
  alarm_description   = "This metric monitors ALB response time"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = module.alb.lb_arn_suffix
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-response-time"
  }
}

# ALB High 4XX Error Rate
resource "aws_cloudwatch_metric_alarm" "alb_4xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "50"
  alarm_description   = "This metric monitors ALB 4XX errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = module.alb.lb_arn_suffix
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-4xx-errors"
  }
}

# ALB High 5XX Error Rate
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors ALB 5XX errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = module.alb.lb_arn_suffix
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-5xx-errors"
  }
}

# RDS High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-cpu"
  }
}

# RDS High Connection Count
resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-connections"
  }
}

# RDS Free Storage Space
resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000000000" # 10GB in bytes
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-storage"
  }
}

# Redis High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.redis.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-cpu"
  }
}

# EKS Node High CPU
resource "aws_cloudwatch_metric_alarm" "eks_node_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-eks-node-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors EKS node CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    AutoScalingGroupName = module.eks.eks_managed_node_groups.general.asg_name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-eks-cpu"
  }
}

# WAF Blocked Requests Spike
resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  alarm_name          = "${var.project_name}-${var.environment}-waf-blocked-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"
  alarm_description   = "This metric monitors WAF blocked requests"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = var.aws_region
    Rule   = "ALL"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-blocked"
  }
}

# GuardDuty Findings
resource "aws_cloudwatch_metric_alarm" "guardduty_findings" {
  alarm_name          = "${var.project_name}-${var.environment}-guardduty-findings"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FindingCount"
  namespace           = "AWS/GuardDuty"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors GuardDuty findings"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DetectorId = aws_guardduty_detector.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-guardduty"
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Name = "${var.project_name}-${var.environment}-alerts"
  }
}

# SNS Topic Subscription for Email Alerts
resource "aws_sns_topic_subscription" "email_alerts" {
  count     = length(var.alert_email_addresses)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email_addresses[count.index]
}

# SNS Topic Subscription for Slack (if webhook URL provided)
resource "aws_sns_topic_subscription" "slack_alerts" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/eks/${var.project_name}-${var.environment}/application"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-app-logs"
  }
}

resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/aws/eks/${var.project_name}-${var.environment}/nginx"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-nginx-logs"
  }
}

# CloudWatch Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.project_name}-${var.environment}-error-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
EOF
}

resource "aws_cloudwatch_query_definition" "top_endpoints" {
  name = "${var.project_name}-${var.environment}-top-endpoints"

  log_group_names = [
    aws_cloudwatch_log_group.nginx.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| parse @message /(?<ip>\S+) \S+ \S+ \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<url>\S+) \S+" (?<status>\d+) (?<size>\d+)/
| stats count() as requests by url
| sort requests desc
| limit 10
EOF
}

# X-Ray Tracing
resource "aws_xray_sampling_rule" "main" {
  rule_name      = "${var.project_name}-${var.environment}-sampling"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = {
    Name = "${var.project_name}-${var.environment}-xray-sampling"
  }
}

# Application Performance Monitoring with Container Insights
resource "aws_ecs_cluster_capacity_providers" "container_insights" {
  cluster_name = module.eks.cluster_id

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 0
  }
}

# Lambda function for custom metrics
resource "aws_lambda_function" "custom_metrics" {
  filename         = "custom_metrics.zip"
  function_name    = "${var.project_name}-${var.environment}-custom-metrics"
  role            = aws_iam_role.lambda_metrics.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.lambda_metrics.output_base64sha256
  runtime         = "python3.9"
  timeout         = 60

  environment {
    variables = {
      CLUSTER_NAME = module.eks.cluster_id
      REGION       = var.aws_region
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-custom-metrics"
  }
}

data "archive_file" "lambda_metrics" {
  type        = "zip"
  output_path = "custom_metrics.zip"
  source {
    content  = <<EOF
import json
import boto3
import os

def handler(event, context):
    cloudwatch = boto3.client('cloudwatch')
    
    # Custom metric logic here
    cloudwatch.put_metric_data(
        Namespace='FossaWork/Application',
        MetricData=[
            {
                'MetricName': 'CustomMetric',
                'Value': 1,
                'Unit': 'Count'
            }
        ]
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps('Custom metrics sent')
    }
EOF
    filename = "index.py"
  }
}

resource "aws_iam_role" "lambda_metrics" {
  name = "${var.project_name}-${var.environment}-lambda-metrics"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_metrics" {
  name = "${var.project_name}-${var.environment}-lambda-metrics-policy"
  role = aws_iam_role.lambda_metrics.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster"
        ]
        Resource = module.eks.cluster_arn
      }
    ]
  })
}

# EventBridge rule to trigger custom metrics
resource "aws_cloudwatch_event_rule" "custom_metrics_schedule" {
  name                = "${var.project_name}-${var.environment}-custom-metrics"
  description         = "Trigger custom metrics collection"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Name = "${var.project_name}-${var.environment}-custom-metrics-rule"
  }
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.custom_metrics_schedule.name
  target_id = "CustomMetricsTarget"
  arn       = aws_lambda_function.custom_metrics.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.custom_metrics.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.custom_metrics_schedule.arn
}
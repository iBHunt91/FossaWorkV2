#!/usr/bin/env python3
"""
Setup script for monitoring and alerting infrastructure
Configures monitoring components for production deployment
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.monitoring.alert_manager import AlertManager, AlertRule
from app.monitoring.health_checker import HealthChecker, HealthCheck
from app.core.logging import logger


def setup_production_monitoring():
    """Set up monitoring for production environment"""
    print("🚀 Setting up production monitoring...")
    
    # Environment variables for production
    env_vars = {
        "MONITORING_ENABLED": "true",
        "SECURITY_MONITORING_ENABLED": "true", 
        "ALERT_EMAIL_ENABLED": "true",
        "ALERT_PUSHOVER_ENABLED": "true",
        "METRICS_RETENTION_HOURS": "168",  # 7 days
        "HEALTH_CHECK_INTERVAL": "60",     # 1 minute
        "ALERT_COOLDOWN_MINUTES": "15",
        "SECURITY_INCIDENT_THRESHOLD": "10",
        "PERFORMANCE_THRESHOLD_MS": "1000"
    }
    
    print("📝 Recommended production environment variables:")
    for key, value in env_vars.items():
        print(f"export {key}={value}")
    
    return env_vars


def setup_development_monitoring():
    """Set up monitoring for development environment"""
    print("🔧 Setting up development monitoring...")
    
    env_vars = {
        "MONITORING_ENABLED": "true",
        "SECURITY_MONITORING_ENABLED": "false",  # Less strict in dev
        "ALERT_EMAIL_ENABLED": "false",
        "ALERT_PUSHOVER_ENABLED": "false", 
        "METRICS_RETENTION_HOURS": "24",   # 1 day
        "HEALTH_CHECK_INTERVAL": "300",    # 5 minutes
        "ALERT_COOLDOWN_MINUTES": "60",    # Longer cooldown
        "SECURITY_INCIDENT_THRESHOLD": "50",  # Higher threshold
        "PERFORMANCE_THRESHOLD_MS": "2000"    # More lenient
    }
    
    print("📝 Recommended development environment variables:")
    for key, value in env_vars.items():
        print(f"export {key}={value}")
    
    return env_vars


def create_nginx_monitoring_config():
    """Create nginx configuration for monitoring endpoints"""
    config = """
# Monitoring and health check configuration
location /api/v1/monitoring/health {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # Health check specific settings
    proxy_connect_timeout 5s;
    proxy_send_timeout 5s;
    proxy_read_timeout 5s;
    
    # Don't cache health checks
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}

location /api/v1/monitoring/status {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # Public status endpoint
    proxy_connect_timeout 10s;
    proxy_send_timeout 10s;
    proxy_read_timeout 10s;
}

# Protected monitoring endpoints (admin only)
location /api/v1/monitoring/ {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # Longer timeout for detailed monitoring
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    # Rate limiting for monitoring endpoints
    limit_req zone=api burst=20 nodelay;
}
"""
    
    print("📄 Nginx monitoring configuration:")
    print(config)
    return config


def create_systemd_health_check():
    """Create systemd service for regular health checks"""
    service_content = """[Unit]
Description=FossaWork V2 Health Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -f http://localhost:8000/api/v1/monitoring/health
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
"""
    
    timer_content = """[Unit]
Description=FossaWork V2 Health Check Timer
Requires=fossawork-health-check.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=1min
AccuracySec=1s

[Install]
WantedBy=timers.target
"""
    
    print("⏰ Systemd health check service:")
    print("File: /etc/systemd/system/fossawork-health-check.service")
    print(service_content)
    print("\nFile: /etc/systemd/system/fossawork-health-check.timer")
    print(timer_content)
    
    return service_content, timer_content


def create_grafana_dashboard():
    """Create Grafana dashboard configuration"""
    dashboard = {
        "dashboard": {
            "title": "FossaWork V2 Monitoring",
            "tags": ["fossawork", "monitoring"],
            "panels": [
                {
                    "title": "Health Status",
                    "type": "stat",
                    "targets": [
                        {
                            "expr": "fossawork_health_status",
                            "legendFormat": "Health"
                        }
                    ]
                },
                {
                    "title": "Request Rate",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "rate(fossawork_requests_total[5m])",
                            "legendFormat": "Requests/sec"
                        }
                    ]
                },
                {
                    "title": "Response Times",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "fossawork_request_duration_seconds",
                            "legendFormat": "Response Time"
                        }
                    ]
                },
                {
                    "title": "Error Rate",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "rate(fossawork_errors_total[5m])",
                            "legendFormat": "Errors/sec"
                        }
                    ]
                },
                {
                    "title": "Security Events",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "fossawork_security_events_total",
                            "legendFormat": "Security Events"
                        }
                    ]
                }
            ]
        }
    }
    
    print("📊 Grafana dashboard configuration:")
    print(json.dumps(dashboard, indent=2))
    return dashboard


def setup_log_rotation():
    """Set up log rotation for monitoring logs"""
    logrotate_config = """
/var/log/fossawork/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    postrotate
        systemctl reload nginx
        systemctl restart fossawork-v2
    endscript
}

/var/log/fossawork/security/*.log {
    hourly
    missingok
    rotate 168
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    maxage 7
}
"""
    
    print("📋 Logrotate configuration:")
    print("File: /etc/logrotate.d/fossawork")
    print(logrotate_config)
    return logrotate_config


def test_monitoring_setup():
    """Test monitoring component setup"""
    print("🧪 Testing monitoring setup...")
    
    try:
        # Test alert manager
        alert_manager = AlertManager()
        print("✅ AlertManager initialized successfully")
        
        # Test health checker
        health_checker = HealthChecker()
        print("✅ HealthChecker initialized successfully")
        
        # Test custom alert rule
        test_rule = AlertRule(
            name="Test Alert",
            condition=lambda m: False,  # Never trigger
            severity="info",
            message_template="Test alert: {test_value}"
        )
        alert_manager.add_rule(test_rule)
        print("✅ Custom alert rule added successfully")
        
        # Test health check
        test_check = HealthCheck(
            name="test_check",
            check_function=lambda: {"healthy": True},
            critical=False
        )
        health_checker.add_check(test_check)
        print("✅ Custom health check added successfully")
        
        print("🎉 All monitoring components tested successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Monitoring setup test failed: {e}")
        return False


def main():
    """Main setup function"""
    parser = argparse.ArgumentParser(description="Setup FossaWork V2 monitoring")
    parser.add_argument(
        "--environment", 
        choices=["development", "production"],
        default="development",
        help="Environment to configure"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test monitoring setup"
    )
    parser.add_argument(
        "--nginx",
        action="store_true", 
        help="Generate nginx configuration"
    )
    parser.add_argument(
        "--systemd",
        action="store_true",
        help="Generate systemd service files"
    )
    parser.add_argument(
        "--grafana", 
        action="store_true",
        help="Generate Grafana dashboard"
    )
    parser.add_argument(
        "--logrotate",
        action="store_true",
        help="Generate logrotate configuration"
    )
    
    args = parser.parse_args()
    
    print(f"🔧 Setting up monitoring for {args.environment} environment")
    
    # Set up environment-specific monitoring
    if args.environment == "production":
        env_vars = setup_production_monitoring()
    else:
        env_vars = setup_development_monitoring()
    
    # Generate configurations
    if args.nginx:
        create_nginx_monitoring_config()
    
    if args.systemd:
        create_systemd_health_check()
    
    if args.grafana:
        create_grafana_dashboard()
    
    if args.logrotate:
        setup_log_rotation()
    
    # Test setup
    if args.test:
        success = test_monitoring_setup()
        sys.exit(0 if success else 1)
    
    print("\n✅ Monitoring setup completed!")
    print("\nNext steps:")
    print("1. Set the recommended environment variables")
    print("2. Configure notification channels (SMTP, Pushover)")  
    print("3. Set up reverse proxy with monitoring endpoints")
    print("4. Configure log rotation and retention")
    print("5. Set up external monitoring (Grafana, Prometheus)")
    print("6. Test alert notifications")


if __name__ == "__main__":
    main()
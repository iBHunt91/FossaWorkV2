# Monitoring Runbook

## Overview

This runbook provides comprehensive monitoring procedures for FossaWork V2, including system metrics, application performance, security events, and alerting configurations. It covers proactive monitoring, reactive troubleshooting, and maintenance procedures.

## Monitoring Architecture

### Components Overview

**Application Monitoring:**
- **Frontend:** Browser performance, user interactions, error tracking
- **Backend:** API response times, database queries, business logic performance
- **Database:** Query performance, connection pools, data integrity
- **External Services:** WorkFossa API, email services, notification services

**Infrastructure Monitoring:**
- **System Resources:** CPU, memory, disk, network
- **Process Health:** Service status, resource consumption
- **Network:** Connectivity, latency, throughput
- **Security:** Authentication events, rate limiting, anomaly detection

### Monitoring Stack

**Data Collection:**
- **Logs:** Structured JSON logging to `/logs/` directory
- **Metrics:** Custom application metrics and system metrics
- **Events:** Security events, business events, system events
- **Traces:** Request tracing for performance analysis

**Storage and Analysis:**
- **Local Storage:** JSONL files with date-based rotation
- **Analysis Tools:** Custom Python scripts for log analysis
- **Alerting:** Email, Pushover, desktop notifications
- **Dashboards:** Web-based monitoring interface

## Key Metrics and Thresholds

### Application Performance Metrics

**API Response Times:**
```yaml
Targets:
  - 95th percentile: < 2 seconds
  - 99th percentile: < 5 seconds
  - Average: < 1 second

Warning Thresholds:
  - 95th percentile: > 3 seconds
  - 99th percentile: > 7 seconds
  - Average: > 2 seconds

Critical Thresholds:
  - 95th percentile: > 10 seconds
  - 99th percentile: > 15 seconds
  - Average: > 5 seconds
```

**Error Rates:**
```yaml
Normal: < 1%
Warning: 1-5%
Critical: > 5%

HTTP Status Codes:
  4xx errors: < 2%
  5xx errors: < 0.5%
```

**Business Metrics:**
```yaml
Form Automation Success Rate:
  Normal: > 95%
  Warning: 90-95%
  Critical: < 90%

Work Order Sync Success Rate:
  Normal: > 98%
  Warning: 95-98%
  Critical: < 95%

Authentication Success Rate:
  Normal: > 99%
  Warning: 95-99%
  Critical: < 95%
```

### System Resource Metrics

**CPU Utilization:**
```yaml
Normal: < 70%
Warning: 70-85%
Critical: > 85%
```

**Memory Utilization:**
```yaml
Normal: < 80%
Warning: 80-90%
Critical: > 90%
```

**Disk Utilization:**
```yaml
Normal: < 80%
Warning: 80-90%
Critical: > 90%
```

**Database Metrics:**
```yaml
Connection Pool:
  Normal: < 80% of max connections
  Warning: 80-90%
  Critical: > 90%

Query Response Time:
  Normal: < 100ms
  Warning: 100-500ms
  Critical: > 500ms
```

## Monitoring Procedures

### Continuous Monitoring

**Automated Health Checks:**
```bash
#!/bin/bash
# /tools/operations/continuous-monitoring.sh

# Run every 5 minutes via cron
# */5 * * * * /tools/operations/continuous-monitoring.sh

# System health check
python /tools/operations/health-check.py --quiet

# Performance monitoring
python /tools/operations/performance-monitor.py --check-thresholds

# Security monitoring
python /tools/operations/security-monitor.py --scan-recent

# Log analysis
python /tools/operations/log-analyzer.py --check-errors --last-5min

# Custom business metrics
python /tools/operations/business-metrics-check.py
```

**Real-time Monitoring Dashboard:**
```bash
# Start monitoring dashboard
python /tools/operations/monitoring-dashboard.py --port 9090
```

### Log Monitoring

**Log Analysis Procedures:**
```bash
# Error analysis
python /tools/operations/log-analyzer.py --errors --last-hour

# Performance issues
python /tools/operations/log-analyzer.py --slow-queries --threshold=1000ms

# Security events
python /tools/operations/log-analyzer.py --security --suspicious

# Business events
python /tools/operations/log-analyzer.py --business-events --summary
```

**Log Rotation and Cleanup:**
```bash
#!/bin/bash
# /tools/operations/log-maintenance.sh

# Compress old logs
find /logs -name "*.jsonl" -mtime +7 -exec gzip {} \;

# Archive compressed logs
find /logs -name "*.gz" -mtime +30 -exec mv {} /archives/logs/ \;

# Clean up very old archives
find /archives/logs -name "*.gz" -mtime +90 -delete

# Check log disk usage
du -sh /logs
```

### Performance Monitoring

**Application Performance Analysis:**
```bash
# Response time analysis
python /tools/operations/analyze-response-times.py --last-24h

# Database performance
python /tools/operations/analyze-database-performance.py

# Memory usage patterns
python /tools/operations/analyze-memory-usage.py

# Resource utilization trends
python /tools/operations/analyze-resource-trends.py
```

**Performance Baseline Monitoring:**
```bash
# Establish performance baseline
python /tools/operations/establish-baseline.py

# Compare against baseline
python /tools/operations/compare-to-baseline.py --alert-on-deviation=20%

# Update baseline (monthly)
python /tools/operations/update-baseline.py --confirm
```

## Alerting Configuration

### Alert Severity Levels

**Critical Alerts (Immediate Response):**
- System down/inaccessible
- Database connection failures
- Security breach indicators
- Data corruption detected
- Error rate > 10%

**High Priority Alerts (15-minute response):**
- Performance degradation > 50%
- Authentication failures spike
- Disk space > 90%
- Memory usage > 90%
- Form automation failure rate > 10%

**Medium Priority Alerts (1-hour response):**
- Performance degradation 20-50%
- Disk space 80-90%
- Memory usage 80-90%
- Form automation failure rate 5-10%

**Low Priority Alerts (4-hour response):**
- Performance degradation 10-20%
- Warning thresholds reached
- Non-critical service issues

### Alert Routing

**Email Alerts:**
```python
# /tools/operations/email-alerting.py
ALERT_RECIPIENTS = {
    'critical': ['ops-team@company.com', 'oncall@company.com'],
    'high': ['ops-team@company.com'],
    'medium': ['ops-team@company.com'],
    'low': ['ops-team@company.com']
}
```

**Pushover Alerts:**
```python
# /tools/operations/pushover-alerting.py
PUSHOVER_CONFIG = {
    'critical': {'priority': 2, 'retry': 30, 'expire': 3600},
    'high': {'priority': 1},
    'medium': {'priority': 0},
    'low': {'priority': -1}
}
```

**Desktop Alerts:**
```bash
# Critical alerts trigger desktop notifications
python /tools/operations/desktop-alert.py --message="CRITICAL: System down" --urgent
```

### Alert Suppression

**Maintenance Mode Suppression:**
```bash
# Suppress alerts during maintenance
python /tools/operations/suppress-alerts.py --maintenance-mode --duration=2h

# Re-enable alerts
python /tools/operations/enable-alerts.py
```

**Alert Storm Prevention:**
```python
# /tools/operations/alert-storm-prevention.py
RATE_LIMITS = {
    'same_alert': {'max_count': 5, 'time_window': 300},  # 5 alerts per 5 minutes
    'total_alerts': {'max_count': 20, 'time_window': 600}  # 20 alerts per 10 minutes
}
```

## Security Monitoring

### Security Event Detection

**Authentication Monitoring:**
```bash
# Monitor authentication events
python /tools/operations/auth-monitoring.py --realtime

# Failed login analysis
python /tools/operations/analyze-failed-logins.py --threshold=5 --timeframe=15min

# Suspicious authentication patterns
python /tools/operations/detect-auth-anomalies.py
```

**Rate Limiting Monitoring:**
```bash
# Monitor rate limit hits
python /tools/operations/rate-limit-monitoring.py

# Analyze rate limit patterns
python /tools/operations/analyze-rate-limits.py --top-ips=10
```

**Anomaly Detection:**
```bash
# User behavior anomalies
python /tools/operations/detect-user-anomalies.py

# System access anomalies
python /tools/operations/detect-access-anomalies.py

# Data access pattern anomalies
python /tools/operations/detect-data-anomalies.py
```

### Security Alerting

**Real-time Security Alerts:**
```bash
# Configure security event alerting
python /tools/operations/configure-security-alerts.py

# Test security alert pipeline
python /tools/operations/test-security-alerts.py
```

**Security Metrics Dashboard:**
```bash
# Start security monitoring dashboard
python /tools/operations/security-dashboard.py --port 9091
```

## Business Metrics Monitoring

### Work Order Processing

**Success Rate Monitoring:**
```bash
# Monitor work order processing success rates
python /tools/operations/monitor-work-orders.py

# Analyze processing failures
python /tools/operations/analyze-work-order-failures.py

# Form automation success tracking
python /tools/operations/track-automation-success.py
```

**Performance Metrics:**
```bash
# Work order processing times
python /tools/operations/analyze-processing-times.py

# Form automation performance
python /tools/operations/analyze-automation-performance.py

# Data synchronization metrics
python /tools/operations/analyze-sync-performance.py
```

### User Activity Monitoring

**Usage Analytics:**
```bash
# User activity analysis
python /tools/operations/analyze-user-activity.py

# Feature usage statistics
python /tools/operations/feature-usage-stats.py

# Session analysis
python /tools/operations/analyze-user-sessions.py
```

## Monitoring Tools and Scripts

### Health Check Tool

```python
#!/usr/bin/env python3
# /tools/operations/health-check.py

import requests
import sqlite3
import json
import sys
from datetime import datetime

def check_backend_health():
    """Check backend API health"""
    try:
        response = requests.get('http://localhost:8000/api/health', timeout=5)
        return response.status_code == 200
    except:
        return False

def check_database_health():
    """Check database connectivity"""
    try:
        conn = sqlite3.connect('/backend/fossawork_v2.db')
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        conn.close()
        return True
    except:
        return False

def check_frontend_health():
    """Check frontend availability"""
    try:
        response = requests.get('http://localhost:5173/', timeout=5)
        return response.status_code == 200
    except:
        return False

def main():
    health_status = {
        'timestamp': datetime.utcnow().isoformat(),
        'backend': check_backend_health(),
        'database': check_database_health(),
        'frontend': check_frontend_health()
    }
    
    # Log health status
    with open('/logs/health-checks.jsonl', 'a') as f:
        f.write(json.dumps(health_status) + '\n')
    
    # Exit with error if any component is unhealthy
    if not all(health_status.values()):
        sys.exit(1)
    
    print("All systems healthy")

if __name__ == '__main__':
    main()
```

### Performance Monitor Tool

```python
#!/usr/bin/env python3
# /tools/operations/performance-monitor.py

import psutil
import requests
import json
import time
from datetime import datetime

def collect_system_metrics():
    """Collect system performance metrics"""
    return {
        'cpu_percent': psutil.cpu_percent(interval=1),
        'memory_percent': psutil.virtual_memory().percent,
        'disk_percent': psutil.disk_usage('/').percent,
        'network_io': psutil.net_io_counters()._asdict()
    }

def collect_application_metrics():
    """Collect application performance metrics"""
    try:
        # Test API response time
        start_time = time.time()
        response = requests.get('http://localhost:8000/api/health')
        response_time = time.time() - start_time
        
        return {
            'api_response_time': response_time,
            'api_status_code': response.status_code
        }
    except:
        return {
            'api_response_time': None,
            'api_status_code': None
        }

def main():
    metrics = {
        'timestamp': datetime.utcnow().isoformat(),
        'system': collect_system_metrics(),
        'application': collect_application_metrics()
    }
    
    # Log metrics
    with open('/logs/performance-metrics.jsonl', 'a') as f:
        f.write(json.dumps(metrics) + '\n')
    
    # Check thresholds and alert if necessary
    if metrics['system']['cpu_percent'] > 85:
        print(f"HIGH CPU USAGE: {metrics['system']['cpu_percent']}%")
    
    if metrics['system']['memory_percent'] > 85:
        print(f"HIGH MEMORY USAGE: {metrics['system']['memory_percent']}%")
    
    if metrics['application']['api_response_time'] and metrics['application']['api_response_time'] > 5:
        print(f"SLOW API RESPONSE: {metrics['application']['api_response_time']}s")

if __name__ == '__main__':
    main()
```

### Log Analyzer Tool

```python
#!/usr/bin/env python3
# /tools/operations/log-analyzer.py

import json
import glob
import argparse
from datetime import datetime, timedelta
from collections import defaultdict

def analyze_errors(timeframe_hours=1):
    """Analyze error logs for the specified timeframe"""
    cutoff_time = datetime.utcnow() - timedelta(hours=timeframe_hours)
    error_count = defaultdict(int)
    
    # Read error logs
    for log_file in glob.glob('/logs/errors/*.jsonl'):
        with open(log_file, 'r') as f:
            for line in f:
                try:
                    log_entry = json.loads(line)
                    log_time = datetime.fromisoformat(log_entry['timestamp'].replace('Z', '+00:00'))
                    
                    if log_time > cutoff_time:
                        error_type = log_entry.get('error_type', 'unknown')
                        error_count[error_type] += 1
                except:
                    continue
    
    return dict(error_count)

def analyze_performance(timeframe_hours=1):
    """Analyze performance metrics"""
    cutoff_time = datetime.utcnow() - timedelta(hours=timeframe_hours)
    slow_requests = []
    
    # Read performance logs
    for log_file in glob.glob('/logs/performance/*.jsonl'):
        with open(log_file, 'r') as f:
            for line in f:
                try:
                    log_entry = json.loads(line)
                    log_time = datetime.fromisoformat(log_entry['timestamp'].replace('Z', '+00:00'))
                    
                    if log_time > cutoff_time:
                        response_time = log_entry.get('response_time', 0)
                        if response_time > 2:  # Slow request threshold
                            slow_requests.append(log_entry)
                except:
                    continue
    
    return slow_requests

def main():
    parser = argparse.ArgumentParser(description='Analyze application logs')
    parser.add_argument('--errors', action='store_true', help='Analyze error logs')
    parser.add_argument('--performance', action='store_true', help='Analyze performance logs')
    parser.add_argument('--timeframe', type=int, default=1, help='Timeframe in hours')
    
    args = parser.parse_args()
    
    if args.errors:
        errors = analyze_errors(args.timeframe)
        print(f"Error analysis for last {args.timeframe} hour(s):")
        for error_type, count in errors.items():
            print(f"  {error_type}: {count}")
    
    if args.performance:
        slow_requests = analyze_performance(args.timeframe)
        print(f"Performance analysis for last {args.timeframe} hour(s):")
        print(f"  Slow requests (>2s): {len(slow_requests)}")

if __name__ == '__main__':
    main()
```

## Monitoring Maintenance

### Daily Monitoring Tasks

```bash
#!/bin/bash
# /tools/operations/daily-monitoring-maintenance.sh

# Review overnight alerts
python /tools/operations/review-alerts.py --last-24h

# Check monitoring system health
python /tools/operations/check-monitoring-health.py

# Validate log rotation
python /tools/operations/validate-log-rotation.py

# Update monitoring thresholds if needed
python /tools/operations/review-thresholds.py
```

### Weekly Monitoring Tasks

```bash
#!/bin/bash
# /tools/operations/weekly-monitoring-maintenance.sh

# Generate weekly monitoring report
python /tools/operations/generate-monitoring-report.py --weekly

# Review and tune alert thresholds
python /tools/operations/tune-alert-thresholds.py

# Clean up old monitoring data
python /tools/operations/cleanup-monitoring-data.py --older-than=30days

# Update monitoring dashboards
python /tools/operations/update-monitoring-dashboards.py
```

### Monthly Monitoring Tasks

```bash
#!/bin/bash
# /tools/operations/monthly-monitoring-maintenance.sh

# Comprehensive monitoring system review
python /tools/operations/monitoring-system-review.py

# Update performance baselines
python /tools/operations/update-performance-baselines.py

# Review monitoring coverage
python /tools/operations/review-monitoring-coverage.py

# Generate monthly monitoring report
python /tools/operations/generate-monitoring-report.py --monthly
```

## Troubleshooting Monitoring Issues

### Common Monitoring Problems

**Missing Metrics:**
```bash
# Check metric collection
python /tools/operations/check-metric-collection.py

# Restart metric collectors
python /tools/operations/restart-metric-collectors.py

# Verify metric storage
python /tools/operations/verify-metric-storage.py
```

**Alert Storm Issues:**
```bash
# Identify alert storms
python /tools/operations/identify-alert-storms.py

# Implement emergency suppression
python /tools/operations/emergency-alert-suppression.py

# Analyze alert patterns
python /tools/operations/analyze-alert-patterns.py
```

**Performance Monitoring Issues:**
```bash
# Debug performance monitoring
python /tools/operations/debug-performance-monitoring.py

# Check monitoring overhead
python /tools/operations/check-monitoring-overhead.py

# Optimize monitoring efficiency
python /tools/operations/optimize-monitoring.py
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Monitoring Team
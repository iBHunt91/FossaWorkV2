# Daily Operations Procedures

## Overview

This document outlines the daily operational procedures for FossaWork V2 to ensure system reliability, security, and optimal performance. These procedures should be performed every business day.

## Daily Operations Checklist

### Morning Operations (Start of Business Day)

**Time Required:** 15-20 minutes  
**Responsible:** Operations Team  
**Frequency:** Every business day at 8:00 AM

#### System Health Verification

```bash
#!/bin/bash
# Daily morning health check

echo "=== FossaWork V2 Daily Health Check ==="
echo "Date: $(date)"
echo "Operator: $USER"

# 1. Check service status
echo -e "\n1. Service Status:"
sudo systemctl status fossawork-backend --no-pager -l
sudo systemctl status fossawork-frontend --no-pager -l

# 2. Check system resources
echo -e "\n2. System Resources:"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"

# 3. Check database connectivity
echo -e "\n3. Database Status:"
python3 -c "
import sqlite3
try:
    conn = sqlite3.connect('/backend/fossawork_v2.db', timeout=5)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM work_orders')
    count = cursor.fetchone()[0]
    print(f'Database accessible: {count} work orders')
    conn.close()
except Exception as e:
    print(f'Database error: {e}')
"

# 4. Check API endpoints
echo -e "\n4. API Endpoints:"
curl -s -o /dev/null -w "Health endpoint: %{http_code}\n" http://localhost:8000/api/health
curl -s -o /dev/null -w "Work Orders endpoint: %{http_code}\n" http://localhost:8000/api/work-orders

# 5. Check log file sizes
echo -e "\n5. Log File Status:"
du -sh /logs/* | sort -hr | head -5

echo -e "\n=== Health Check Complete ==="
```

**✅ Checklist Items:**
- [ ] All services running and responsive
- [ ] System resources within acceptable ranges
- [ ] Database connectivity verified
- [ ] API endpoints responding correctly
- [ ] Log files not consuming excessive disk space
- [ ] No critical alerts from overnight

#### Security Status Review

```bash
#!/bin/bash
# Daily security status check

echo "=== Daily Security Status Review ==="

# Check authentication logs
echo "1. Authentication Events (Last 24 hours):"
python3 /tools/operations/analyze-auth-logs.py --last-24h

# Check failed login attempts
echo -e "\n2. Failed Login Attempts:"
grep -c "authentication failed" /logs/backend/*.jsonl | tail -5

# Check rate limiting events
echo -e "\n3. Rate Limiting Events:"
grep -c "rate limit" /logs/backend/*.jsonl | tail -5

# Check for suspicious activities
echo -e "\n4. Security Alerts:"
python3 /tools/operations/security-monitor.py --daily-report

echo "=== Security Review Complete ==="
```

**✅ Checklist Items:**
- [ ] No unusual authentication patterns
- [ ] Failed login attempts within normal range
- [ ] No rate limiting abuse detected
- [ ] Security monitoring systems operational
- [ ] No new security alerts requiring attention

#### Performance Baseline Verification

```bash
#!/bin/bash
# Daily performance baseline check

echo "=== Daily Performance Baseline Check ==="

# Run performance benchmark
python3 /tools/operations/performance-benchmark.py --quick

# Check response times
echo -e "\nAPI Response Times:"
python3 /tools/operations/test-api-performance.py --summary

# Check automation success rates
echo -e "\nAutomation Performance:"
python3 /tools/operations/analyze-automation-performance.py --last-24h

echo "=== Performance Check Complete ==="
```

**✅ Checklist Items:**
- [ ] API response times within acceptable range
- [ ] Database query performance normal
- [ ] Form automation success rate >95%
- [ ] No performance degradation trends
- [ ] Resource utilization stable

### Midday Operations (12:00 PM)

**Time Required:** 10 minutes  
**Responsible:** Operations Team  
**Frequency:** Every business day at 12:00 PM

#### System Monitoring Review

```bash
#!/bin/bash
# Midday monitoring review

echo "=== Midday System Review ==="
echo "Time: $(date)"

# Check current system load
echo "1. Current System Load:"
uptime
w

# Check active processes
echo -e "\n2. High Resource Processes:"
ps aux --sort=-%cpu | head -10

# Check recent errors
echo -e "\n3. Recent Errors (Last 4 hours):"
find /logs/errors -name "*.jsonl" -mmin -240 -exec wc -l {} \; | awk '{sum+=$1} END {print "Total errors: " sum}'

# Check disk space trends
echo -e "\n4. Disk Space Trends:"
df -h / | awk 'NR==2{print "Root partition: " $5 " used"}'

echo "=== Midday Review Complete ==="
```

**✅ Checklist Items:**
- [ ] System load acceptable
- [ ] No resource-intensive runaway processes
- [ ] Error rates remain low
- [ ] Disk space usage stable
- [ ] All monitoring systems functional

#### User Activity Analysis

```python
#!/usr/bin/env python3
# Midday user activity analysis

import json
from datetime import datetime, timedelta
from collections import defaultdict

def analyze_user_activity():
    print("=== User Activity Analysis ===")
    
    # Analyze login patterns
    login_count = defaultdict(int)
    active_sessions = 0
    
    try:
        with open('/logs/backend/backend-api-latest.jsonl', 'r') as f:
            for line in f:
                try:
                    log_entry = json.loads(line)
                    if 'login' in log_entry.get('endpoint', ''):
                        user = log_entry.get('user', 'unknown')
                        login_count[user] += 1
                except:
                    continue
        
        print(f"Active users today: {len(login_count)}")
        print(f"Total logins: {sum(login_count.values())}")
        
        # Show top active users
        if login_count:
            print("\nTop active users:")
            for user, count in sorted(login_count.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"  {user}: {count} logins")
    
    except Exception as e:
        print(f"Error analyzing user activity: {e}")

if __name__ == '__main__':
    analyze_user_activity()
```

**✅ Checklist Items:**
- [ ] User activity patterns normal
- [ ] No unusual login spikes
- [ ] Session management working correctly
- [ ] User experience metrics acceptable

### Evening Operations (End of Business Day)

**Time Required:** 20-25 minutes  
**Responsible:** Operations Team  
**Frequency:** Every business day at 6:00 PM

#### Daily Backup Verification

```bash
#!/bin/bash
# Evening backup verification

echo "=== Daily Backup Verification ==="

# Check if daily backup was created
TODAY=$(date +%Y%m%d)
BACKUP_DIR="/backups/daily/$TODAY"

if [ -d "$BACKUP_DIR" ]; then
    echo "✓ Daily backup directory exists: $BACKUP_DIR"
    
    # Verify backup contents
    if [ -f "$BACKUP_DIR"/fossawork_v2_*.db ]; then
        echo "✓ Database backup found"
        
        # Test database backup integrity
        DB_BACKUP=$(ls "$BACKUP_DIR"/fossawork_v2_*.db | head -1)
        if sqlite3 "$DB_BACKUP" "SELECT COUNT(*) FROM sqlite_master;" > /dev/null 2>&1; then
            echo "✓ Database backup integrity verified"
        else
            echo "✗ Database backup integrity check failed"
        fi
    else
        echo "✗ Database backup not found"
    fi
    
    # Check backup sizes
    echo -e "\nBackup sizes:"
    du -sh "$BACKUP_DIR"/*
    
else
    echo "✗ Daily backup directory not found"
    echo "Running manual backup..."
    /tools/operations/daily-backup.sh
fi

echo "=== Backup Verification Complete ==="
```

**✅ Checklist Items:**
- [ ] Daily backup completed successfully
- [ ] Database backup integrity verified
- [ ] User data backup completed
- [ ] Configuration backup completed
- [ ] Backup sizes reasonable
- [ ] Old backups cleaned up according to retention policy

#### Log Analysis and Rotation

```bash
#!/bin/bash
# Evening log analysis and rotation

echo "=== Daily Log Analysis ==="

# Analyze error patterns
echo "1. Error Summary:"
python3 /tools/operations/log-analyzer.py --errors --last-24h

# Check log file sizes
echo -e "\n2. Log File Sizes:"
find /logs -name "*.jsonl" -exec du -sh {} \; | sort -hr | head -10

# Rotate large log files
echo -e "\n3. Log Rotation:"
find /logs -name "*.jsonl" -size +100M -exec sh -c '
    file="$1"
    mv "$file" "${file%.jsonl}_$(date +%Y%m%d_%H%M%S).jsonl"
    touch "$file"
    echo "Rotated: $(basename "$file")"
' _ {} \;

# Generate daily log summary
echo -e "\n4. Daily Log Summary:"
python3 /tools/operations/generate-daily-log-summary.py

echo "=== Log Analysis Complete ==="
```

**✅ Checklist Items:**
- [ ] Log analysis completed
- [ ] Error patterns identified and documented
- [ ] Large log files rotated
- [ ] Log retention policy enforced
- [ ] Daily log summary generated

#### Performance Summary

```python
#!/usr/bin/env python3
# Daily performance summary

import json
from datetime import datetime, timedelta
from statistics import mean, median

def generate_performance_summary():
    print("=== Daily Performance Summary ===")
    
    try:
        # Analyze API performance
        response_times = []
        error_count = 0
        total_requests = 0
        
        with open('/logs/performance/performance-metrics.jsonl', 'r') as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if 'api' in entry:
                        for endpoint, data in entry['api'].items():
                            if data.get('response_time'):
                                response_times.append(data['response_time'])
                                total_requests += 1
                                if not data.get('success', True):
                                    error_count += 1
                except:
                    continue
        
        if response_times:
            print(f"API Performance Summary:")
            print(f"  Total Requests: {total_requests}")
            print(f"  Average Response Time: {mean(response_times):.3f}s")
            print(f"  Median Response Time: {median(response_times):.3f}s")
            print(f"  Error Rate: {(error_count/total_requests)*100:.2f}%")
        
        # System resource summary
        print(f"\nSystem Resource Summary:")
        print(f"  Peak CPU Usage: [From monitoring data]")
        print(f"  Peak Memory Usage: [From monitoring data]")
        print(f"  Disk I/O: [From monitoring data]")
        
    except Exception as e:
        print(f"Error generating performance summary: {e}")

if __name__ == '__main__':
    generate_performance_summary()
```

**✅ Checklist Items:**
- [ ] Performance summary generated
- [ ] API response times documented
- [ ] System resource usage analyzed
- [ ] Performance trends identified
- [ ] Any performance issues escalated

## Daily Maintenance Tasks

### Automated Maintenance

**Scheduled via cron jobs:**

```bash
# /etc/cron.d/fossawork-daily-maintenance

# Daily backup (2:00 AM)
0 2 * * * root /tools/operations/daily-backup.sh

# Log rotation (3:00 AM)
0 3 * * * root /tools/operations/rotate-logs.sh

# Database optimization (4:00 AM)
0 4 * * * root /tools/operations/optimize-database.sh

# Health check (every 4 hours)
0 */4 * * * root /tools/operations/health-check.py --scheduled

# Security scan (6:00 AM)
0 6 * * * root /tools/operations/security-scan.py --daily

# Performance monitoring (every hour)
0 * * * * root /tools/operations/performance-monitor.py --log-only
```

### Manual Maintenance Tasks

**Database Maintenance:**
```bash
#!/bin/bash
# Daily database maintenance

echo "=== Daily Database Maintenance ==="

# Stop backend for maintenance
sudo systemctl stop fossawork-backend

# Database integrity check
echo "1. Integrity Check:"
sqlite3 /backend/fossawork_v2.db "PRAGMA integrity_check;"

# Optimize database
echo "2. Database Optimization:"
sqlite3 /backend/fossawork_v2.db "VACUUM; ANALYZE;"

# Update statistics
echo "3. Update Statistics:"
sqlite3 /backend/fossawork_v2.db "ANALYZE main;"

# Restart backend
sudo systemctl start fossawork-backend

echo "=== Database Maintenance Complete ==="
```

**System Cleanup:**
```bash
#!/bin/bash
# Daily system cleanup

echo "=== Daily System Cleanup ==="

# Clean temporary files
echo "1. Cleaning temporary files..."
find /tmp -type f -mtime +1 -delete
find /var/tmp -type f -mtime +1 -delete

# Clean old log files
echo "2. Cleaning old log files..."
find /logs -name "*.jsonl" -mtime +30 -delete

# Clean browser automation data
echo "3. Cleaning browser data..."
find /tmp -name "playwright*" -type d -mtime +1 -exec rm -rf {} \; 2>/dev/null || true

# Clean package caches
echo "4. Cleaning package caches..."
npm cache clean --force 2>/dev/null || true
pip cache purge 2>/dev/null || true

# Update package lists
echo "5. Updating package information..."
apt update -qq 2>/dev/null || true

echo "=== System Cleanup Complete ==="
```

## Issue Escalation

### When to Escalate

**Immediate Escalation (P1):**
- System completely down
- Security breach detected
- Data corruption identified
- Authentication system failure

**Same Day Escalation (P2):**
- Performance degradation >50%
- Partial system outage
- High error rates (>10%)
- Backup failures

**Next Business Day Escalation (P3):**
- Minor performance issues
- Non-critical feature failures
- Warning threshold breaches

### Escalation Contacts

**Primary Operations Contact:**
- Name: [CONFIGURE]
- Phone: [CONFIGURE]
- Email: [CONFIGURE]

**System Administrator:**
- Name: [CONFIGURE]
- Phone: [CONFIGURE]
- Email: [CONFIGURE]

**Security Officer:**
- Name: [CONFIGURE]
- Phone: [CONFIGURE]
- Email: [CONFIGURE]

## Documentation Requirements

### Daily Operations Log

**Required Documentation:**
```markdown
# Daily Operations Log - [DATE]

## Morning Health Check
- System Status: [PASS/FAIL]
- Security Status: [PASS/FAIL]
- Performance Status: [PASS/FAIL]
- Issues Identified: [LIST]

## Midday Review
- System Load: [NORMAL/HIGH]
- User Activity: [NORMAL/UNUSUAL]
- Error Rates: [ACCEPTABLE/HIGH]
- Issues Identified: [LIST]

## Evening Summary
- Backup Status: [SUCCESS/FAIL]
- Log Analysis: [COMPLETE]
- Performance Summary: [ATTACH]
- Outstanding Issues: [LIST]

## Actions Taken
- [LIST ALL ACTIONS TAKEN]

## Next Day Priorities
- [LIST PRIORITIES FOR NEXT DAY]

Operator: [NAME]
Date: [DATE]
```

### Issue Tracking

**Issue Documentation Format:**
```json
{
  "issue_id": "DAILY-YYYYMMDD-001",
  "timestamp": "2025-01-13T08:30:00Z",
  "severity": "medium",
  "component": "backend",
  "description": "Elevated response times during morning peak",
  "impact": "User experience degradation",
  "actions_taken": [
    "Restarted backend service",
    "Optimized database queries",
    "Increased monitoring frequency"
  ],
  "resolution": "Response times returned to normal",
  "follow_up_required": false,
  "operator": "ops-team-member"
}
```

## Quality Assurance

### Daily Operations Audit

**Monthly Audit Checklist:**
- [ ] All daily procedures documented
- [ ] Escalation procedures followed correctly
- [ ] Issues properly tracked and resolved
- [ ] Performance trends monitored
- [ ] Security procedures maintained
- [ ] Backup procedures verified
- [ ] Documentation up-to-date

### Continuous Improvement

**Weekly Review Process:**
1. Review all daily operations logs
2. Identify recurring issues
3. Analyze resolution effectiveness
4. Update procedures as needed
5. Train team on new procedures
6. Document lessons learned

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Operations Team
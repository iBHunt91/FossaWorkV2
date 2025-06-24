# Weekly Maintenance Procedures

## Overview

This document outlines the weekly maintenance procedures for FossaWork V2 to ensure optimal system performance, security, and reliability. These procedures should be performed every week during scheduled maintenance windows.

## Weekly Maintenance Schedule

**Preferred Maintenance Window:** Saturday 2:00 AM - 6:00 AM Local Time  
**Duration:** 2-4 hours  
**Frequency:** Every Saturday  
**Responsible:** Operations Team + System Administrator

## Pre-Maintenance Checklist

### Preparation Phase (Friday before maintenance)

**✅ Planning and Notification:**
- [ ] Review planned maintenance activities
- [ ] Verify maintenance window availability
- [ ] Notify stakeholders 24 hours in advance
- [ ] Prepare rollback procedures
- [ ] Check weather/external factors that might affect maintenance

**✅ Backup Verification:**
- [ ] Verify latest daily backup completed successfully
- [ ] Test backup integrity
- [ ] Create pre-maintenance snapshot
- [ ] Confirm backup retention policy compliance

**✅ Resource Verification:**
- [ ] Confirm adequate disk space for maintenance
- [ ] Verify system resources are sufficient
- [ ] Check for any pending security updates
- [ ] Review error logs for potential issues

```bash
#!/bin/bash
# Pre-maintenance verification script

echo "=== Pre-Maintenance Verification ==="
echo "Date: $(date)"

# Check backup status
echo "1. Checking backup status..."
LATEST_BACKUP=$(find /backups/daily -type d -name "$(date +%Y%m%d)" | head -1)
if [ -d "$LATEST_BACKUP" ]; then
    echo "✓ Daily backup found: $LATEST_BACKUP"
    du -sh "$LATEST_BACKUP"
else
    echo "✗ Daily backup not found - creating emergency backup"
    /tools/operations/daily-backup.sh
fi

# Check disk space
echo -e "\n2. Checking disk space..."
df -h | grep -E "/(dev/|Users/|mnt/|var/)" | while read line; do
    usage=$(echo "$line" | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 85 ]; then
        echo "⚠ High disk usage: $line"
    else
        echo "✓ Disk usage OK: $line"
    fi
done

# Check system load
echo -e "\n3. Checking system load..."
LOAD=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | xargs)
CPU_COUNT=$(nproc)
LOAD_PERCENT=$(echo "$LOAD * 100 / $CPU_COUNT" | bc -l | cut -d. -f1)

if [ "$LOAD_PERCENT" -gt 80 ]; then
    echo "⚠ High system load: ${LOAD} (${LOAD_PERCENT}%)"
else
    echo "✓ System load OK: ${LOAD} (${LOAD_PERCENT}%)"
fi

echo "=== Pre-Maintenance Verification Complete ==="
```

## Weekly Maintenance Procedures

### 1. System Updates and Security Patches

**Time Allocation:** 30-45 minutes

```bash
#!/bin/bash
# Weekly system updates

echo "=== Weekly System Updates ==="

# Update package lists
echo "1. Updating package lists..."
sudo apt update -qq

# Check for security updates
echo "2. Checking for security updates..."
SECURITY_UPDATES=$(apt list --upgradable 2>/dev/null | grep -c security)
echo "Security updates available: $SECURITY_UPDATES"

# Apply security updates
if [ "$SECURITY_UPDATES" -gt 0 ]; then
    echo "3. Applying security updates..."
    sudo apt upgrade -y
    
    # Check if reboot is required
    if [ -f /var/run/reboot-required ]; then
        echo "⚠ System reboot required after updates"
        echo "Scheduling reboot for end of maintenance window"
        echo "/usr/bin/systemctl reboot" | at now + 3 hours
    fi
else
    echo "3. No security updates available"
fi

# Update Python packages
echo "4. Updating Python packages..."
cd /backend
source venv/bin/activate
pip list --outdated --format=json | python3 -c "
import json, sys
packages = json.load(sys.stdin)
for pkg in packages:
    if pkg['name'] in ['fastapi', 'uvicorn', 'sqlalchemy', 'requests']:
        print(f'Updating {pkg[\"name\"]} from {pkg[\"version\"]} to {pkg[\"latest_version\"]}')
" 2>/dev/null || echo "No Python package updates needed"

# Update Node.js packages
echo "5. Updating Node.js packages..."
cd /frontend
npm audit fix --force 2>/dev/null || echo "No npm updates needed"

echo "=== System Updates Complete ==="
```

**✅ Checklist:**
- [ ] Operating system security patches applied
- [ ] Python package vulnerabilities addressed
- [ ] Node.js dependencies updated
- [ ] Security advisories reviewed and applied
- [ ] Reboot scheduled if required

### 2. Database Maintenance and Optimization

**Time Allocation:** 45-60 minutes

```bash
#!/bin/bash
# Weekly database maintenance

echo "=== Weekly Database Maintenance ==="

# Stop backend service
echo "1. Stopping backend service..."
sudo systemctl stop fossawork-backend

# Create pre-maintenance database backup
echo "2. Creating pre-maintenance backup..."
BACKUP_FILE="/backups/maintenance/fossawork_v2_pre_maintenance_$(date +%Y%m%d_%H%M%S).db"
mkdir -p "/backups/maintenance"
cp /backend/fossawork_v2.db "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# Database integrity check
echo "3. Performing database integrity check..."
INTEGRITY_RESULT=$(sqlite3 /backend/fossawork_v2.db "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY_RESULT" = "ok" ]; then
    echo "✓ Database integrity check passed"
else
    echo "✗ Database integrity issues found: $INTEGRITY_RESULT"
    echo "Restoring from backup..."
    cp "$BACKUP_FILE" /backend/fossawork_v2.db
fi

# Optimize database
echo "4. Optimizing database..."
sqlite3 /backend/fossawork_v2.db << 'EOF'
-- Vacuum database to reclaim space
VACUUM;

-- Update statistics for query optimizer
ANALYZE;

-- Reindex all indexes
REINDEX;

-- Check and optimize WAL mode
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=memory;
EOF

# Get database statistics
echo "5. Database statistics:"
DB_SIZE=$(du -h /backend/fossawork_v2.db | cut -f1)
TABLE_COUNT=$(sqlite3 /backend/fossawork_v2.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
WORK_ORDER_COUNT=$(sqlite3 /backend/fossawork_v2.db "SELECT COUNT(*) FROM work_orders;" 2>/dev/null || echo "0")
DISPENSER_COUNT=$(sqlite3 /backend/fossawork_v2.db "SELECT COUNT(*) FROM dispensers;" 2>/dev/null || echo "0")

echo "  Database size: $DB_SIZE"
echo "  Tables: $TABLE_COUNT"
echo "  Work orders: $WORK_ORDER_COUNT"
echo "  Dispensers: $DISPENSER_COUNT"

# Restart backend service
echo "6. Starting backend service..."
sudo systemctl start fossawork-backend

# Verify service startup
sleep 10
if sudo systemctl is-active --quiet fossawork-backend; then
    echo "✓ Backend service started successfully"
else
    echo "✗ Backend service failed to start"
    sudo journalctl -u fossawork-backend -n 20
fi

echo "=== Database Maintenance Complete ==="
```

**✅ Checklist:**
- [ ] Database integrity verified
- [ ] Database optimized (VACUUM, ANALYZE, REINDEX)
- [ ] Performance statistics collected
- [ ] Backup created before maintenance
- [ ] Services restarted successfully

### 3. Log Analysis and Cleanup

**Time Allocation:** 30 minutes

```bash
#!/bin/bash
# Weekly log analysis and cleanup

echo "=== Weekly Log Analysis and Cleanup ==="

# Generate weekly log summary
echo "1. Generating weekly log summary..."
python3 /tools/operations/log-analyzer.py --errors --last-week --report --output "/logs/reports/weekly-log-analysis-$(date +%Y%m%d).json"

# Analyze error patterns
echo "2. Analyzing error patterns..."
ERROR_COUNT=$(find /logs/errors -name "*.jsonl" -mtime -7 -exec wc -l {} \; | awk '{sum+=$1} END {print sum+0}')
echo "Total errors this week: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 100 ]; then
    echo "⚠ High error count detected - requires investigation"
    python3 /tools/operations/log-analyzer.py --errors --last-week | head -20
fi

# Clean up old log files
echo "3. Cleaning up old log files..."

# Compress logs older than 7 days
find /logs -name "*.jsonl" -mtime +7 -exec gzip {} \;
COMPRESSED_COUNT=$(find /logs -name "*.jsonl.gz" -mtime -1 | wc -l)
echo "Compressed $COMPRESSED_COUNT log files"

# Archive logs older than 30 days
mkdir -p /archives/logs/$(date +%Y%m)
find /logs -name "*.jsonl.gz" -mtime +30 -exec mv {} /archives/logs/$(date +%Y%m)/ \;
ARCHIVED_COUNT=$(find /archives/logs/$(date +%Y%m) -name "*.jsonl.gz" -mtime -1 | wc -l)
echo "Archived $ARCHIVED_COUNT log files"

# Delete very old archives (90 days)
find /archives/logs -name "*.jsonl.gz" -mtime +90 -delete
DELETED_COUNT=$(find /archives/logs -name "*.jsonl.gz" -mtime +90 | wc -l)
echo "Deleted $DELETED_COUNT old archive files"

# Log disk usage after cleanup
echo "4. Log disk usage after cleanup:"
du -sh /logs /archives 2>/dev/null || echo "Archive directory not accessible"

echo "=== Log Analysis and Cleanup Complete ==="
```

**✅ Checklist:**
- [ ] Weekly log analysis report generated
- [ ] Error patterns identified and documented
- [ ] Old logs compressed and archived
- [ ] Disk space reclaimed
- [ ] Log retention policy enforced

### 4. Performance Analysis and Optimization

**Time Allocation:** 30-45 minutes

```bash
#!/bin/bash
# Weekly performance analysis

echo "=== Weekly Performance Analysis ==="

# Run performance benchmark
echo "1. Running performance benchmark..."
python3 /tools/operations/performance-benchmark.py --output "/logs/reports/performance-benchmark-$(date +%Y%m%d).json"

# Analyze system resource trends
echo "2. Analyzing system resource trends..."
echo "Average CPU usage last week:"
grep "cpu_percent" /logs/performance/performance-metrics.jsonl | tail -168 | \
    python3 -c "
import sys, json
total = count = 0
for line in sys.stdin:
    try:
        data = json.loads(line)
        if 'system' in data and 'cpu_percent' in data['system']:
            total += data['system']['cpu_percent']
            count += 1
    except: pass
if count > 0:
    print(f'Average CPU: {total/count:.1f}%')
else:
    print('No CPU data available')
"

echo "Average memory usage last week:"
grep "memory_percent" /logs/performance/performance-metrics.jsonl | tail -168 | \
    python3 -c "
import sys, json
total = count = 0
for line in sys.stdin:
    try:
        data = json.loads(line)
        if 'system' in data and 'memory_percent' in data['system']:
            total += data['system']['memory_percent']
            count += 1
    except: pass
if count > 0:
    print(f'Average Memory: {total/count:.1f}%')
else:
    print('No memory data available')
"

# Check for performance issues
echo "3. Checking for performance issues..."
python3 /tools/operations/performance-monitor.py --check-thresholds

# Optimize system if needed
echo "4. System optimization..."

# Clear system caches if memory usage is high
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ "$MEMORY_USAGE" -gt 85 ]; then
    echo "High memory usage detected (${MEMORY_USAGE}%) - clearing caches"
    sync && echo 3 > /proc/sys/vm/drop_caches
else
    echo "Memory usage normal (${MEMORY_USAGE}%)"
fi

# Check for process optimization opportunities
echo "5. Top resource-consuming processes:"
ps aux --sort=-%cpu | head -10 | awk '{print $11, $3, $4}' | column -t

echo "=== Performance Analysis Complete ==="
```

**✅ Checklist:**
- [ ] Performance benchmark completed
- [ ] Resource usage trends analyzed
- [ ] Performance issues identified
- [ ] System optimization performed if needed
- [ ] Performance metrics documented

### 5. Security Review and Hardening

**Time Allocation:** 30-45 minutes

```bash
#!/bin/bash
# Weekly security review

echo "=== Weekly Security Review ==="

# Run security scan
echo "1. Running security scan..."
python3 /tools/operations/security-monitor.py --scan --last-week --report --output "/logs/reports/security-analysis-$(date +%Y%m%d).json"

# Check for failed login attempts
echo "2. Analyzing authentication security..."
FAILED_LOGINS=$(grep -i "authentication.*failed" /logs/backend/*.jsonl | wc -l)
echo "Failed login attempts this week: $FAILED_LOGINS"

if [ "$FAILED_LOGINS" -gt 50 ]; then
    echo "⚠ High number of failed logins - investigating..."
    python3 /tools/operations/security-monitor.py --investigate --brute-force
fi

# Check file permissions
echo "3. Checking critical file permissions..."
ls -la /backend/fossawork_v2.db /backend/.env /backend/data/ 2>/dev/null | \
while read perm links owner group size date time file; do
    if [[ "$file" == *".db" ]] && [[ "$perm" != *"rw-------"* ]]; then
        echo "⚠ Database file permissions may be too open: $file $perm"
    elif [[ "$file" == *".env" ]] && [[ "$perm" != *"rw-------"* ]]; then
        echo "⚠ Environment file permissions may be too open: $file $perm"
    else
        echo "✓ File permissions OK: $file"
    fi
done

# Check for security updates
echo "4. Checking for security updates..."
SECURITY_UPDATES=$(apt list --upgradable 2>/dev/null | grep -c security || echo "0")
if [ "$SECURITY_UPDATES" -gt 0 ]; then
    echo "⚠ $SECURITY_UPDATES security updates available"
else
    echo "✓ No security updates needed"
fi

# Review SSL/TLS configuration
echo "5. Checking SSL/TLS configuration..."
if command -v openssl >/dev/null 2>&1; then
    if [ -f "/etc/ssl/certs/fossawork.crt" ]; then
        CERT_EXPIRY=$(openssl x509 -in /etc/ssl/certs/fossawork.crt -noout -enddate | cut -d= -f2)
        DAYS_UNTIL_EXPIRY=$(echo $(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 )))
        
        if [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
            echo "⚠ SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        else
            echo "✓ SSL certificate valid for $DAYS_UNTIL_EXPIRY days"
        fi
    else
        echo "ℹ No SSL certificate found"
    fi
fi

echo "=== Security Review Complete ==="
```

**✅ Checklist:**
- [ ] Security scan completed
- [ ] Authentication events analyzed
- [ ] File permissions verified
- [ ] Security updates checked
- [ ] SSL/TLS configuration reviewed

### 6. Backup Verification and Testing

**Time Allocation:** 30 minutes

```bash
#!/bin/bash
# Weekly backup verification

echo "=== Weekly Backup Verification ==="

# Test latest backup integrity
echo "1. Testing backup integrity..."
LATEST_BACKUP=$(find /backups/weekly -name "fossawork_v2_full_*.db" -type f -mtime -7 | head -1)

if [ -n "$LATEST_BACKUP" ]; then
    echo "Testing backup: $LATEST_BACKUP"
    
    # Test database backup
    if sqlite3 "$LATEST_BACKUP" "SELECT COUNT(*) FROM sqlite_master;" >/dev/null 2>&1; then
        TABLE_COUNT=$(sqlite3 "$LATEST_BACKUP" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
        echo "✓ Backup database accessible with $TABLE_COUNT tables"
    else
        echo "✗ Backup database integrity test failed"
    fi
else
    echo "⚠ No recent weekly backup found"
fi

# Verify backup completeness
echo "2. Verifying backup completeness..."
for backup_type in daily weekly; do
    BACKUP_COUNT=$(find /backups/$backup_type -type f -mtime -7 | wc -l)
    echo "$backup_type backups this week: $BACKUP_COUNT"
done

# Test backup restoration procedure (dry run)
echo "3. Testing backup restoration procedure (dry run)..."
TEMP_DB="/tmp/test_restore_$(date +%Y%m%d_%H%M%S).db"
if [ -n "$LATEST_BACKUP" ]; then
    cp "$LATEST_BACKUP" "$TEMP_DB"
    
    if sqlite3 "$TEMP_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo "✓ Backup restoration test successful"
        rm "$TEMP_DB"
    else
        echo "✗ Backup restoration test failed"
    fi
fi

# Check backup retention policy
echo "4. Checking backup retention policy..."
OLD_BACKUPS=$(find /backups -type f -mtime +30 | wc -l)
if [ "$OLD_BACKUPS" -gt 0 ]; then
    echo "⚠ $OLD_BACKUPS old backup files found (>30 days)"
    echo "Consider running backup cleanup"
else
    echo "✓ Backup retention policy compliant"
fi

echo "=== Backup Verification Complete ==="
```

**✅ Checklist:**
- [ ] Latest backup integrity verified
- [ ] Backup completeness confirmed
- [ ] Restoration procedure tested
- [ ] Retention policy compliance checked
- [ ] Backup documentation updated

## Post-Maintenance Procedures

### System Verification

```bash
#!/bin/bash
# Post-maintenance verification

echo "=== Post-Maintenance Verification ==="

# Health check
echo "1. Running comprehensive health check..."
python3 /tools/operations/health-check.py --comprehensive

# Service status verification
echo "2. Verifying service status..."
for service in fossawork-backend fossawork-frontend; do
    if sudo systemctl is-active --quiet $service; then
        echo "✓ $service is running"
    else
        echo "✗ $service is not running"
        sudo systemctl start $service
    fi
done

# API endpoint testing
echo "3. Testing API endpoints..."
for endpoint in "/api/health" "/api/work-orders" "/api/dispensers"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000$endpoint" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✓ $endpoint responding (HTTP $HTTP_CODE)"
    else
        echo "⚠ $endpoint issue (HTTP $HTTP_CODE)"
    fi
done

# Performance verification
echo "4. Performance verification..."
python3 /tools/operations/performance-monitor.py --baseline

echo "=== Post-Maintenance Verification Complete ==="
```

### Documentation and Reporting

**✅ Post-Maintenance Checklist:**
- [ ] All services running and responsive
- [ ] Health check passed
- [ ] Performance within acceptable ranges
- [ ] No critical errors in logs
- [ ] Maintenance activities documented

**Maintenance Report Template:**

```markdown
# Weekly Maintenance Report - [DATE]

## Maintenance Window
- **Start Time:** [TIME]
- **End Time:** [TIME]
- **Duration:** [DURATION]
- **Downtime:** [ACTUAL DOWNTIME]

## Activities Completed
- [ ] System updates and security patches
- [ ] Database maintenance and optimization
- [ ] Log analysis and cleanup
- [ ] Performance analysis
- [ ] Security review
- [ ] Backup verification

## Issues Identified
- [LIST ANY ISSUES FOUND]

## Actions Taken
- [LIST ALL ACTIONS PERFORMED]

## Performance Metrics
- **Database Size:** [SIZE]
- **Average CPU Usage:** [PERCENTAGE]
- **Average Memory Usage:** [PERCENTAGE]
- **Error Count:** [COUNT]

## Recommendations
- [LIST RECOMMENDATIONS FOR NEXT WEEK]

## Next Maintenance
- **Scheduled:** [NEXT DATE]
- **Special Activities:** [ANY SPECIAL ACTIVITIES PLANNED]

**Maintenance Performed By:** [NAME]
**Report Generated:** [DATE/TIME]
```

## Emergency Procedures

### Maintenance Window Extension

**If maintenance exceeds planned window:**

1. **Immediate Assessment (5 minutes)**
   - Identify cause of delay
   - Estimate additional time needed
   - Assess business impact

2. **Stakeholder Notification (10 minutes)**
   - Notify business stakeholders
   - Update maintenance status
   - Provide revised timeline

3. **Decision Point (15 minutes)**
   - Continue with maintenance
   - Rollback to pre-maintenance state
   - Postpone remaining activities

### Rollback Procedures

**If issues occur during maintenance:**

```bash
#!/bin/bash
# Emergency rollback procedure

echo "=== EMERGENCY ROLLBACK INITIATED ==="

# Stop services
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend

# Restore database from pre-maintenance backup
BACKUP_FILE=$(find /backups/maintenance -name "fossawork_v2_pre_maintenance_*.db" -type f -mtime -1 | head -1)
if [ -n "$BACKUP_FILE" ]; then
    echo "Restoring database from: $BACKUP_FILE"
    cp "$BACKUP_FILE" /backend/fossawork_v2.db
else
    echo "ERROR: No pre-maintenance backup found"
    exit 1
fi

# Restore configuration if needed
# [Add specific config restoration steps]

# Start services
sudo systemctl start fossawork-backend
sudo systemctl start fossawork-frontend

# Verify rollback
python3 /tools/operations/health-check.py

echo "=== EMERGENCY ROLLBACK COMPLETE ==="
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Operations Team
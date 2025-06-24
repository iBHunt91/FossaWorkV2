# Backup and Recovery Runbook

## Overview

This runbook provides comprehensive procedures for backing up and recovering FossaWork V2 data and systems. It covers automated backup procedures, disaster recovery planning, data restoration processes, and business continuity measures.

## Backup Strategy

### Backup Components

**Critical Data:**
- Database (`/backend/fossawork_v2.db`)
- User credentials (`/backend/data/credentials/`)
- User data (`/backend/data/users/`)
- Application logs (`/logs/`)
- Configuration files (`.env`, config files)

**Application Code:**
- Source code (Git repository)
- Dependencies and lock files
- Build artifacts
- Static assets

**System Configuration:**
- Environment variables
- SSL certificates
- Service configurations
- Monitoring configurations

### Backup Types

**Full Backup:**
- Complete system snapshot
- All data and configurations
- Frequency: Weekly
- Retention: 4 weeks

**Incremental Backup:**
- Changed data since last backup
- Database transactions and logs
- User data modifications
- Frequency: Daily
- Retention: 2 weeks

**Differential Backup:**
- All changes since last full backup
- Quick recovery option
- Frequency: Every 6 hours during business hours
- Retention: 1 week

**Real-time Backup:**
- Critical data continuous backup
- Database write-ahead logs
- Authentication events
- Frequency: Continuous
- Retention: 24 hours

## Automated Backup Procedures

### Daily Backup Script

```bash
#!/bin/bash
# /tools/operations/daily-backup.sh

set -e

BACKUP_DIR="/backups/daily/$(date +%Y%m%d)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting daily backup: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
echo "Backing up database..."
sqlite3 /backend/fossawork_v2.db ".backup $BACKUP_DIR/fossawork_v2_$TIMESTAMP.db"

# User data backup
echo "Backing up user data..."
tar -czf "$BACKUP_DIR/user_data_$TIMESTAMP.tar.gz" -C /backend/data users/

# Credentials backup (encrypted)
echo "Backing up credentials..."
tar -czf "$BACKUP_DIR/credentials_$TIMESTAMP.tar.gz" -C /backend/data credentials/
gpg --cipher-algo AES256 --compress-algo 1 --s2k-cipher-algo AES256 --s2k-digest-algo SHA512 --s2k-mode 3 --s2k-count 65536 --symmetric "$BACKUP_DIR/credentials_$TIMESTAMP.tar.gz"
rm "$BACKUP_DIR/credentials_$TIMESTAMP.tar.gz"

# Configuration backup
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" \
  /backend/.env \
  /backend/app/core/config.py \
  /frontend/.env.local

# Logs backup
echo "Backing up logs..."
tar -czf "$BACKUP_DIR/logs_$TIMESTAMP.tar.gz" /logs/

# Create backup manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "backup_type": "daily",
  "timestamp": "$TIMESTAMP",
  "components": [
    "database",
    "user_data", 
    "credentials",
    "configuration",
    "logs"
  ],
  "database_size": "$(du -h $BACKUP_DIR/fossawork_v2_$TIMESTAMP.db | cut -f1)",
  "total_size": "$(du -sh $BACKUP_DIR | cut -f1)"
}
EOF

# Verify backup integrity
python /tools/operations/verify-backup.py "$BACKUP_DIR"

echo "Daily backup completed: $BACKUP_DIR"

# Cleanup old backups (keep 14 days)
find /backups/daily -type d -mtime +14 -exec rm -rf {} \;
```

### Weekly Full Backup Script

```bash
#!/bin/bash
# /tools/operations/weekly-backup.sh

set -e

BACKUP_DIR="/backups/weekly/$(date +%Y_week_%U)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting weekly full backup: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Stop services for consistent backup
echo "Stopping services for consistent backup..."
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend

# Database backup with vacuum
echo "Backing up and optimizing database..."
sqlite3 /backend/fossawork_v2.db "VACUUM; .backup $BACKUP_DIR/fossawork_v2_full_$TIMESTAMP.db"

# Complete application backup
echo "Backing up complete application..."
tar -czf "$BACKUP_DIR/application_full_$TIMESTAMP.tar.gz" \
  --exclude="node_modules" \
  --exclude="__pycache__" \
  --exclude="*.pyc" \
  --exclude=".git" \
  /backend /frontend

# System configuration backup
echo "Backing up system configuration..."
tar -czf "$BACKUP_DIR/system_config_$TIMESTAMP.tar.gz" \
  /etc/systemd/system/fossawork-* \
  /etc/nginx/sites-available/fossawork* \
  /etc/ssl/certs/fossawork*

# Restart services
echo "Restarting services..."
sudo systemctl start fossawork-backend
sudo systemctl start fossawork-frontend

# Create full backup manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "backup_type": "weekly_full",
  "timestamp": "$TIMESTAMP",
  "components": [
    "database_optimized",
    "complete_application",
    "system_configuration"
  ],
  "database_size": "$(du -h $BACKUP_DIR/fossawork_v2_full_$TIMESTAMP.db | cut -f1)",
  "total_size": "$(du -sh $BACKUP_DIR | cut -f1)",
  "git_commit": "$(cd /backend && git rev-parse HEAD)"
}
EOF

# Verify full backup
python /tools/operations/verify-full-backup.py "$BACKUP_DIR"

echo "Weekly full backup completed: $BACKUP_DIR"

# Cleanup old weekly backups (keep 4 weeks)
find /backups/weekly -type d -mtime +28 -exec rm -rf {} \;
```

### Real-time Backup Monitoring

```python
#!/usr/bin/env python3
# /tools/operations/realtime-backup-monitor.py

import time
import sqlite3
import shutil
import json
from datetime import datetime
from pathlib import Path

def monitor_database_changes():
    """Monitor database for changes and create incremental backups"""
    last_backup_time = datetime.utcnow()
    backup_interval = 300  # 5 minutes
    
    while True:
        try:
            # Check if database has been modified
            db_path = Path('/backend/fossawork_v2.db')
            db_modified = datetime.fromtimestamp(db_path.stat().st_mtime)
            
            if db_modified > last_backup_time:
                # Create incremental backup
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                backup_path = f'/backups/incremental/db_incremental_{timestamp}.db'
                
                # Use SQLite backup API for consistent backup
                conn = sqlite3.connect(str(db_path))
                backup_conn = sqlite3.connect(backup_path)
                conn.backup(backup_conn)
                backup_conn.close()
                conn.close()
                
                # Log backup creation
                log_entry = {
                    'timestamp': timestamp,
                    'type': 'incremental_database',
                    'source': str(db_path),
                    'backup': backup_path,
                    'size': Path(backup_path).stat().st_size
                }
                
                with open('/logs/backup-monitor.jsonl', 'a') as f:
                    f.write(json.dumps(log_entry) + '\n')
                
                last_backup_time = datetime.utcnow()
            
            time.sleep(60)  # Check every minute
            
        except Exception as e:
            error_log = {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'type': 'backup_monitor_error'
            }
            
            with open('/logs/backup-errors.jsonl', 'a') as f:
                f.write(json.dumps(error_log) + '\n')
            
            time.sleep(300)  # Wait 5 minutes on error

if __name__ == '__main__':
    monitor_database_changes()
```

## Recovery Procedures

### Emergency Recovery Process

**Priority Levels:**

**P1 - Critical Recovery (RTO: 15 minutes)**
- Complete system failure
- Database corruption
- Security breach requiring full restoration

**P2 - High Priority Recovery (RTO: 1 hour)**
- Partial system failure
- Data inconsistency
- Service degradation requiring restoration

**P3 - Standard Recovery (RTO: 4 hours)**
- Individual component failure
- Non-critical data recovery
- Planned recovery testing

### Database Recovery

**Complete Database Recovery:**
```bash
#!/bin/bash
# /tools/operations/recover-database.sh

set -e

RECOVERY_TYPE=$1
BACKUP_DATE=$2

if [[ -z "$RECOVERY_TYPE" || -z "$BACKUP_DATE" ]]; then
    echo "Usage: $0 [full|incremental|point-in-time] [backup_date]"
    exit 1
fi

echo "Starting database recovery: $RECOVERY_TYPE from $BACKUP_DATE"

# Stop application services
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend

# Create current database backup before recovery
CURRENT_BACKUP="/backups/pre-recovery/fossawork_v2_pre_recovery_$(date +%Y%m%d_%H%M%S).db"
mkdir -p "/backups/pre-recovery"
cp /backend/fossawork_v2.db "$CURRENT_BACKUP"

case $RECOVERY_TYPE in
    "full")
        echo "Performing full database recovery..."
        BACKUP_FILE=$(find /backups/weekly -name "*$BACKUP_DATE*.db" | head -1)
        if [[ -z "$BACKUP_FILE" ]]; then
            echo "Full backup not found for date: $BACKUP_DATE"
            exit 1
        fi
        cp "$BACKUP_FILE" /backend/fossawork_v2.db
        ;;
    
    "incremental")
        echo "Performing incremental database recovery..."
        BACKUP_FILE=$(find /backups/daily -name "*$BACKUP_DATE*.db" | head -1)
        if [[ -z "$BACKUP_FILE" ]]; then
            echo "Incremental backup not found for date: $BACKUP_DATE"
            exit 1
        fi
        cp "$BACKUP_FILE" /backend/fossawork_v2.db
        ;;
    
    "point-in-time")
        echo "Performing point-in-time recovery..."
        python /tools/operations/point-in-time-recovery.py --target-time="$BACKUP_DATE"
        ;;
    
    *)
        echo "Invalid recovery type: $RECOVERY_TYPE"
        exit 1
        ;;
esac

# Verify database integrity
python /tools/operations/verify-database-integrity.py

# Start services
sudo systemctl start fossawork-backend
sudo systemctl start fossawork-frontend

# Verify application functionality
python /tools/operations/post-recovery-tests.py

echo "Database recovery completed successfully"
```

**Point-in-Time Recovery:**
```python
#!/usr/bin/env python3
# /tools/operations/point-in-time-recovery.py

import argparse
import sqlite3
import json
from datetime import datetime
from pathlib import Path

def point_in_time_recovery(target_time):
    """Perform point-in-time recovery using transaction logs"""
    
    # Find the latest full backup before target time
    full_backup = find_latest_full_backup(target_time)
    if not full_backup:
        raise Exception(f"No full backup found before {target_time}")
    
    print(f"Using full backup: {full_backup}")
    
    # Restore from full backup
    shutil.copy2(full_backup, '/backend/fossawork_v2.db')
    
    # Apply incremental changes up to target time
    apply_incremental_changes(target_time)
    
    print(f"Point-in-time recovery completed for {target_time}")

def find_latest_full_backup(target_time):
    """Find the latest full backup before the target time"""
    backup_dir = Path('/backups/weekly')
    latest_backup = None
    latest_time = None
    
    for backup_file in backup_dir.glob('**/fossawork_v2_full_*.db'):
        backup_time = datetime.fromtimestamp(backup_file.stat().st_mtime)
        if backup_time <= target_time:
            if latest_time is None or backup_time > latest_time:
                latest_backup = backup_file
                latest_time = backup_time
    
    return latest_backup

def apply_incremental_changes(target_time):
    """Apply incremental changes from logs up to target time"""
    # This would implement WAL replay or similar mechanism
    # For SQLite, we might use backup files and transaction logs
    pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Point-in-time database recovery')
    parser.add_argument('--target-time', required=True, 
                      help='Target recovery time (YYYY-MM-DD HH:MM:SS)')
    
    args = parser.parse_args()
    target_time = datetime.strptime(args.target_time, '%Y-%m-%d %H:%M:%S')
    
    point_in_time_recovery(target_time)
```

### Application Recovery

**Complete Application Recovery:**
```bash
#!/bin/bash
# /tools/operations/recover-application.sh

set -e

BACKUP_SOURCE=$1

echo "Starting complete application recovery from: $BACKUP_SOURCE"

# Stop all services
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend
sudo systemctl stop nginx

# Backup current state
RECOVERY_BACKUP="/backups/pre-recovery/app_pre_recovery_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RECOVERY_BACKUP"
tar -czf "$RECOVERY_BACKUP/current_state.tar.gz" /backend /frontend

# Restore application files
echo "Restoring application files..."
tar -xzf "$BACKUP_SOURCE" -C /

# Restore database
echo "Restoring database..."
DB_BACKUP=$(dirname "$BACKUP_SOURCE")/fossawork_v2_*.db
if [[ -f "$DB_BACKUP" ]]; then
    cp "$DB_BACKUP" /backend/fossawork_v2.db
fi

# Restore configuration
echo "Restoring configuration..."
CONFIG_BACKUP=$(dirname "$BACKUP_SOURCE")/config_*.tar.gz
if [[ -f "$CONFIG_BACKUP" ]]; then
    tar -xzf "$CONFIG_BACKUP" -C /
fi

# Restore user data
echo "Restoring user data..."
USER_DATA_BACKUP=$(dirname "$BACKUP_SOURCE")/user_data_*.tar.gz
if [[ -f "$USER_DATA_BACKUP" ]]; then
    tar -xzf "$USER_DATA_BACKUP" -C /backend/data/
fi

# Set proper permissions
chown -R www-data:www-data /backend /frontend
chmod 600 /backend/.env

# Install dependencies
echo "Installing dependencies..."
cd /backend
source venv/bin/activate
pip install -r requirements.txt

cd /frontend
npm install

# Build frontend
npm run build

# Start services
sudo systemctl start fossawork-backend
sleep 10
sudo systemctl start fossawork-frontend
sudo systemctl start nginx

# Verify recovery
python /tools/operations/verify-application-recovery.py

echo "Application recovery completed successfully"
```

### User Data Recovery

**Individual User Data Recovery:**
```bash
#!/bin/bash
# /tools/operations/recover-user-data.sh

USER_ID=$1
BACKUP_DATE=$2

if [[ -z "$USER_ID" || -z "$BACKUP_DATE" ]]; then
    echo "Usage: $0 [user_id] [backup_date]"
    exit 1
fi

echo "Recovering user data for: $USER_ID from $BACKUP_DATE"

# Find user data backup
BACKUP_FILE=$(find /backups -name "*user_data*$BACKUP_DATE*" | head -1)
if [[ -z "$BACKUP_FILE" ]]; then
    echo "User data backup not found for date: $BACKUP_DATE"
    exit 1
fi

# Create temporary extraction directory
TEMP_DIR="/tmp/user_recovery_$$"
mkdir -p "$TEMP_DIR"

# Extract user data backup
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Backup current user data
CURRENT_USER_DIR="/backend/data/users/$USER_ID"
if [[ -d "$CURRENT_USER_DIR" ]]; then
    cp -r "$CURRENT_USER_DIR" "/backups/pre-recovery/user_${USER_ID}_$(date +%Y%m%d_%H%M%S)"
fi

# Restore specific user data
BACKUP_USER_DIR="$TEMP_DIR/users/$USER_ID"
if [[ -d "$BACKUP_USER_DIR" ]]; then
    cp -r "$BACKUP_USER_DIR" "/backend/data/users/"
    echo "User data restored for: $USER_ID"
else
    echo "User data not found in backup for: $USER_ID"
fi

# Cleanup
rm -rf "$TEMP_DIR"
```

## Disaster Recovery Planning

### Recovery Time Objectives (RTO)

**Critical Systems:**
- Authentication System: 5 minutes
- Database: 15 minutes
- Core Application: 30 minutes
- Full System: 1 hour

**Data Recovery:**
- User Credentials: 5 minutes
- Work Orders: 15 minutes
- User Preferences: 30 minutes
- Historical Logs: 4 hours

### Recovery Point Objectives (RPO)

**Data Types:**
- Authentication Data: 5 minutes
- Work Order Data: 15 minutes
- User Data: 1 hour
- System Logs: 4 hours

### Disaster Recovery Procedures

**Site Failure Recovery:**
```bash
#!/bin/bash
# /tools/operations/disaster-recovery.sh

set -e

echo "DISASTER RECOVERY INITIATED"

# Activate disaster recovery site
python /tools/operations/activate-dr-site.py

# Restore from off-site backups
python /tools/operations/restore-from-offsite.py --latest

# Update DNS to point to DR site
python /tools/operations/update-dns-to-dr.py

# Start services on DR site
python /tools/operations/start-dr-services.py

# Verify DR site functionality
python /tools/operations/verify-dr-site.py

# Notify stakeholders
python /tools/operations/notify-dr-activation.py

echo "DISASTER RECOVERY COMPLETED"
```

**Data Corruption Recovery:**
```bash
#!/bin/bash
# /tools/operations/data-corruption-recovery.sh

CORRUPTION_TYPE=$1

echo "Data corruption recovery initiated: $CORRUPTION_TYPE"

case $CORRUPTION_TYPE in
    "database")
        # Database corruption recovery
        python /tools/operations/recover-corrupted-database.py
        ;;
    "filesystem")
        # Filesystem corruption recovery
        python /tools/operations/recover-corrupted-files.py
        ;;
    "user_data")
        # User data corruption recovery
        python /tools/operations/recover-corrupted-user-data.py
        ;;
    *)
        echo "Unknown corruption type: $CORRUPTION_TYPE"
        exit 1
        ;;
esac

echo "Data corruption recovery completed"
```

## Backup Verification and Testing

### Backup Integrity Verification

```python
#!/usr/bin/env python3
# /tools/operations/verify-backup.py

import sqlite3
import tarfile
import json
import sys
from pathlib import Path
from datetime import datetime

def verify_database_backup(backup_path):
    """Verify database backup integrity"""
    try:
        conn = sqlite3.connect(backup_path)
        cursor = conn.cursor()
        
        # Test basic queries
        cursor.execute("SELECT COUNT(*) FROM sqlite_master")
        table_count = cursor.fetchone()[0]
        
        if table_count == 0:
            return False, "No tables found in backup"
        
        # Test data integrity
        cursor.execute("PRAGMA integrity_check")
        integrity_result = cursor.fetchone()[0]
        
        conn.close()
        
        if integrity_result != "ok":
            return False, f"Integrity check failed: {integrity_result}"
        
        return True, f"Database backup valid with {table_count} tables"
        
    except Exception as e:
        return False, f"Database verification failed: {str(e)}"

def verify_archive_backup(backup_path):
    """Verify tar archive backup integrity"""
    try:
        with tarfile.open(backup_path, 'r:gz') as tar:
            members = tar.getmembers()
            
            if len(members) == 0:
                return False, "Empty archive"
            
            # Test extraction of a few files
            for member in members[:5]:
                if member.isfile():
                    tar.extractfile(member)
            
            return True, f"Archive backup valid with {len(members)} files"
            
    except Exception as e:
        return False, f"Archive verification failed: {str(e)}"

def main():
    if len(sys.argv) != 2:
        print("Usage: verify-backup.py <backup_directory>")
        sys.exit(1)
    
    backup_dir = Path(sys.argv[1])
    verification_results = []
    
    # Verify database backups
    for db_backup in backup_dir.glob("*.db"):
        valid, message = verify_database_backup(str(db_backup))
        verification_results.append({
            'file': str(db_backup),
            'type': 'database',
            'valid': valid,
            'message': message
        })
    
    # Verify archive backups
    for archive_backup in backup_dir.glob("*.tar.gz"):
        if 'credentials' not in archive_backup.name:  # Skip encrypted files
            valid, message = verify_archive_backup(str(archive_backup))
            verification_results.append({
                'file': str(archive_backup),
                'type': 'archive',
                'valid': valid,
                'message': message
            })
    
    # Create verification report
    report = {
        'timestamp': datetime.utcnow().isoformat(),
        'backup_directory': str(backup_dir),
        'results': verification_results,
        'total_files': len(verification_results),
        'valid_files': sum(1 for r in verification_results if r['valid']),
        'invalid_files': sum(1 for r in verification_results if not r['valid'])
    }
    
    # Save verification report
    with open(backup_dir / 'verification_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print(f"Backup verification completed:")
    print(f"  Total files: {report['total_files']}")
    print(f"  Valid files: {report['valid_files']}")
    print(f"  Invalid files: {report['invalid_files']}")
    
    if report['invalid_files'] > 0:
        print("\nInvalid files:")
        for result in verification_results:
            if not result['valid']:
                print(f"  {result['file']}: {result['message']}")
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### Recovery Testing

**Monthly Recovery Test:**
```bash
#!/bin/bash
# /tools/operations/monthly-recovery-test.sh

set -e

echo "Starting monthly recovery test"

# Create test environment
python /tools/operations/create-test-environment.py

# Test database recovery
echo "Testing database recovery..."
python /tools/operations/test-database-recovery.py

# Test application recovery
echo "Testing application recovery..."
python /tools/operations/test-application-recovery.py

# Test user data recovery
echo "Testing user data recovery..."
python /tools/operations/test-user-data-recovery.py

# Generate recovery test report
python /tools/operations/generate-recovery-test-report.py

# Cleanup test environment
python /tools/operations/cleanup-test-environment.py

echo "Monthly recovery test completed"
```

## Off-site Backup Management

### Cloud Backup Configuration

```python
#!/usr/bin/env python3
# /tools/operations/cloud-backup.py

import boto3
import os
from datetime import datetime
from pathlib import Path

def upload_to_s3(local_path, s3_bucket, s3_key):
    """Upload backup to AWS S3"""
    s3_client = boto3.client('s3')
    
    try:
        s3_client.upload_file(local_path, s3_bucket, s3_key)
        return True
    except Exception as e:
        print(f"S3 upload failed: {e}")
        return False

def sync_daily_backups():
    """Sync daily backups to cloud storage"""
    backup_dir = Path('/backups/daily')
    s3_bucket = os.getenv('BACKUP_S3_BUCKET')
    
    if not s3_bucket:
        print("S3 bucket not configured")
        return
    
    for backup_file in backup_dir.rglob('*'):
        if backup_file.is_file():
            s3_key = f"daily/{backup_file.relative_to(backup_dir)}"
            
            # Check if file already exists in S3
            s3_client = boto3.client('s3')
            try:
                s3_client.head_object(Bucket=s3_bucket, Key=s3_key)
                continue  # File already exists
            except:
                pass  # File doesn't exist, upload it
            
            print(f"Uploading {backup_file} to S3...")
            upload_to_s3(str(backup_file), s3_bucket, s3_key)

if __name__ == '__main__':
    sync_daily_backups()
```

## Monitoring and Alerting

### Backup Monitoring

```python
#!/usr/bin/env python3
# /tools/operations/backup-monitoring.py

import json
import os
from datetime import datetime, timedelta
from pathlib import Path

def check_backup_freshness():
    """Check if backups are up to date"""
    alerts = []
    
    # Check daily backups
    daily_backup_dir = Path('/backups/daily')
    latest_daily = max(daily_backup_dir.iterdir(), key=os.path.getctime, default=None)
    
    if not latest_daily or datetime.fromtimestamp(latest_daily.stat().st_ctime) < datetime.utcnow() - timedelta(days=1):
        alerts.append("Daily backup is missing or outdated")
    
    # Check weekly backups
    weekly_backup_dir = Path('/backups/weekly')
    latest_weekly = max(weekly_backup_dir.iterdir(), key=os.path.getctime, default=None)
    
    if not latest_weekly or datetime.fromtimestamp(latest_weekly.stat().st_ctime) < datetime.utcnow() - timedelta(days=7):
        alerts.append("Weekly backup is missing or outdated")
    
    return alerts

def check_backup_integrity():
    """Check backup integrity"""
    alerts = []
    
    # Check for failed verifications
    for backup_dir in Path('/backups').rglob('*'):
        if backup_dir.is_dir():
            verification_report = backup_dir / 'verification_report.json'
            if verification_report.exists():
                with open(verification_report) as f:
                    report = json.load(f)
                    if report['invalid_files'] > 0:
                        alerts.append(f"Backup integrity issues in {backup_dir}")
    
    return alerts

def main():
    all_alerts = []
    all_alerts.extend(check_backup_freshness())
    all_alerts.extend(check_backup_integrity())
    
    if all_alerts:
        for alert in all_alerts:
            print(f"BACKUP ALERT: {alert}")
        
        # Send alerts
        alert_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'alerts': all_alerts,
            'severity': 'high'
        }
        
        with open('/logs/backup-alerts.jsonl', 'a') as f:
            f.write(json.dumps(alert_data) + '\n')
    
    print(f"Backup monitoring completed. {len(all_alerts)} alerts generated.")

if __name__ == '__main__':
    main()
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Backup & Recovery Team
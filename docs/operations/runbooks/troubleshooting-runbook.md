# Troubleshooting Runbook

## Overview

This runbook provides systematic troubleshooting procedures for common issues in FossaWork V2. It includes diagnostic steps, root cause analysis methods, and resolution procedures for various system components.

## Issue Classification and Response

### Severity Levels

**P1 - Critical (Immediate Response)**
- System completely down
- Database corruption
- Security breach
- Data loss
- Authentication system failure

**P2 - High (Response within 15 minutes)**
- Partial system outage
- Severe performance degradation
- Form automation failures >50%
- Database connectivity issues

**P3 - Medium (Response within 1 hour)**
- Individual feature failures
- Performance degradation <50%
- Non-critical errors
- User experience issues

**P4 - Low (Response within 4 hours)**
- Cosmetic issues
- Minor performance degradation
- Enhancement requests
- Documentation issues

### Initial Response Procedure

**Step 1: Rapid Assessment (2 minutes)**
```bash
# Quick system health check
python /tools/operations/quick-health-check.py

# Check service status
sudo systemctl status fossawork-backend
sudo systemctl status fossawork-frontend

# Review recent errors
tail -50 /logs/errors/*.jsonl

# Check system resources
df -h
free -h
top -n 1
```

**Step 2: Issue Categorization (3 minutes)**
- Identify affected components
- Determine user impact scope
- Assess data integrity
- Evaluate security implications

**Step 3: Initial Containment (5 minutes)**
- Stop spreading of issues
- Preserve evidence
- Protect data integrity
- Notify stakeholders if P1/P2

## System Component Troubleshooting

### Backend API Issues

**Common Symptoms:**
- API endpoints returning 500 errors
- Slow response times
- Connection timeouts
- Database connection errors

**Diagnostic Procedures:**

```python
#!/usr/bin/env python3
# /tools/operations/diagnose-backend.py

import requests
import sqlite3
import psutil
import json
import sys
from datetime import datetime

class BackendDiagnostics:
    def __init__(self):
        self.issues_found = []
        self.api_base = 'http://localhost:8000'
    
    def check_api_health(self):
        """Check API endpoint health"""
        endpoints = [
            '/api/health',
            '/api/auth/validate',
            '/api/work-orders',
            '/api/dispensers'
        ]
        
        for endpoint in endpoints:
            try:
                response = requests.get(f'{self.api_base}{endpoint}', timeout=5)
                if response.status_code != 200:
                    self.issues_found.append(f"API endpoint {endpoint} returned {response.status_code}")
            except requests.exceptions.ConnectionError:
                self.issues_found.append(f"Cannot connect to {endpoint}")
            except requests.exceptions.Timeout:
                self.issues_found.append(f"Timeout connecting to {endpoint}")
            except Exception as e:
                self.issues_found.append(f"Error with {endpoint}: {str(e)}")
    
    def check_database_connection(self):
        """Check database connectivity and integrity"""
        try:
            conn = sqlite3.connect('/backend/fossawork_v2.db', timeout=5)
            cursor = conn.cursor()
            
            # Test basic query
            cursor.execute('SELECT COUNT(*) FROM sqlite_master')
            table_count = cursor.fetchone()[0]
            
            if table_count == 0:
                self.issues_found.append("Database has no tables")
            
            # Test data integrity
            cursor.execute('PRAGMA integrity_check')
            integrity_result = cursor.fetchone()[0]
            
            if integrity_result != 'ok':
                self.issues_found.append(f"Database integrity check failed: {integrity_result}")
            
            conn.close()
            
        except sqlite3.OperationalError as e:
            self.issues_found.append(f"Database operational error: {str(e)}")
        except sqlite3.DatabaseError as e:
            self.issues_found.append(f"Database error: {str(e)}")
        except Exception as e:
            self.issues_found.append(f"Database connection error: {str(e)}")
    
    def check_backend_process(self):
        """Check backend process status and resources"""
        backend_processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cpu_percent', 'memory_percent']):
            try:
                if 'uvicorn' in proc.info['name'] or any('uvicorn' in cmd for cmd in proc.info['cmdline']):
                    backend_processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        if not backend_processes:
            self.issues_found.append("No backend (uvicorn) process found")
        elif len(backend_processes) > 1:
            self.issues_found.append(f"Multiple backend processes found: {len(backend_processes)}")
        else:
            proc = backend_processes[0]
            if proc['cpu_percent'] > 90:
                self.issues_found.append(f"Backend process high CPU: {proc['cpu_percent']}%")
            if proc['memory_percent'] > 90:
                self.issues_found.append(f"Backend process high memory: {proc['memory_percent']}%")
    
    def check_log_errors(self):
        """Check recent log errors"""
        try:
            with open('/logs/backend/backend-errors-latest.jsonl', 'r') as f:
                lines = f.readlines()
                recent_errors = lines[-10:]  # Last 10 errors
                
                if len(recent_errors) > 5:
                    self.issues_found.append(f"High error rate: {len(recent_errors)} recent errors")
                
                # Check for specific error patterns
                error_patterns = ['ConnectionError', 'DatabaseError', 'TimeoutError', 'MemoryError']
                for line in recent_errors:
                    try:
                        log_entry = json.loads(line)
                        message = log_entry.get('message', '')
                        for pattern in error_patterns:
                            if pattern in message:
                                self.issues_found.append(f"Critical error pattern found: {pattern}")
                                break
                    except:
                        continue
        except FileNotFoundError:
            self.issues_found.append("Backend error log file not found")
        except Exception as e:
            self.issues_found.append(f"Error reading logs: {str(e)}")
    
    def run_diagnostics(self):
        """Run complete backend diagnostics"""
        print("Running backend diagnostics...")
        
        self.check_api_health()
        self.check_database_connection()
        self.check_backend_process()
        self.check_log_errors()
        
        return self.issues_found

def main():
    diagnostics = BackendDiagnostics()
    issues = diagnostics.run_diagnostics()
    
    if issues:
        print(f"\n{len(issues)} issues found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        
        # Save diagnostic report
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'component': 'backend',
            'issues_found': issues,
            'severity': 'high' if len(issues) > 3 else 'medium'
        }
        
        with open('/logs/diagnostic-reports/backend-diagnosis.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        sys.exit(1)
    else:
        print("No backend issues detected")
        sys.exit(0)

if __name__ == '__main__':
    main()
```

**Resolution Procedures:**

```bash
#!/bin/bash
# /tools/operations/fix-backend-issues.sh

set -e

ISSUE_TYPE=$1

case $ISSUE_TYPE in
    "api_errors")
        echo "Fixing API errors..."
        
        # Restart backend service
        sudo systemctl restart fossawork-backend
        sleep 10
        
        # Verify service is running
        if ! sudo systemctl is-active --quiet fossawork-backend; then
            echo "Backend service failed to start, checking logs..."
            sudo journalctl -u fossawork-backend -n 20
            exit 1
        fi
        
        # Test API endpoints
        python /tools/operations/test-api-endpoints.py
        ;;
    
    "database_issues")
        echo "Fixing database issues..."
        
        # Stop backend to prevent writes
        sudo systemctl stop fossawork-backend
        
        # Backup current database
        cp /backend/fossawork_v2.db "/backups/emergency/fossawork_v2_$(date +%Y%m%d_%H%M%S).db"
        
        # Check and repair database
        sqlite3 /backend/fossawork_v2.db "PRAGMA integrity_check;"
        sqlite3 /backend/fossawork_v2.db "VACUUM;"
        sqlite3 /backend/fossawork_v2.db "REINDEX;"
        
        # Restart backend
        sudo systemctl start fossawork-backend
        ;;
    
    "performance_issues")
        echo "Fixing performance issues..."
        
        # Clear log files that might be too large
        find /logs -name "*.jsonl" -size +100M -exec truncate -s 50M {} \;
        
        # Restart services to clear memory
        sudo systemctl restart fossawork-backend
        sudo systemctl restart fossawork-frontend
        
        # Run database optimization
        python /tools/operations/optimize-database.py
        ;;
    
    "memory_issues")
        echo "Fixing memory issues..."
        
        # Force garbage collection and restart
        sudo systemctl restart fossawork-backend
        
        # Check for memory leaks
        python /tools/operations/check-memory-leaks.py
        ;;
    
    *)
        echo "Unknown issue type: $ISSUE_TYPE"
        echo "Available types: api_errors, database_issues, performance_issues, memory_issues"
        exit 1
        ;;
esac

echo "Backend issue resolution completed"
```

### Frontend Issues

**Common Symptoms:**
- Page not loading
- JavaScript errors
- Slow page load times
- UI components not responding

**Diagnostic Procedures:**

```python
#!/usr/bin/env python3
# /tools/operations/diagnose-frontend.py

import requests
import json
import subprocess
import psutil
from datetime import datetime

class FrontendDiagnostics:
    def __init__(self):
        self.issues_found = []
        self.frontend_url = 'http://localhost:5173'
    
    def check_frontend_accessibility(self):
        """Check if frontend is accessible"""
        try:
            response = requests.get(self.frontend_url, timeout=10)
            if response.status_code != 200:
                self.issues_found.append(f"Frontend returned status code {response.status_code}")
            
            # Check for basic HTML structure
            if '<html' not in response.text.lower():
                self.issues_found.append("Frontend response doesn't contain valid HTML")
                
        except requests.exceptions.ConnectionError:
            self.issues_found.append("Cannot connect to frontend server")
        except requests.exceptions.Timeout:
            self.issues_found.append("Frontend connection timeout")
        except Exception as e:
            self.issues_found.append(f"Frontend connection error: {str(e)}")
    
    def check_frontend_process(self):
        """Check frontend development server process"""
        frontend_processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cpu_percent', 'memory_percent']):
            try:
                cmdline = ' '.join(proc.info['cmdline'])
                if 'npm run dev' in cmdline or 'vite' in cmdline:
                    frontend_processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        if not frontend_processes:
            self.issues_found.append("No frontend development server process found")
        elif len(frontend_processes) > 1:
            self.issues_found.append(f"Multiple frontend processes found: {len(frontend_processes)}")
    
    def check_node_modules(self):
        """Check if node_modules and dependencies are installed"""
        try:
            result = subprocess.run(['npm', 'ls'], cwd='/frontend', 
                                 capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                if 'missing' in result.stderr.lower():
                    self.issues_found.append("Missing npm dependencies")
                else:
                    self.issues_found.append("npm dependency issues detected")
        except subprocess.TimeoutExpired:
            self.issues_found.append("npm ls command timed out")
        except Exception as e:
            self.issues_found.append(f"Error checking dependencies: {str(e)}")
    
    def check_build_errors(self):
        """Check for build/compilation errors"""
        try:
            # Check if there are TypeScript compilation errors
            result = subprocess.run(['npx', 'tsc', '--noEmit'], cwd='/frontend',
                                 capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0 and result.stderr:
                self.issues_found.append("TypeScript compilation errors found")
        except subprocess.TimeoutExpired:
            self.issues_found.append("TypeScript check timed out")
        except Exception as e:
            self.issues_found.append(f"Error checking TypeScript: {str(e)}")
    
    def run_diagnostics(self):
        """Run complete frontend diagnostics"""
        print("Running frontend diagnostics...")
        
        self.check_frontend_accessibility()
        self.check_frontend_process()
        self.check_node_modules()
        self.check_build_errors()
        
        return self.issues_found

def main():
    diagnostics = FrontendDiagnostics()
    issues = diagnostics.run_diagnostics()
    
    if issues:
        print(f"\n{len(issues)} issues found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        
        # Save diagnostic report
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'component': 'frontend',
            'issues_found': issues,
            'severity': 'high' if len(issues) > 2 else 'medium'
        }
        
        with open('/logs/diagnostic-reports/frontend-diagnosis.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        return 1
    else:
        print("No frontend issues detected")
        return 0

if __name__ == '__main__':
    exit(main())
```

**Resolution Procedures:**

```bash
#!/bin/bash
# /tools/operations/fix-frontend-issues.sh

set -e

ISSUE_TYPE=$1

case $ISSUE_TYPE in
    "server_not_running")
        echo "Starting frontend development server..."
        
        cd /frontend
        
        # Kill any existing processes
        pkill -f "npm run dev" || true
        pkill -f "vite" || true
        
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies..."
            npm install
        fi
        
        # Start development server
        npm run dev &
        
        # Wait and verify
        sleep 10
        if curl -f http://localhost:5173/ > /dev/null 2>&1; then
            echo "Frontend server started successfully"
        else
            echo "Frontend server failed to start"
            exit 1
        fi
        ;;
    
    "dependency_issues")
        echo "Fixing dependency issues..."
        
        cd /frontend
        
        # Clean install dependencies
        rm -rf node_modules package-lock.json
        npm install
        
        # Verify installation
        npm ls || echo "Some dependency warnings are normal"
        ;;
    
    "build_errors")
        echo "Fixing build errors..."
        
        cd /frontend
        
        # Clean cache
        npm run clean || true
        rm -rf dist/
        
        # Reinstall dependencies
        npm install
        
        # Try to build
        npm run build
        ;;
    
    "cache_issues")
        echo "Clearing frontend caches..."
        
        cd /frontend
        
        # Clear npm cache
        npm cache clean --force
        
        # Clear Vite cache
        rm -rf node_modules/.vite
        
        # Restart development server
        pkill -f "npm run dev" || true
        npm run dev &
        ;;
    
    *)
        echo "Unknown issue type: $ISSUE_TYPE"
        echo "Available types: server_not_running, dependency_issues, build_errors, cache_issues"
        exit 1
        ;;
esac

echo "Frontend issue resolution completed"
```

### Database Issues

**Common Symptoms:**
- Database connection failures
- Slow query performance
- Data corruption
- Lock timeouts

**Diagnostic Procedures:**

```python
#!/usr/bin/env python3
# /tools/operations/diagnose-database.py

import sqlite3
import os
import json
import time
from datetime import datetime
from pathlib import Path

class DatabaseDiagnostics:
    def __init__(self, db_path='/backend/fossawork_v2.db'):
        self.db_path = db_path
        self.issues_found = []
    
    def check_database_file(self):
        """Check database file accessibility and basic properties"""
        if not Path(self.db_path).exists():
            self.issues_found.append(f"Database file not found: {self.db_path}")
            return
        
        # Check file permissions
        if not os.access(self.db_path, os.R_OK):
            self.issues_found.append("Database file is not readable")
        
        if not os.access(self.db_path, os.W_OK):
            self.issues_found.append("Database file is not writable")
        
        # Check file size
        file_size = Path(self.db_path).stat().st_size
        if file_size == 0:
            self.issues_found.append("Database file is empty")
        elif file_size > 1024 * 1024 * 1024:  # 1GB
            self.issues_found.append(f"Database file is very large: {file_size / (1024*1024):.1f}MB")
    
    def check_database_integrity(self):
        """Check database integrity and structure"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=10)
            cursor = conn.cursor()
            
            # Integrity check
            cursor.execute('PRAGMA integrity_check')
            integrity_result = cursor.fetchone()[0]
            if integrity_result != 'ok':
                self.issues_found.append(f"Database integrity check failed: {integrity_result}")
            
            # Check for tables
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            if table_count == 0:
                self.issues_found.append("Database has no tables")
            
            # Check for foreign key errors
            cursor.execute('PRAGMA foreign_key_check')
            fk_errors = cursor.fetchall()
            if fk_errors:
                self.issues_found.append(f"Foreign key constraint violations: {len(fk_errors)}")
            
            conn.close()
            
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower():
                self.issues_found.append("Database is locked")
            else:
                self.issues_found.append(f"Database operational error: {str(e)}")
        except Exception as e:
            self.issues_found.append(f"Database connection error: {str(e)}")
    
    def check_database_performance(self):
        """Check database query performance"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=10)
            cursor = conn.cursor()
            
            # Test query performance
            test_queries = [
                'SELECT COUNT(*) FROM work_orders',
                'SELECT COUNT(*) FROM dispensers',
            ]
            
            for query in test_queries:
                start_time = time.time()
                cursor.execute(query)
                cursor.fetchone()
                query_time = time.time() - start_time
                
                if query_time > 5.0:  # Slow query threshold
                    self.issues_found.append(f"Slow query detected: {query} ({query_time:.2f}s)")
            
            conn.close()
            
        except Exception as e:
            self.issues_found.append(f"Database performance check error: {str(e)}")
    
    def check_database_locks(self):
        """Check for database locks and blocking processes"""
        try:
            # Try to open database with short timeout
            conn = sqlite3.connect(self.db_path, timeout=1)
            
            # Try a quick write operation
            cursor = conn.cursor()
            cursor.execute('BEGIN IMMEDIATE')
            cursor.execute('ROLLBACK')
            
            conn.close()
            
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower():
                self.issues_found.append("Database is currently locked")
            else:
                self.issues_found.append(f"Database lock check error: {str(e)}")
    
    def analyze_database_size(self):
        """Analyze database size and suggest optimizations"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get page count and page size
            cursor.execute('PRAGMA page_count')
            page_count = cursor.fetchone()[0]
            
            cursor.execute('PRAGMA page_size')
            page_size = cursor.fetchone()[0]
            
            db_size = page_count * page_size
            
            # Check for unused pages
            cursor.execute('PRAGMA freelist_count')
            free_pages = cursor.fetchone()[0]
            
            if free_pages > page_count * 0.1:  # More than 10% free pages
                self.issues_found.append(f"Database has many unused pages: {free_pages}/{page_count}")
            
            # Check table sizes
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            large_tables = []
            for table_name, in tables:
                try:
                    cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
                    row_count = cursor.fetchone()[0]
                    if row_count > 100000:  # Large table threshold
                        large_tables.append((table_name, row_count))
                except:
                    continue
            
            if large_tables:
                for table_name, row_count in large_tables:
                    self.issues_found.append(f"Large table detected: {table_name} ({row_count} rows)")
            
            conn.close()
            
        except Exception as e:
            self.issues_found.append(f"Database size analysis error: {str(e)}")
    
    def run_diagnostics(self):
        """Run complete database diagnostics"""
        print("Running database diagnostics...")
        
        self.check_database_file()
        self.check_database_integrity()
        self.check_database_performance()
        self.check_database_locks()
        self.analyze_database_size()
        
        return self.issues_found

def main():
    diagnostics = DatabaseDiagnostics()
    issues = diagnostics.run_diagnostics()
    
    if issues:
        print(f"\n{len(issues)} issues found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        
        # Save diagnostic report
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'component': 'database',
            'database_path': diagnostics.db_path,
            'issues_found': issues,
            'severity': 'critical' if len(issues) > 3 else 'high'
        }
        
        with open('/logs/diagnostic-reports/database-diagnosis.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        return 1
    else:
        print("No database issues detected")
        return 0

if __name__ == '__main__':
    exit(main())
```

### Authentication Issues

**Common Symptoms:**
- Login failures
- Token validation errors
- Session timeouts
- Unauthorized access errors

**Diagnostic Procedures:**

```python
#!/usr/bin/env python3
# /tools/operations/diagnose-authentication.py

import requests
import json
import jwt
from datetime import datetime
import os

class AuthenticationDiagnostics:
    def __init__(self):
        self.issues_found = []
        self.api_base = 'http://localhost:8000'
    
    def check_auth_endpoints(self):
        """Check authentication endpoint accessibility"""
        auth_endpoints = [
            '/api/auth/login',
            '/api/auth/validate',
            '/api/auth/logout'
        ]
        
        for endpoint in auth_endpoints:
            try:
                # Test with OPTIONS to check if endpoint exists
                response = requests.options(f'{self.api_base}{endpoint}', timeout=5)
                if response.status_code not in [200, 405]:  # 405 is acceptable for OPTIONS
                    self.issues_found.append(f"Auth endpoint {endpoint} not accessible")
            except Exception as e:
                self.issues_found.append(f"Auth endpoint {endpoint} error: {str(e)}")
    
    def check_jwt_configuration(self):
        """Check JWT configuration and secret"""
        try:
            # Check if JWT secret is configured
            secret_key = os.getenv('SECRET_KEY')
            if not secret_key:
                self.issues_found.append("JWT SECRET_KEY not configured")
            elif len(secret_key) < 32:
                self.issues_found.append("JWT SECRET_KEY is too short (should be at least 32 characters)")
        except Exception as e:
            self.issues_found.append(f"JWT configuration check error: {str(e)}")
    
    def test_login_flow(self):
        """Test complete login flow with test credentials"""
        try:
            # Attempt login with test credentials
            login_data = {
                'username': 'test@example.com',
                'password': 'testpassword'
            }
            
            response = requests.post(f'{self.api_base}/api/auth/login', 
                                   json=login_data, timeout=10)
            
            if response.status_code == 500:
                self.issues_found.append("Login endpoint returning server error")
            elif response.status_code == 404:
                self.issues_found.append("Login endpoint not found")
            elif response.status_code not in [200, 401]:  # 401 is expected for invalid creds
                self.issues_found.append(f"Login endpoint unexpected status: {response.status_code}")
                
        except requests.exceptions.ConnectionError:
            self.issues_found.append("Cannot connect to authentication service")
        except Exception as e:
            self.issues_found.append(f"Login flow test error: {str(e)}")
    
    def check_token_validation(self):
        """Test token validation functionality"""
        try:
            # Test with invalid token
            headers = {'Authorization': 'Bearer invalid_token'}
            response = requests.get(f'{self.api_base}/api/auth/validate',
                                  headers=headers, timeout=5)
            
            if response.status_code == 500:
                self.issues_found.append("Token validation returning server error")
            elif response.status_code not in [401, 403]:  # Should reject invalid token
                self.issues_found.append(f"Token validation unexpected behavior: {response.status_code}")
                
        except Exception as e:
            self.issues_found.append(f"Token validation test error: {str(e)}")
    
    def check_credential_storage(self):
        """Check credential storage system"""
        credentials_dir = '/backend/data/credentials'
        
        if not os.path.exists(credentials_dir):
            self.issues_found.append("Credentials directory not found")
        else:
            # Check permissions
            if not os.access(credentials_dir, os.R_OK):
                self.issues_found.append("Credentials directory not readable")
            if not os.access(credentials_dir, os.W_OK):
                self.issues_found.append("Credentials directory not writable")
            
            # Check for credential files
            credential_files = os.listdir(credentials_dir)
            if not credential_files:
                self.issues_found.append("No credential files found")
    
    def run_diagnostics(self):
        """Run complete authentication diagnostics"""
        print("Running authentication diagnostics...")
        
        self.check_auth_endpoints()
        self.check_jwt_configuration()
        self.test_login_flow()
        self.check_token_validation()
        self.check_credential_storage()
        
        return self.issues_found

def main():
    diagnostics = AuthenticationDiagnostics()
    issues = diagnostics.run_diagnostics()
    
    if issues:
        print(f"\n{len(issues)} authentication issues found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        
        # Save diagnostic report
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'component': 'authentication',
            'issues_found': issues,
            'severity': 'critical' if len(issues) > 2 else 'high'
        }
        
        with open('/logs/diagnostic-reports/auth-diagnosis.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        return 1
    else:
        print("No authentication issues detected")
        return 0

if __name__ == '__main__':
    exit(main())
```

## Performance Issues

### Slow Response Times

**Diagnostic Steps:**
```bash
#!/bin/bash
# /tools/operations/diagnose-performance.sh

echo "Diagnosing performance issues..."

# Check system resources
echo "=== System Resources ==="
echo "CPU Usage:"
top -n1 | head -5

echo -e "\nMemory Usage:"
free -h

echo -e "\nDisk Usage:"
df -h

echo -e "\nDisk I/O:"
iostat -x 1 1

# Check database performance
echo -e "\n=== Database Performance ==="
python /tools/operations/analyze-database-performance.py

# Check API response times
echo -e "\n=== API Performance ==="
python /tools/operations/test-api-performance.py

# Check for resource bottlenecks
echo -e "\n=== Resource Bottlenecks ==="
python /tools/operations/identify-bottlenecks.py

# Check log file sizes
echo -e "\n=== Log File Sizes ==="
du -sh /logs/*

echo "Performance diagnostics completed"
```

**Resolution Steps:**
```bash
#!/bin/bash
# /tools/operations/resolve-performance-issues.sh

ISSUE_TYPE=$1

case $ISSUE_TYPE in
    "high_cpu")
        echo "Resolving high CPU usage..."
        
        # Identify CPU-intensive processes
        ps aux --sort=-%cpu | head -10
        
        # Restart services to clear any runaway processes
        sudo systemctl restart fossawork-backend
        sudo systemctl restart fossawork-frontend
        
        # Check for background tasks
        python /tools/operations/check-background-tasks.py
        ;;
    
    "high_memory")
        echo "Resolving high memory usage..."
        
        # Clear system caches
        sync && echo 3 > /proc/sys/vm/drop_caches
        
        # Restart services to free memory
        sudo systemctl restart fossawork-backend
        
        # Check for memory leaks
        python /tools/operations/check-memory-leaks.py
        ;;
    
    "slow_database")
        echo "Resolving slow database performance..."
        
        # Optimize database
        python /tools/operations/optimize-database.py
        
        # Check for long-running queries
        python /tools/operations/check-slow-queries.py
        ;;
    
    "disk_io")
        echo "Resolving disk I/O issues..."
        
        # Clear large log files
        find /logs -name "*.jsonl" -size +100M -exec truncate -s 50M {} \;
        
        # Optimize database storage
        sqlite3 /backend/fossawork_v2.db "VACUUM;"
        ;;
    
    *)
        echo "Unknown performance issue type: $ISSUE_TYPE"
        echo "Available types: high_cpu, high_memory, slow_database, disk_io"
        exit 1
        ;;
esac

echo "Performance issue resolution completed"
```

## Automation Issues

### Form Automation Failures

**Diagnostic Procedures:**
```python
#!/usr/bin/env python3
# /tools/operations/diagnose-automation.py

import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

class AutomationDiagnostics:
    def __init__(self):
        self.issues_found = []
    
    def check_playwright_installation(self):
        """Check Playwright browser installation"""
        try:
            result = subprocess.run(['playwright', 'install-deps'], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                self.issues_found.append("Playwright dependencies not properly installed")
        except Exception as e:
            self.issues_found.append(f"Playwright check error: {str(e)}")
    
    def check_automation_logs(self):
        """Check recent automation logs for failures"""
        automation_log_dir = Path('/logs/automation')
        if not automation_log_dir.exists():
            self.issues_found.append("Automation log directory not found")
            return
        
        # Check recent automation logs
        recent_logs = []
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        
        for log_file in automation_log_dir.glob('*.jsonl'):
            if datetime.fromtimestamp(log_file.stat().st_mtime) > cutoff_time:
                recent_logs.append(log_file)
        
        if not recent_logs:
            self.issues_found.append("No recent automation logs found")
            return
        
        # Analyze failure patterns
        total_attempts = 0
        failures = 0
        
        for log_file in recent_logs:
            try:
                with open(log_file, 'r') as f:
                    for line in f:
                        try:
                            log_entry = json.loads(line)
                            if 'automation' in log_entry.get('type', ''):
                                total_attempts += 1
                                if log_entry.get('status') == 'failed':
                                    failures += 1
                        except:
                            continue
            except:
                continue
        
        if total_attempts > 0:
            failure_rate = (failures / total_attempts) * 100
            if failure_rate > 20:  # High failure rate threshold
                self.issues_found.append(f"High automation failure rate: {failure_rate:.1f}%")
    
    def check_workfossa_connectivity(self):
        """Check connectivity to WorkFossa"""
        try:
            import requests
            response = requests.get('https://app.workfossa.com', timeout=10)
            if response.status_code != 200:
                self.issues_found.append(f"WorkFossa not accessible: status {response.status_code}")
        except Exception as e:
            self.issues_found.append(f"WorkFossa connectivity error: {str(e)}")
    
    def check_browser_processes(self):
        """Check for zombie browser processes"""
        try:
            result = subprocess.run(['pgrep', '-f', 'chromium'], 
                                  capture_output=True, text=True)
            if result.stdout.strip():
                process_count = len(result.stdout.strip().split('\n'))
                if process_count > 5:  # Too many browser processes
                    self.issues_found.append(f"Too many browser processes running: {process_count}")
        except:
            pass
    
    def run_diagnostics(self):
        """Run complete automation diagnostics"""
        print("Running automation diagnostics...")
        
        self.check_playwright_installation()
        self.check_automation_logs()
        self.check_workfossa_connectivity()
        self.check_browser_processes()
        
        return self.issues_found

def main():
    diagnostics = AutomationDiagnostics()
    issues = diagnostics.run_diagnostics()
    
    if issues:
        print(f"\n{len(issues)} automation issues found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        
        # Save diagnostic report
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'component': 'automation',
            'issues_found': issues,
            'severity': 'high' if len(issues) > 2 else 'medium'
        }
        
        with open('/logs/diagnostic-reports/automation-diagnosis.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        return 1
    else:
        print("No automation issues detected")
        return 0

if __name__ == '__main__':
    exit(main())
```

**Resolution Procedures:**
```bash
#!/bin/bash
# /tools/operations/fix-automation-issues.sh

set -e

ISSUE_TYPE=$1

case $ISSUE_TYPE in
    "browser_issues")
        echo "Fixing browser automation issues..."
        
        # Kill zombie browser processes
        pkill -f chromium || true
        pkill -f firefox || true
        
        # Reinstall browser dependencies
        cd /backend
        playwright install chromium
        playwright install-deps
        
        # Test browser launch
        python -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    browser.close()
print('Browser test successful')
"
        ;;
    
    "workfossa_connectivity")
        echo "Fixing WorkFossa connectivity issues..."
        
        # Test network connectivity
        ping -c 3 app.workfossa.com
        
        # Check DNS resolution
        nslookup app.workfossa.com
        
        # Test HTTPS connectivity
        curl -I https://app.workfossa.com
        ;;
    
    "high_failure_rate")
        echo "Addressing high automation failure rate..."
        
        # Clear automation queue
        python /tools/operations/clear-automation-queue.py
        
        # Reset automation state
        python /tools/operations/reset-automation-state.py
        
        # Run test automation
        python /tools/operations/test-automation.py
        ;;
    
    "credential_issues")
        echo "Fixing credential issues..."
        
        # Verify credential files exist
        ls -la /backend/data/credentials/
        
        # Test credential validation
        python /tools/operations/test-credentials.py
        ;;
    
    *)
        echo "Unknown automation issue type: $ISSUE_TYPE"
        echo "Available types: browser_issues, workfossa_connectivity, high_failure_rate, credential_issues"
        exit 1
        ;;
esac

echo "Automation issue resolution completed"
```

## System Recovery Procedures

### Emergency System Recovery

**Complete System Recovery:**
```bash
#!/bin/bash
# /tools/operations/emergency-system-recovery.sh

set -e

echo "=== EMERGENCY SYSTEM RECOVERY INITIATED ==="

# Step 1: Stop all services
echo "Stopping all services..."
sudo systemctl stop fossawork-backend || true
sudo systemctl stop fossawork-frontend || true
sudo systemctl stop nginx || true

# Step 2: Check system resources
echo "Checking system resources..."
df -h
free -h

# Step 3: Create emergency backup
echo "Creating emergency backup..."
EMERGENCY_BACKUP="/backups/emergency/emergency_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EMERGENCY_BACKUP"
cp /backend/fossawork_v2.db "$EMERGENCY_BACKUP/" || true
tar -czf "$EMERGENCY_BACKUP/data.tar.gz" /backend/data/ || true

# Step 4: Clear problematic files
echo "Clearing problematic files..."
find /logs -name "*.jsonl" -size +500M -exec rm {} \; || true
find /tmp -name "playwright*" -type d -exec rm -rf {} \; || true

# Step 5: Reset services
echo "Resetting services..."
sudo systemctl daemon-reload

# Step 6: Start services one by one
echo "Starting backend service..."
sudo systemctl start fossawork-backend
sleep 15

if sudo systemctl is-active --quiet fossawork-backend; then
    echo "Backend service started successfully"
else
    echo "Backend service failed to start"
    sudo journalctl -u fossawork-backend -n 20
    exit 1
fi

echo "Starting frontend service..."
cd /frontend
npm run dev &
sleep 10

if curl -f http://localhost:5173/ > /dev/null 2>&1; then
    echo "Frontend service started successfully"
else
    echo "Frontend service failed to start"
    exit 1
fi

# Step 7: Verify system health
echo "Verifying system health..."
python /tools/operations/health-check.py --comprehensive

echo "=== EMERGENCY SYSTEM RECOVERY COMPLETED ==="
```

### Database Recovery

**Database Corruption Recovery:**
```bash
#!/bin/bash
# /tools/operations/recover-corrupted-database.sh

set -e

echo "=== DATABASE CORRUPTION RECOVERY ==="

DB_PATH="/backend/fossawork_v2.db"
BACKUP_PATH="/backups/database-recovery/corrupted_$(date +%Y%m%d_%H%M%S).db"

# Step 1: Stop backend service
sudo systemctl stop fossawork-backend

# Step 2: Backup corrupted database
mkdir -p "/backups/database-recovery"
cp "$DB_PATH" "$BACKUP_PATH"
echo "Corrupted database backed up to: $BACKUP_PATH"

# Step 3: Try to recover using SQLite tools
echo "Attempting database recovery..."

# Try integrity check first
if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "Database integrity check passed"
else
    echo "Database integrity check failed, attempting recovery..."
    
    # Try to dump and restore
    DUMP_FILE="/tmp/database_dump.sql"
    if sqlite3 "$DB_PATH" ".dump" > "$DUMP_FILE" 2>/dev/null; then
        echo "Database dump successful, rebuilding..."
        
        # Create new database from dump
        rm "$DB_PATH"
        sqlite3 "$DB_PATH" < "$DUMP_FILE"
        rm "$DUMP_FILE"
        
        echo "Database rebuilt from dump"
    else
        echo "Database dump failed, restoring from backup..."
        
        # Find latest good backup
        LATEST_BACKUP=$(find /backups -name "*.db" -type f -mtime -7 | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            cp "$LATEST_BACKUP" "$DB_PATH"
            echo "Database restored from backup: $LATEST_BACKUP"
        else
            echo "No recent backup found, creating new database..."
            rm "$DB_PATH"
            # The application will create a new database on startup
        fi
    fi
fi

# Step 4: Optimize recovered database
echo "Optimizing recovered database..."
sqlite3 "$DB_PATH" "VACUUM; ANALYZE; REINDEX;"

# Step 5: Restart backend service
sudo systemctl start fossawork-backend

# Step 6: Verify recovery
sleep 10
python /tools/operations/verify-database-recovery.py

echo "=== DATABASE RECOVERY COMPLETED ==="
```

## Monitoring and Alerting

### Automated Issue Detection

**Issue Detection Service:**
```python
#!/usr/bin/env python3
# /tools/operations/automated-issue-detection.py

import time
import json
import subprocess
from datetime import datetime
from pathlib import Path

class AutomatedIssueDetector:
    def __init__(self):
        self.detection_rules = [
            self.detect_high_error_rate,
            self.detect_service_failures,
            self.detect_performance_degradation,
            self.detect_disk_space_issues,
            self.detect_database_issues
        ]
    
    def detect_high_error_rate(self):
        """Detect high error rates in logs"""
        issues = []
        try:
            # Count recent errors
            error_count = 0
            cutoff_time = time.time() - 3600  # Last hour
            
            for log_file in Path('/logs/errors').glob('*.jsonl'):
                if log_file.stat().st_mtime > cutoff_time:
                    with open(log_file, 'r') as f:
                        error_count += sum(1 for line in f)
            
            if error_count > 50:  # High error threshold
                issues.append({
                    'type': 'high_error_rate',
                    'severity': 'high',
                    'message': f'High error rate detected: {error_count} errors in last hour',
                    'auto_fix': 'restart_services'
                })
        except Exception as e:
            pass
        
        return issues
    
    def detect_service_failures(self):
        """Detect service failures"""
        issues = []
        services = ['fossawork-backend', 'fossawork-frontend']
        
        for service in services:
            try:
                result = subprocess.run(['systemctl', 'is-active', service],
                                     capture_output=True, text=True)
                if result.stdout.strip() != 'active':
                    issues.append({
                        'type': 'service_failure',
                        'severity': 'critical',
                        'message': f'Service {service} is not active',
                        'auto_fix': f'restart_service:{service}'
                    })
            except:
                pass
        
        return issues
    
    def detect_performance_degradation(self):
        """Detect performance issues"""
        issues = []
        try:
            import psutil
            
            # Check CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            if cpu_percent > 90:
                issues.append({
                    'type': 'high_cpu',
                    'severity': 'high',
                    'message': f'High CPU usage: {cpu_percent}%',
                    'auto_fix': 'optimize_processes'
                })
            
            # Check memory usage
            memory = psutil.virtual_memory()
            if memory.percent > 90:
                issues.append({
                    'type': 'high_memory',
                    'severity': 'high',
                    'message': f'High memory usage: {memory.percent}%',
                    'auto_fix': 'clear_memory'
                })
        except:
            pass
        
        return issues
    
    def detect_disk_space_issues(self):
        """Detect disk space problems"""
        issues = []
        try:
            import shutil
            
            total, used, free = shutil.disk_usage('/')
            usage_percent = (used / total) * 100
            
            if usage_percent > 90:
                issues.append({
                    'type': 'disk_space',
                    'severity': 'high',
                    'message': f'Low disk space: {usage_percent:.1f}% used',
                    'auto_fix': 'cleanup_logs'
                })
        except:
            pass
        
        return issues
    
    def detect_database_issues(self):
        """Detect database problems"""
        issues = []
        try:
            import sqlite3
            
            # Try quick database connection
            conn = sqlite3.connect('/backend/fossawork_v2.db', timeout=5)
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            conn.close()
            
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower():
                issues.append({
                    'type': 'database_locked',
                    'severity': 'high',
                    'message': 'Database is locked',
                    'auto_fix': 'restart_backend'
                })
            else:
                issues.append({
                    'type': 'database_error',
                    'severity': 'critical',
                    'message': f'Database error: {str(e)}',
                    'auto_fix': 'check_database'
                })
        except Exception as e:
            issues.append({
                'type': 'database_connection',
                'severity': 'critical',
                'message': f'Cannot connect to database: {str(e)}',
                'auto_fix': 'restart_backend'
            })
        
        return issues
    
    def auto_fix_issue(self, issue):
        """Attempt automatic fix for detected issue"""
        auto_fix = issue.get('auto_fix')
        if not auto_fix:
            return False
        
        try:
            if auto_fix == 'restart_services':
                subprocess.run(['sudo', 'systemctl', 'restart', 'fossawork-backend'])
                subprocess.run(['sudo', 'systemctl', 'restart', 'fossawork-frontend'])
                return True
            
            elif auto_fix.startswith('restart_service:'):
                service = auto_fix.split(':')[1]
                subprocess.run(['sudo', 'systemctl', 'restart', service])
                return True
            
            elif auto_fix == 'cleanup_logs':
                subprocess.run(['find', '/logs', '-name', '*.jsonl', '-size', '+100M', 
                              '-exec', 'truncate', '-s', '50M', '{}', ';'])
                return True
            
            elif auto_fix == 'clear_memory':
                subprocess.run(['sudo', 'systemctl', 'restart', 'fossawork-backend'])
                return True
            
            # Add more auto-fix procedures as needed
            
        except Exception as e:
            return False
        
        return False
    
    def run_detection_cycle(self):
        """Run complete issue detection cycle"""
        all_issues = []
        
        for detection_rule in self.detection_rules:
            try:
                issues = detection_rule()
                all_issues.extend(issues)
            except Exception as e:
                continue
        
        # Log detected issues
        if all_issues:
            detection_report = {
                'timestamp': datetime.utcnow().isoformat(),
                'issues_detected': len(all_issues),
                'issues': all_issues
            }
            
            with open('/logs/issue-detection.jsonl', 'a') as f:
                f.write(json.dumps(detection_report) + '\n')
            
            # Attempt auto-fixes for critical issues
            for issue in all_issues:
                if issue['severity'] == 'critical':
                    print(f"Attempting auto-fix for: {issue['message']}")
                    if self.auto_fix_issue(issue):
                        print(f"Auto-fix successful for: {issue['type']}")
                    else:
                        print(f"Auto-fix failed for: {issue['type']}")
        
        return all_issues

def main():
    detector = AutomatedIssueDetector()
    
    while True:
        issues = detector.run_detection_cycle()
        
        if issues:
            print(f"Detected {len(issues)} issues at {datetime.utcnow()}")
            for issue in issues:
                print(f"  {issue['severity'].upper()}: {issue['message']}")
        
        # Wait 5 minutes before next detection cycle
        time.sleep(300)

if __name__ == '__main__':
    main()
```

## Documentation and Knowledge Base

### Troubleshooting Knowledge Base

**Common Issues Database:**
```json
{
  "common_issues": {
    "backend_not_starting": {
      "symptoms": [
        "systemctl status shows failed",
        "Port 8000 not responding",
        "Import errors in logs"
      ],
      "causes": [
        "Missing dependencies",
        "Database file permissions",
        "Port already in use",
        "Configuration errors"
      ],
      "solutions": [
        "pip install -r requirements.txt",
        "chown www-data:www-data /backend/fossawork_v2.db",
        "pkill -f uvicorn && systemctl start fossawork-backend",
        "Check .env file configuration"
      ]
    },
    "frontend_build_errors": {
      "symptoms": [
        "npm run build fails",
        "TypeScript compilation errors",
        "Module not found errors"
      ],
      "causes": [
        "Missing node_modules",
        "TypeScript version mismatch",
        "Import path errors",
        "Dependency conflicts"
      ],
      "solutions": [
        "rm -rf node_modules && npm install",
        "npm install typescript@latest",
        "Fix import paths in affected files",
        "npm audit fix"
      ]
    },
    "database_locked": {
      "symptoms": [
        "SQLite database is locked error",
        "Cannot connect to database",
        "Operations timeout"
      ],
      "causes": [
        "Long-running transaction",
        "Zombie process holding lock",
        "File system issues",
        "Concurrent access"
      ],
      "solutions": [
        "systemctl restart fossawork-backend",
        "pkill -f python && systemctl start fossawork-backend",
        "fsck /dev/sda1 (filesystem check)",
        "Implement connection pooling"
      ]
    }
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Operations Team
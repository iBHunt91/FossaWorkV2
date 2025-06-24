#!/usr/bin/env python3
"""
FossaWork V2 Health Check Tool

Comprehensive health monitoring for all system components including:
- Backend API services
- Frontend application
- Database connectivity and integrity
- System resources
- Authentication systems
- External dependencies

Usage:
    python health-check.py [--comprehensive] [--quiet] [--json] [--scheduled]
"""

import argparse
import json
import logging
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple

import psutil
import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HealthChecker:
    def __init__(self, comprehensive: bool = False, quiet: bool = False):
        self.comprehensive = comprehensive
        self.quiet = quiet
        self.results = {}
        self.issues = []
        self.start_time = time.time()
        
        # Configuration
        self.config = {
            'backend_url': 'http://localhost:8000',
            'frontend_url': 'http://localhost:5173',
            'database_path': '/backend/fossawork_v2.db',
            'logs_dir': '/logs',
            'data_dir': '/backend/data',
            'thresholds': {
                'cpu_warning': 70.0,
                'cpu_critical': 85.0,
                'memory_warning': 80.0,
                'memory_critical': 90.0,
                'disk_warning': 80.0,
                'disk_critical': 90.0,
                'response_time_warning': 2.0,
                'response_time_critical': 5.0
            }
        }

    def log_result(self, component: str, status: str, details: str = "", severity: str = "info"):
        """Log a health check result"""
        if not self.quiet or severity in ['warning', 'error']:
            if severity == 'error':
                logger.error(f"{component}: {status} - {details}")
            elif severity == 'warning':
                logger.warning(f"{component}: {status} - {details}")
            else:
                logger.info(f"{component}: {status} - {details}")
        
        self.results[component] = {
            'status': status,
            'details': details,
            'severity': severity,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        if severity in ['warning', 'error']:
            self.issues.append({
                'component': component,
                'status': status,
                'details': details,
                'severity': severity
            })

    def check_backend_api(self) -> bool:
        """Check backend API health and responsiveness"""
        try:
            # Health endpoint check
            start_time = time.time()
            response = requests.get(f"{self.config['backend_url']}/api/health", timeout=10)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                if response_time > self.config['thresholds']['response_time_critical']:
                    self.log_result("Backend API", "SLOW", 
                                  f"Response time: {response_time:.2f}s", "error")
                    return False
                elif response_time > self.config['thresholds']['response_time_warning']:
                    self.log_result("Backend API", "SLOW", 
                                  f"Response time: {response_time:.2f}s", "warning")
                else:
                    self.log_result("Backend API", "HEALTHY", 
                                  f"Response time: {response_time:.2f}s")
                
                # Test additional endpoints if comprehensive
                if self.comprehensive:
                    endpoints = ['/api/work-orders', '/api/dispensers', '/api/auth/validate']
                    for endpoint in endpoints:
                        try:
                            resp = requests.get(f"{self.config['backend_url']}{endpoint}", timeout=5)
                            if resp.status_code in [200, 401]:  # 401 is OK for auth endpoint
                                self.log_result(f"Backend{endpoint}", "ACCESSIBLE", 
                                              f"Status: {resp.status_code}")
                            else:
                                self.log_result(f"Backend{endpoint}", "ISSUE", 
                                              f"Status: {resp.status_code}", "warning")
                        except Exception as e:
                            self.log_result(f"Backend{endpoint}", "ERROR", str(e), "error")
                
                return True
            else:
                self.log_result("Backend API", "ERROR", 
                              f"HTTP {response.status_code}", "error")
                return False
                
        except requests.exceptions.ConnectionError:
            self.log_result("Backend API", "UNREACHABLE", 
                          "Connection refused", "error")
            return False
        except requests.exceptions.Timeout:
            self.log_result("Backend API", "TIMEOUT", 
                          "Request timeout", "error")
            return False
        except Exception as e:
            self.log_result("Backend API", "ERROR", str(e), "error")
            return False

    def check_frontend(self) -> bool:
        """Check frontend application availability"""
        try:
            response = requests.get(self.config['frontend_url'], timeout=10)
            
            if response.status_code == 200:
                # Check if response contains valid HTML
                if '<html' in response.text.lower():
                    self.log_result("Frontend", "HEALTHY", "HTML content served")
                    return True
                else:
                    self.log_result("Frontend", "ISSUE", 
                                  "Response doesn't contain HTML", "warning")
                    return False
            else:
                self.log_result("Frontend", "ERROR", 
                              f"HTTP {response.status_code}", "error")
                return False
                
        except requests.exceptions.ConnectionError:
            self.log_result("Frontend", "UNREACHABLE", 
                          "Connection refused", "error")
            return False
        except Exception as e:
            self.log_result("Frontend", "ERROR", str(e), "error")
            return False

    def check_database(self) -> bool:
        """Check database connectivity and integrity"""
        try:
            # Check if database file exists
            db_path = Path(self.config['database_path'])
            if not db_path.exists():
                self.log_result("Database", "ERROR", 
                              "Database file not found", "error")
                return False
            
            # Check file permissions
            if not db_path.is_readable():
                self.log_result("Database", "ERROR", 
                              "Database file not readable", "error")
                return False
            
            # Test database connection
            conn = sqlite3.connect(str(db_path), timeout=5)
            cursor = conn.cursor()
            
            # Basic connectivity test
            cursor.execute('SELECT 1')
            cursor.fetchone()
            
            # Check table count
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            
            if table_count == 0:
                self.log_result("Database", "ERROR", 
                              "No tables found", "error")
                conn.close()
                return False
            
            # Integrity check if comprehensive
            if self.comprehensive:
                cursor.execute('PRAGMA integrity_check')
                integrity_result = cursor.fetchone()[0]
                
                if integrity_result != 'ok':
                    self.log_result("Database", "ERROR", 
                                  f"Integrity check failed: {integrity_result}", "error")
                    conn.close()
                    return False
                else:
                    self.log_result("Database Integrity", "HEALTHY", 
                                  "Integrity check passed")
            
            # Check basic data
            try:
                cursor.execute('SELECT COUNT(*) FROM work_orders')
                work_order_count = cursor.fetchone()[0]
                self.log_result("Database", "HEALTHY", 
                              f"{table_count} tables, {work_order_count} work orders")
            except sqlite3.OperationalError:
                # Table might not exist yet, that's OK
                self.log_result("Database", "HEALTHY", 
                              f"{table_count} tables")
            
            conn.close()
            return True
            
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower():
                self.log_result("Database", "LOCKED", 
                              "Database is locked", "error")
            else:
                self.log_result("Database", "ERROR", 
                              f"Operational error: {str(e)}", "error")
            return False
        except Exception as e:
            self.log_result("Database", "ERROR", str(e), "error")
            return False

    def check_system_resources(self) -> bool:
        """Check system resource utilization"""
        healthy = True
        
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            if cpu_percent > self.config['thresholds']['cpu_critical']:
                self.log_result("CPU Usage", "CRITICAL", 
                              f"{cpu_percent:.1f}%", "error")
                healthy = False
            elif cpu_percent > self.config['thresholds']['cpu_warning']:
                self.log_result("CPU Usage", "HIGH", 
                              f"{cpu_percent:.1f}%", "warning")
            else:
                self.log_result("CPU Usage", "NORMAL", f"{cpu_percent:.1f}%")
            
            # Memory usage
            memory = psutil.virtual_memory()
            if memory.percent > self.config['thresholds']['memory_critical']:
                self.log_result("Memory Usage", "CRITICAL", 
                              f"{memory.percent:.1f}%", "error")
                healthy = False
            elif memory.percent > self.config['thresholds']['memory_warning']:
                self.log_result("Memory Usage", "HIGH", 
                              f"{memory.percent:.1f}%", "warning")
            else:
                self.log_result("Memory Usage", "NORMAL", 
                              f"{memory.percent:.1f}%")
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            if disk_percent > self.config['thresholds']['disk_critical']:
                self.log_result("Disk Usage", "CRITICAL", 
                              f"{disk_percent:.1f}%", "error")
                healthy = False
            elif disk_percent > self.config['thresholds']['disk_warning']:
                self.log_result("Disk Usage", "HIGH", 
                              f"{disk_percent:.1f}%", "warning")
            else:
                self.log_result("Disk Usage", "NORMAL", 
                              f"{disk_percent:.1f}%")
            
            # Load average (if available)
            if hasattr(psutil, 'getloadavg'):
                load_avg = psutil.getloadavg()
                cpu_count = psutil.cpu_count()
                load_percent = (load_avg[0] / cpu_count) * 100
                
                if load_percent > 100:
                    self.log_result("System Load", "HIGH", 
                                  f"{load_avg[0]:.2f} ({load_percent:.1f}%)", "warning")
                else:
                    self.log_result("System Load", "NORMAL", 
                                  f"{load_avg[0]:.2f}")
            
            return healthy
            
        except Exception as e:
            self.log_result("System Resources", "ERROR", str(e), "error")
            return False

    def check_services(self) -> bool:
        """Check system service status"""
        services = ['fossawork-backend', 'fossawork-frontend']
        all_healthy = True
        
        for service in services:
            try:
                result = subprocess.run(['systemctl', 'is-active', service], 
                                      capture_output=True, text=True, timeout=5)
                
                if result.stdout.strip() == 'active':
                    self.log_result(f"Service {service}", "ACTIVE", "Running")
                else:
                    self.log_result(f"Service {service}", "INACTIVE", 
                                  result.stdout.strip(), "error")
                    all_healthy = False
                    
            except subprocess.TimeoutExpired:
                self.log_result(f"Service {service}", "TIMEOUT", 
                              "systemctl command timeout", "error")
                all_healthy = False
            except FileNotFoundError:
                # systemctl not available, check processes instead
                self.check_processes_fallback()
                break
            except Exception as e:
                self.log_result(f"Service {service}", "ERROR", str(e), "error")
                all_healthy = False
        
        return all_healthy

    def check_processes_fallback(self) -> bool:
        """Fallback process check when systemctl is not available"""
        processes_found = {'backend': False, 'frontend': False}
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = ' '.join(proc.info['cmdline'] or [])
                    
                    if 'uvicorn' in cmdline and 'app.main:app' in cmdline:
                        processes_found['backend'] = True
                        self.log_result("Backend Process", "RUNNING", 
                                      f"PID: {proc.info['pid']}")
                    
                    if ('npm run dev' in cmdline or 'vite' in cmdline) and 'frontend' in cmdline:
                        processes_found['frontend'] = True
                        self.log_result("Frontend Process", "RUNNING", 
                                      f"PID: {proc.info['pid']}")
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            # Report missing processes
            if not processes_found['backend']:
                self.log_result("Backend Process", "NOT FOUND", 
                              "No uvicorn process found", "error")
            
            if not processes_found['frontend']:
                self.log_result("Frontend Process", "NOT FOUND", 
                              "No frontend dev server found", "warning")
            
            return all(processes_found.values())
            
        except Exception as e:
            self.log_result("Process Check", "ERROR", str(e), "error")
            return False

    def check_file_permissions(self) -> bool:
        """Check critical file and directory permissions"""
        checks = [
            (self.config['database_path'], 'Database file'),
            (self.config['logs_dir'], 'Logs directory'),
            (self.config['data_dir'], 'Data directory'),
        ]
        
        all_healthy = True
        
        for path, description in checks:
            path_obj = Path(path)
            
            if not path_obj.exists():
                self.log_result(f"Permissions {description}", "MISSING", 
                              f"Path does not exist: {path}", "error")
                all_healthy = False
                continue
            
            issues = []
            
            if path_obj.is_dir():
                if not path_obj.is_readable():
                    issues.append("not readable")
                if not path_obj.is_writable():
                    issues.append("not writable")
            else:
                if not path_obj.is_readable():
                    issues.append("not readable")
                if path == self.config['database_path'] and not path_obj.is_writable():
                    issues.append("not writable")
            
            if issues:
                self.log_result(f"Permissions {description}", "ERROR", 
                              ", ".join(issues), "error")
                all_healthy = False
            else:
                self.log_result(f"Permissions {description}", "OK", 
                              "Permissions correct")
        
        return all_healthy

    def check_external_dependencies(self) -> bool:
        """Check external service dependencies"""
        if not self.comprehensive:
            return True
        
        dependencies = [
            ('https://app.workfossa.com', 'WorkFossa'),
        ]
        
        all_healthy = True
        
        for url, name in dependencies:
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    self.log_result(f"External {name}", "ACCESSIBLE", 
                                  f"Status: {response.status_code}")
                else:
                    self.log_result(f"External {name}", "ISSUE", 
                                  f"Status: {response.status_code}", "warning")
            except requests.exceptions.Timeout:
                self.log_result(f"External {name}", "TIMEOUT", 
                              "Connection timeout", "warning")
            except Exception as e:
                self.log_result(f"External {name}", "ERROR", 
                              str(e), "warning")
        
        return all_healthy

    def run_health_check(self) -> Dict[str, Any]:
        """Run complete health check"""
        logger.info("Starting FossaWork V2 health check...")
        
        checks = [
            ("Backend API", self.check_backend_api),
            ("Frontend", self.check_frontend),
            ("Database", self.check_database),
            ("System Resources", self.check_system_resources),
            ("Services", self.check_services),
            ("File Permissions", self.check_file_permissions),
        ]
        
        if self.comprehensive:
            checks.append(("External Dependencies", self.check_external_dependencies))
        
        overall_healthy = True
        
        for check_name, check_func in checks:
            try:
                if not check_func():
                    overall_healthy = False
            except Exception as e:
                logger.error(f"Error during {check_name} check: {e}")
                self.log_result(check_name, "CHECK_ERROR", str(e), "error")
                overall_healthy = False
        
        # Generate summary
        total_time = time.time() - self.start_time
        summary = {
            'overall_status': 'HEALTHY' if overall_healthy else 'UNHEALTHY',
            'timestamp': datetime.utcnow().isoformat(),
            'check_duration': f"{total_time:.2f}s",
            'comprehensive': self.comprehensive,
            'total_checks': len(self.results),
            'issues_found': len(self.issues),
            'results': self.results,
            'issues': self.issues
        }
        
        if not self.quiet:
            logger.info(f"Health check completed in {total_time:.2f}s")
            logger.info(f"Overall status: {summary['overall_status']}")
            logger.info(f"Issues found: {len(self.issues)}")
        
        return summary

def main():
    parser = argparse.ArgumentParser(description='FossaWork V2 Health Check')
    parser.add_argument('--comprehensive', action='store_true',
                      help='Run comprehensive health check including external dependencies')
    parser.add_argument('--quiet', action='store_true',
                      help='Suppress non-critical output')
    parser.add_argument('--json', action='store_true',
                      help='Output results in JSON format')
    parser.add_argument('--scheduled', action='store_true',
                      help='Log results for scheduled monitoring')
    
    args = parser.parse_args()
    
    # Create health checker
    checker = HealthChecker(comprehensive=args.comprehensive, quiet=args.quiet)
    
    # Run health check
    results = checker.run_health_check()
    
    # Log results if scheduled
    if args.scheduled:
        log_file = Path('/logs/health-checks.jsonl')
        log_file.parent.mkdir(parents=True, exist_ok=True)
        with open(log_file, 'a') as f:
            f.write(json.dumps(results) + '\n')
    
    # Output results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        if results['issues']:
            print(f"\n❌ {len(results['issues'])} issues found:")
            for issue in results['issues']:
                print(f"  • {issue['component']}: {issue['status']} - {issue['details']}")
        else:
            print("\n✅ All health checks passed")
    
    # Exit with appropriate code
    sys.exit(0 if results['overall_status'] == 'HEALTHY' else 1)

if __name__ == '__main__':
    main()
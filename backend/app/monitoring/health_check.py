"""
Health check system for monitoring application and dependency health
"""

import asyncio
import time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import aiohttp
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.logging_service import get_logger
logger = get_logger("monitoring.health_check")
from app.database import get_db
from app.core.config import settings


class HealthStatus(str, Enum):
    """Health check status levels"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class HealthCheck:
    """Individual health check definition"""
    
    def __init__(
        self,
        name: str,
        check_function,
        critical: bool = True,
        timeout: float = 5.0,
        expected_response_time: float = 1.0
    ):
        self.name = name
        self.check_function = check_function
        self.critical = critical
        self.timeout = timeout
        self.expected_response_time = expected_response_time
        self.last_check_time = None
        self.last_status = None
        self.last_response_time = None
        self.consecutive_failures = 0


class HealthChecker:
    """Comprehensive health checking system"""
    
    def __init__(self):
        self.checks: List[HealthCheck] = []
        self.initialize_health_checks()
    
    def initialize_health_checks(self):
        """Set up default health checks"""
        
        # Database connectivity
        self.add_check(HealthCheck(
            name="database",
            check_function=self._check_database,
            critical=True,
            timeout=5.0,
            expected_response_time=0.5
        ))
        
        # WorkFossa API
        self.add_check(HealthCheck(
            name="workfossa_api",
            check_function=self._check_workfossa_api,
            critical=False,
            timeout=10.0,
            expected_response_time=3.0
        ))
        
        # File system
        self.add_check(HealthCheck(
            name="filesystem",
            check_function=self._check_filesystem,
            critical=True,
            timeout=2.0,
            expected_response_time=0.1
        ))
        
        # Memory usage
        self.add_check(HealthCheck(
            name="memory",
            check_function=self._check_memory,
            critical=False,
            timeout=1.0,
            expected_response_time=0.1
        ))
        
        # Playwright browser
        self.add_check(HealthCheck(
            name="playwright",
            check_function=self._check_playwright,
            critical=False,
            timeout=15.0,
            expected_response_time=5.0
        ))
        
        # Background jobs
        self.add_check(HealthCheck(
            name="background_jobs",
            check_function=self._check_background_jobs,
            critical=False,
            timeout=5.0,
            expected_response_time=1.0
        ))
    
    def add_check(self, check: HealthCheck):
        """Add a new health check"""
        self.checks.append(check)
    
    async def check_health(self) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status"""
        start_time = time.time()
        results = {}
        overall_status = HealthStatus.HEALTHY
        
        # Run all checks concurrently
        check_tasks = []
        for check in self.checks:
            task = asyncio.create_task(self._run_single_check(check))
            check_tasks.append((check, task))
        
        # Collect results
        for check, task in check_tasks:
            try:
                status, details = await task
                results[check.name] = {
                    "status": status,
                    "response_time_ms": check.last_response_time * 1000 if check.last_response_time else None,
                    "details": details,
                    "critical": check.critical,
                    "consecutive_failures": check.consecutive_failures,
                    "last_check": check.last_check_time.isoformat() if check.last_check_time else None
                }
                
                # Update overall status
                if status == HealthStatus.UNHEALTHY and check.critical:
                    overall_status = HealthStatus.UNHEALTHY
                elif status == HealthStatus.DEGRADED and overall_status == HealthStatus.HEALTHY:
                    overall_status = HealthStatus.DEGRADED
                    
            except Exception as e:
                logger.error(f"Health check {check.name} failed with error: {e}")
                results[check.name] = {
                    "status": HealthStatus.UNHEALTHY,
                    "error": str(e),
                    "critical": check.critical
                }
                if check.critical:
                    overall_status = HealthStatus.UNHEALTHY
        
        # Calculate total check time
        total_check_time = time.time() - start_time
        
        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "total_check_time_ms": total_check_time * 1000,
            "checks": results,
            "summary": self._generate_summary(overall_status, results)
        }
    
    async def _run_single_check(self, check: HealthCheck) -> Tuple[HealthStatus, Dict[str, Any]]:
        """Run a single health check with timeout"""
        start_time = time.time()
        check.last_check_time = datetime.utcnow()
        
        try:
            # Run check with timeout
            result = await asyncio.wait_for(
                check.check_function(),
                timeout=check.timeout
            )
            
            response_time = time.time() - start_time
            check.last_response_time = response_time
            
            # Determine status based on result and response time
            if not result.get("healthy", False):
                status = HealthStatus.UNHEALTHY
                check.consecutive_failures += 1
            elif response_time > check.expected_response_time * 2:
                status = HealthStatus.DEGRADED
                check.consecutive_failures = 0
            else:
                status = HealthStatus.HEALTHY
                check.consecutive_failures = 0
            
            check.last_status = status
            return status, result
            
        except asyncio.TimeoutError:
            check.consecutive_failures += 1
            check.last_status = HealthStatus.UNHEALTHY
            return HealthStatus.UNHEALTHY, {
                "healthy": False,
                "error": f"Check timed out after {check.timeout}s"
            }
        except Exception as e:
            check.consecutive_failures += 1
            check.last_status = HealthStatus.UNHEALTHY
            return HealthStatus.UNHEALTHY, {
                "healthy": False,
                "error": str(e)
            }
    
    async def _check_database(self) -> Dict[str, Any]:
        """Check database connectivity and performance"""
        try:
            db = next(get_db())
            
            # Test basic connectivity
            start = time.time()
            result = db.execute(text("SELECT 1"))
            query_time = time.time() - start
            
            # Check table accessibility
            tables_ok = True
            try:
                db.execute(text("SELECT COUNT(*) FROM users"))
                db.execute(text("SELECT COUNT(*) FROM work_orders"))
            except Exception as e:
                tables_ok = False
                logger.error(f"Database table check failed: {e}")
            
            return {
                "healthy": True,
                "query_time_ms": query_time * 1000,
                "tables_accessible": tables_ok
            }
            
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e)
            }
        finally:
            if 'db' in locals():
                db.close()
    
    async def _check_workfossa_api(self) -> Dict[str, Any]:
        """Check WorkFossa API connectivity"""
        try:
            async with aiohttp.ClientSession() as session:
                start = time.time()
                async with session.get(
                    "https://app.workfossa.com",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    response_time = time.time() - start
                    
                    return {
                        "healthy": response.status < 500,
                        "status_code": response.status,
                        "response_time_ms": response_time * 1000
                    }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e)
            }
    
    async def _check_filesystem(self) -> Dict[str, Any]:
        """Check filesystem accessibility"""
        try:
            import psutil
            import os
            from pathlib import Path
            
            # Check data directory
            data_path = Path("data")
            data_writable = data_path.exists() and os.access(data_path, os.W_OK)
            
            # Check disk space
            disk = psutil.disk_usage('/')
            
            # Check logs directory
            logs_path = Path("logs")
            logs_writable = logs_path.exists() and os.access(logs_path, os.W_OK)
            
            return {
                "healthy": data_writable and disk.percent < 95,
                "data_directory_writable": data_writable,
                "logs_directory_writable": logs_writable,
                "disk_usage_percent": disk.percent,
                "disk_free_gb": disk.free / 1024 / 1024 / 1024
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e)
            }
    
    async def _check_memory(self) -> Dict[str, Any]:
        """Check memory usage"""
        try:
            import psutil
            
            memory = psutil.virtual_memory()
            process = psutil.Process()
            process_memory = process.memory_info()
            
            # Healthy if system memory < 90% and process memory < 1GB
            healthy = memory.percent < 90 and process_memory.rss < 1024 * 1024 * 1024
            
            return {
                "healthy": healthy,
                "system_memory_percent": memory.percent,
                "process_memory_mb": process_memory.rss / 1024 / 1024,
                "available_memory_mb": memory.available / 1024 / 1024
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e)
            }
    
    async def _check_playwright(self) -> Dict[str, Any]:
        """Check Playwright browser automation availability"""
        try:
            from playwright.async_api import async_playwright
            
            start = time.time()
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto("about:blank")
                await browser.close()
            
            launch_time = time.time() - start
            
            return {
                "healthy": True,
                "launch_time_ms": launch_time * 1000
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e),
                "note": "Playwright not critical for basic operations"
            }
    
    async def _check_background_jobs(self) -> Dict[str, Any]:
        """Check background job scheduler status"""
        try:
            # This would check APScheduler or similar
            # For now, just return healthy
            return {
                "healthy": True,
                "active_jobs": 0,  # Would query actual scheduler
                "next_run": None
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e)
            }
    
    def _generate_summary(self, overall_status: HealthStatus, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate health check summary"""
        total_checks = len(results)
        healthy_checks = sum(1 for r in results.values() if r["status"] == HealthStatus.HEALTHY)
        degraded_checks = sum(1 for r in results.values() if r["status"] == HealthStatus.DEGRADED)
        unhealthy_checks = sum(1 for r in results.values() if r["status"] == HealthStatus.UNHEALTHY)
        
        critical_failures = [
            name for name, result in results.items()
            if result["status"] == HealthStatus.UNHEALTHY and result.get("critical", False)
        ]
        
        return {
            "total_checks": total_checks,
            "healthy": healthy_checks,
            "degraded": degraded_checks,
            "unhealthy": unhealthy_checks,
            "critical_failures": critical_failures,
            "health_percentage": (healthy_checks / total_checks * 100) if total_checks > 0 else 0
        }


# Global health checker instance
health_checker = HealthChecker()
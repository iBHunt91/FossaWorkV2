"""
Metrics collection service for monitoring application performance and health
"""

import time
import psutil
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict, deque
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.logging_service import get_logger
logger = get_logger("monitoring.metrics_collector")


class MetricsCollector:
    """Collects and aggregates application metrics"""
    
    def __init__(self):
        self.metrics = defaultdict(lambda: deque(maxlen=1000))
        self.start_time = time.time()
        self.request_times = deque(maxlen=1000)
        self.error_counts = defaultdict(int)
        self.endpoint_stats = defaultdict(lambda: {"count": 0, "total_time": 0, "errors": 0})
        
    def record_request(self, endpoint: str, method: str, status_code: int, duration: float):
        """Record API request metrics"""
        key = f"{method} {endpoint}"
        self.endpoint_stats[key]["count"] += 1
        self.endpoint_stats[key]["total_time"] += duration
        
        if status_code >= 400:
            self.endpoint_stats[key]["errors"] += 1
            self.error_counts[status_code] += 1
            
        self.request_times.append((time.time(), duration))
        
        # Record to time series
        self.metrics["request_rate"].append((time.time(), 1))
        self.metrics["response_time"].append((time.time(), duration))
        
        if status_code >= 500:
            self.metrics["error_rate"].append((time.time(), 1))
    
    def record_security_event(self, event_type: str, severity: str, details: Dict[str, Any]):
        """Record security-related events"""
        timestamp = time.time()
        self.metrics[f"security_{event_type}"].append((timestamp, 1))
        
        if severity == "critical":
            self.metrics["critical_security_events"].append((timestamp, details))
        
        logger.info(f"Security event: {event_type}", extra={
            "event_type": event_type,
            "severity": severity,
            "details": details
        })
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system resource metrics"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Network I/O
        net_io = psutil.net_io_counters()
        
        # Process-specific metrics
        process = psutil.Process()
        process_memory = process.memory_info()
        
        return {
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_mb": memory.available / 1024 / 1024,
                "disk_percent": disk.percent,
                "disk_free_gb": disk.free / 1024 / 1024 / 1024,
                "network_sent_mb": net_io.bytes_sent / 1024 / 1024,
                "network_recv_mb": net_io.bytes_recv / 1024 / 1024,
            },
            "process": {
                "memory_rss_mb": process_memory.rss / 1024 / 1024,
                "memory_vms_mb": process_memory.vms / 1024 / 1024,
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "open_files": len(process.open_files()),
            }
        }
    
    async def get_database_metrics(self, db: Session) -> Dict[str, Any]:
        """Get database performance metrics"""
        metrics = {}
        
        try:
            # Connection pool stats
            pool = db.bind.pool
            metrics["connection_pool"] = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "total": pool.total(),
            }
            
            # Table sizes
            tables = ["users", "work_orders", "dispensers", "automation_tasks"]
            for table in tables:
                result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                metrics[f"{table}_count"] = result.scalar()
            
            # SQLite specific metrics
            if "sqlite" in str(db.bind.url):
                # Database size
                result = db.execute(text("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"))
                metrics["database_size_mb"] = result.scalar() / 1024 / 1024
                
                # Cache stats
                result = db.execute(text("PRAGMA cache_stats"))
                cache_stats = result.fetchone()
                if cache_stats:
                    metrics["cache_hit_rate"] = cache_stats[0] if cache_stats else 0
            
        except Exception as e:
            logger.error(f"Failed to collect database metrics: {e}")
            
        return metrics
    
    def get_application_metrics(self) -> Dict[str, Any]:
        """Get application-level metrics"""
        uptime = time.time() - self.start_time
        
        # Calculate request rate (requests per minute)
        recent_requests = [t for t, _ in self.request_times if t > time.time() - 60]
        request_rate = len(recent_requests)
        
        # Calculate average response time
        if self.request_times:
            recent_times = [duration for t, duration in self.request_times if t > time.time() - 60]
            avg_response_time = sum(recent_times) / len(recent_times) if recent_times else 0
        else:
            avg_response_time = 0
        
        # Get top endpoints by request count
        top_endpoints = sorted(
            self.endpoint_stats.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )[:10]
        
        # Get error rate
        total_requests = sum(stats["count"] for stats in self.endpoint_stats.values())
        total_errors = sum(stats["errors"] for stats in self.endpoint_stats.values())
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "uptime_seconds": uptime,
            "uptime_hours": uptime / 3600,
            "request_rate_per_minute": request_rate,
            "average_response_time_ms": avg_response_time * 1000,
            "total_requests": total_requests,
            "total_errors": total_errors,
            "error_rate_percent": error_rate,
            "top_endpoints": [
                {
                    "endpoint": endpoint,
                    "count": stats["count"],
                    "avg_time_ms": (stats["total_time"] / stats["count"] * 1000) if stats["count"] > 0 else 0,
                    "error_rate": (stats["errors"] / stats["count"] * 100) if stats["count"] > 0 else 0,
                }
                for endpoint, stats in top_endpoints
            ],
            "error_breakdown": dict(self.error_counts),
        }
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Get security-related metrics"""
        # Count security events in last hour
        hour_ago = time.time() - 3600
        
        security_events = {}
        for event_type in ["auth_failure", "access_denied", "suspicious_activity", "rate_limit"]:
            key = f"security_{event_type}"
            if key in self.metrics:
                recent_events = [t for t, _ in self.metrics[key] if t > hour_ago]
                security_events[event_type] = len(recent_events)
            else:
                security_events[event_type] = 0
        
        # Get critical events
        critical_events = []
        if "critical_security_events" in self.metrics:
            critical_events = [
                {"timestamp": datetime.fromtimestamp(t).isoformat(), "details": details}
                for t, details in self.metrics["critical_security_events"]
                if t > hour_ago
            ]
        
        return {
            "events_last_hour": security_events,
            "critical_events": critical_events,
            "total_security_events": sum(security_events.values()),
        }
    
    def get_all_metrics(self, db: Optional[Session] = None) -> Dict[str, Any]:
        """Get comprehensive metrics snapshot"""
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "application": self.get_application_metrics(),
            "system": self.get_system_metrics(),
            "security": self.get_security_metrics(),
        }
        
        if db:
            try:
                metrics["database"] = asyncio.run(self.get_database_metrics(db))
            except Exception as e:
                logger.error(f"Failed to get database metrics: {e}")
                metrics["database"] = {"error": str(e)}
        
        return metrics


# Global metrics collector instance
metrics_collector = MetricsCollector()
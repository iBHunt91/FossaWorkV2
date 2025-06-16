"""
Metrics collection service for Prometheus monitoring.
Provides application metrics for performance and health monitoring.
"""

from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest
from prometheus_client.core import CollectorRegistry
from datetime import datetime
import time
import psutil
import os
from functools import wraps
import asyncio

# Create a custom registry to avoid conflicts
registry = CollectorRegistry()

# Request metrics
request_count = Counter(
    'fossawork_requests_total',
    'Total number of requests',
    ['method', 'endpoint', 'status'],
    registry=registry
)

request_duration = Histogram(
    'fossawork_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint'],
    registry=registry,
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

# WebSocket metrics
active_websockets = Gauge(
    'fossawork_websocket_connections_active',
    'Number of active WebSocket connections',
    registry=registry
)

# Scraping metrics
scraping_tasks_total = Counter(
    'fossawork_scraping_tasks_total',
    'Total number of scraping tasks',
    ['scraper_type', 'status'],
    registry=registry
)

scraping_duration = Histogram(
    'fossawork_scraping_duration_seconds',
    'Scraping task duration in seconds',
    ['scraper_type'],
    registry=registry
)

scraping_errors = Counter(
    'fossawork_scraping_errors_total',
    'Total number of scraping errors',
    ['scraper_type', 'error_type'],
    registry=registry
)

# Automation metrics
automation_tasks_active = Gauge(
    'fossawork_automation_tasks_active',
    'Number of active automation tasks',
    ['task_type'],
    registry=registry
)

automation_tasks_total = Counter(
    'fossawork_automation_tasks_total',
    'Total number of automation tasks',
    ['task_type', 'status'],
    registry=registry
)

# Database metrics
db_connections_active = Gauge(
    'fossawork_database_connections_active',
    'Number of active database connections',
    registry=registry
)

db_query_duration = Histogram(
    'fossawork_database_query_duration_seconds',
    'Database query duration in seconds',
    ['query_type'],
    registry=registry,
    buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0)
)

# System metrics
system_memory_usage = Gauge(
    'fossawork_system_memory_usage_bytes',
    'System memory usage in bytes',
    ['type'],
    registry=registry
)

system_cpu_usage = Gauge(
    'fossawork_system_cpu_usage_percent',
    'System CPU usage percentage',
    registry=registry
)

# Application info
app_info = Info(
    'fossawork_app',
    'Application information',
    registry=registry
)

# Error metrics
error_count = Counter(
    'fossawork_errors_total',
    'Total number of errors',
    ['error_type', 'severity'],
    registry=registry
)

# Authentication metrics
auth_attempts = Counter(
    'fossawork_auth_attempts_total',
    'Total number of authentication attempts',
    ['method', 'status'],
    registry=registry
)

auth_token_operations = Counter(
    'fossawork_auth_token_operations_total',
    'Total number of token operations',
    ['operation', 'status'],
    registry=registry
)

# Work order metrics
work_orders_processed = Counter(
    'fossawork_work_orders_processed_total',
    'Total number of work orders processed',
    ['service_code', 'status'],
    registry=registry
)

# Dispenser metrics
dispensers_scraped = Counter(
    'fossawork_dispensers_scraped_total',
    'Total number of dispensers scraped',
    ['customer_type', 'status'],
    registry=registry
)


class MetricsService:
    """Service for managing application metrics."""
    
    def __init__(self):
        self.start_time = time.time()
        self._update_system_metrics_task = None
        
        # Set application info
        app_info.info({
            'version': '2.0.0',
            'environment': os.getenv('ENVIRONMENT', 'development'),
            'started_at': datetime.utcnow().isoformat()
        })
    
    async def start_background_tasks(self):
        """Start background tasks for metrics collection."""
        self._update_system_metrics_task = asyncio.create_task(
            self._update_system_metrics_loop()
        )
    
    async def stop_background_tasks(self):
        """Stop background tasks."""
        if self._update_system_metrics_task:
            self._update_system_metrics_task.cancel()
            try:
                await self._update_system_metrics_task
            except asyncio.CancelledError:
                pass
    
    async def _update_system_metrics_loop(self):
        """Update system metrics periodically."""
        while True:
            try:
                self.update_system_metrics()
                await asyncio.sleep(15)  # Update every 15 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                error_count.labels(error_type='metrics_update', severity='warning').inc()
    
    def update_system_metrics(self):
        """Update system resource metrics."""
        # Memory metrics
        memory = psutil.virtual_memory()
        system_memory_usage.labels(type='total').set(memory.total)
        system_memory_usage.labels(type='used').set(memory.used)
        system_memory_usage.labels(type='available').set(memory.available)
        system_memory_usage.labels(type='percent').set(memory.percent)
        
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        system_cpu_usage.set(cpu_percent)
    
    def track_request(self, method: str, endpoint: str, status: int, duration: float):
        """Track HTTP request metrics."""
        request_count.labels(method=method, endpoint=endpoint, status=str(status)).inc()
        request_duration.labels(method=method, endpoint=endpoint).observe(duration)
    
    def track_websocket_connection(self, delta: int):
        """Track WebSocket connection changes."""
        active_websockets.inc(delta)
    
    def track_scraping_task(self, scraper_type: str, status: str, duration: Optional[float] = None):
        """Track scraping task metrics."""
        scraping_tasks_total.labels(scraper_type=scraper_type, status=status).inc()
        if duration is not None:
            scraping_duration.labels(scraper_type=scraper_type).observe(duration)
    
    def track_scraping_error(self, scraper_type: str, error_type: str):
        """Track scraping errors."""
        scraping_errors.labels(scraper_type=scraper_type, error_type=error_type).inc()
    
    def track_automation_task(self, task_type: str, status: str, active_delta: int = 0):
        """Track automation task metrics."""
        automation_tasks_total.labels(task_type=task_type, status=status).inc()
        if active_delta != 0:
            automation_tasks_active.labels(task_type=task_type).inc(active_delta)
    
    def track_db_query(self, query_type: str, duration: float):
        """Track database query metrics."""
        db_query_duration.labels(query_type=query_type).observe(duration)
    
    def set_db_connections(self, count: int):
        """Set the number of active database connections."""
        db_connections_active.set(count)
    
    def track_error(self, error_type: str, severity: str = 'error'):
        """Track application errors."""
        error_count.labels(error_type=error_type, severity=severity).inc()
    
    def track_auth_attempt(self, method: str, success: bool):
        """Track authentication attempts."""
        status = 'success' if success else 'failure'
        auth_attempts.labels(method=method, status=status).inc()
    
    def track_token_operation(self, operation: str, success: bool):
        """Track token operations."""
        status = 'success' if success else 'failure'
        auth_token_operations.labels(operation=operation, status=status).inc()
    
    def track_work_order(self, service_code: str, status: str):
        """Track work order processing."""
        work_orders_processed.labels(service_code=service_code, status=status).inc()
    
    def track_dispenser_scrape(self, customer_type: str, success: bool):
        """Track dispenser scraping."""
        status = 'success' if success else 'failure'
        dispensers_scraped.labels(customer_type=customer_type, status=status).inc()
    
    def get_metrics(self) -> bytes:
        """Generate Prometheus metrics output."""
        return generate_latest(registry)


# Decorator for tracking function execution time
def track_execution_time(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """Decorator to track function execution time."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                # You can customize this based on the metric type
                if metric_name == 'scraping':
                    scraper_type = labels.get('scraper_type', 'unknown') if labels else 'unknown'
                    scraping_duration.labels(scraper_type=scraper_type).observe(duration)
                elif metric_name == 'db_query':
                    query_type = labels.get('query_type', 'unknown') if labels else 'unknown'
                    db_query_duration.labels(query_type=query_type).observe(duration)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                # Handle sync functions
                if metric_name == 'db_query':
                    query_type = labels.get('query_type', 'unknown') if labels else 'unknown'
                    db_query_duration.labels(query_type=query_type).observe(duration)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator


# Global metrics service instance
metrics_service = MetricsService()
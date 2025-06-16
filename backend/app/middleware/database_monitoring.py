"""
Database query monitoring middleware.
Tracks query performance and logs slow queries.
"""

import time
import logging
from typing import Optional, Dict, Any
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import Pool
from contextvars import ContextVar

from ..services.metrics_service import metrics_service
from .request_id import get_request_id

logger = logging.getLogger(__name__)

# Context variables for tracking query statistics
query_count_var: ContextVar[int] = ContextVar('query_count', default=0)
query_time_var: ContextVar[float] = ContextVar('query_time', default=0.0)

# Configuration
SLOW_QUERY_THRESHOLD = 1.0  # Queries taking more than 1 second
LOG_ALL_QUERIES = False  # Set to True for debugging


class DatabaseMonitoring:
    """Database monitoring configuration and utilities"""
    
    def __init__(self, slow_query_threshold: float = 1.0, log_all_queries: bool = False):
        self.slow_query_threshold = slow_query_threshold
        self.log_all_queries = log_all_queries
        self.query_stats: Dict[str, Any] = {
            "total_queries": 0,
            "slow_queries": 0,
            "failed_queries": 0,
            "query_time_total": 0.0
        }
    
    def setup_monitoring(self, engine: Engine) -> None:
        """Set up SQLAlchemy event listeners for monitoring"""
        
        # Monitor connection pool
        @event.listens_for(Pool, "connect")
        def receive_connect(dbapi_conn, connection_record):
            """Track new connections"""
            connection_record.info['connect_time'] = time.time()
            logger.debug(f"New database connection established")
        
        @event.listens_for(Pool, "checkout")
        def receive_checkout(dbapi_conn, connection_record, connection_proxy):
            """Track connection checkouts"""
            checkout_time = time.time()
            connection_record.info['checkout_time'] = checkout_time
            
            # Update metrics
            pool = connection_proxy._pool
            metrics_service.set_db_connections(pool.size())
        
        @event.listens_for(Pool, "checkin")
        def receive_checkin(dbapi_conn, connection_record):
            """Track connection checkins"""
            if 'checkout_time' in connection_record.info:
                duration = time.time() - connection_record.info['checkout_time']
                del connection_record.info['checkout_time']
                
                if duration > 30:  # Connection held for more than 30 seconds
                    logger.warning(
                        f"Long-lived connection returned to pool after {duration:.2f}s",
                        extra={"request_id": get_request_id()}
                    )
        
        # Monitor queries
        @event.listens_for(Engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """Track query start"""
            conn.info.setdefault('query_start_time', []).append(time.time())
            conn.info.setdefault('current_query', []).append({
                'statement': statement,
                'parameters': parameters,
                'request_id': get_request_id()
            })
            
            # Increment query count for current request
            current_count = query_count_var.get()
            query_count_var.set(current_count + 1)
        
        @event.listens_for(Engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """Track query completion"""
            query_info = conn.info['current_query'].pop()
            start_time = conn.info['query_start_time'].pop()
            duration = time.time() - start_time
            
            # Update context variables
            current_time = query_time_var.get()
            query_time_var.set(current_time + duration)
            
            # Update statistics
            self.query_stats["total_queries"] += 1
            self.query_stats["query_time_total"] += duration
            
            # Determine query type for metrics
            query_type = self._get_query_type(statement)
            
            # Track in metrics service
            metrics_service.track_db_query(query_type, duration)
            
            # Log slow queries
            if duration >= self.slow_query_threshold:
                self.query_stats["slow_queries"] += 1
                logger.warning(
                    f"Slow query detected ({duration:.3f}s): {statement[:200]}...",
                    extra={
                        "request_id": query_info['request_id'],
                        "query_duration": duration,
                        "query_type": query_type,
                        "query_preview": statement[:200]
                    }
                )
                
                # Log full query details for very slow queries
                if duration >= self.slow_query_threshold * 2:
                    logger.error(
                        f"Very slow query ({duration:.3f}s)",
                        extra={
                            "request_id": query_info['request_id'],
                            "full_query": statement,
                            "parameters": str(parameters)[:500]  # Limit parameter logging
                        }
                    )
            
            # Log all queries if enabled
            elif self.log_all_queries:
                logger.debug(
                    f"Query executed ({duration:.3f}s): {statement[:100]}...",
                    extra={
                        "request_id": query_info['request_id'],
                        "query_duration": duration,
                        "query_type": query_type
                    }
                )
        
        @event.listens_for(Engine, "handle_error")
        def receive_handle_error(exception_context):
            """Track query errors"""
            self.query_stats["failed_queries"] += 1
            
            logger.error(
                f"Database error: {exception_context.original_exception}",
                extra={
                    "request_id": get_request_id(),
                    "statement": str(exception_context.statement)[:200],
                    "parameters": str(exception_context.parameters)[:200]
                }
            )
            
            # Track error in metrics
            metrics_service.track_error("database_error", "error")
    
    def _get_query_type(self, statement: str) -> str:
        """Determine query type from SQL statement"""
        statement_lower = statement.lower().strip()
        
        if statement_lower.startswith("select"):
            return "select"
        elif statement_lower.startswith("insert"):
            return "insert"
        elif statement_lower.startswith("update"):
            return "update"
        elif statement_lower.startswith("delete"):
            return "delete"
        elif statement_lower.startswith("create"):
            return "create"
        elif statement_lower.startswith("drop"):
            return "drop"
        elif statement_lower.startswith("alter"):
            return "alter"
        elif any(statement_lower.startswith(cmd) for cmd in ["begin", "commit", "rollback"]):
            return "transaction"
        else:
            return "other"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current monitoring statistics"""
        return {
            **self.query_stats,
            "average_query_time": (
                self.query_stats["query_time_total"] / self.query_stats["total_queries"]
                if self.query_stats["total_queries"] > 0 else 0
            ),
            "slow_query_percentage": (
                (self.query_stats["slow_queries"] / self.query_stats["total_queries"]) * 100
                if self.query_stats["total_queries"] > 0 else 0
            )
        }
    
    def reset_stats(self) -> None:
        """Reset monitoring statistics"""
        self.query_stats = {
            "total_queries": 0,
            "slow_queries": 0,
            "failed_queries": 0,
            "query_time_total": 0.0
        }


# Global instance
db_monitoring = DatabaseMonitoring(
    slow_query_threshold=SLOW_QUERY_THRESHOLD,
    log_all_queries=LOG_ALL_QUERIES
)


def get_request_query_stats() -> Dict[str, Any]:
    """Get query statistics for the current request"""
    return {
        "query_count": query_count_var.get(),
        "total_query_time": query_time_var.get()
    }


def reset_request_query_stats() -> None:
    """Reset query statistics for the current request"""
    query_count_var.set(0)
    query_time_var.set(0.0)
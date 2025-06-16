"""
Request ID middleware for tracking requests through the system.
"""

import uuid
import time
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from contextvars import ContextVar
import logging

# Context variable to store the request ID
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)

# Configure logging
logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add a unique request ID to each request.
    This helps with tracking requests through logs and debugging.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Check if request already has an ID (from client or load balancer)
        request_id = request.headers.get('X-Request-ID')
        
        # Generate a new ID if none exists
        if not request_id:
            request_id = str(uuid.uuid4())
        
        # Store request ID in context variable
        request_id_var.set(request_id)
        
        # Add request ID to request state for easy access
        request.state.request_id = request_id
        
        # Log request start
        start_time = time.time()
        logger.info(
            f"Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else "unknown"
            }
        )
        
        try:
            # Process the request
            response = await call_next(request)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            # Calculate request duration
            duration = time.time() - start_time
            
            # Log request completion
            logger.info(
                f"Request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_seconds": round(duration, 3)
                }
            )
            
            return response
            
        except Exception as e:
            # Log request failure
            duration = time.time() - start_time
            logger.error(
                f"Request failed: {str(e)}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_seconds": round(duration, 3),
                    "error_type": type(e).__name__
                },
                exc_info=True
            )
            raise
        finally:
            # Clear the context variable
            request_id_var.set(None)


def get_request_id() -> Optional[str]:
    """
    Get the current request ID from context.
    Returns None if not in a request context.
    """
    return request_id_var.get()


class RequestIDLogFilter(logging.Filter):
    """
    Logging filter to add request ID to all log records.
    """
    
    def filter(self, record):
        # Add request ID to the log record
        record.request_id = get_request_id() or "no-request-id"
        return True


def configure_request_id_logging():
    """
    Configure logging to include request IDs.
    Call this during application startup.
    """
    # Add the filter to all handlers
    root_logger = logging.getLogger()
    request_id_filter = RequestIDLogFilter()
    
    for handler in root_logger.handlers:
        handler.addFilter(request_id_filter)
    
    # Update formatter to include request ID
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s'
    )
    
    for handler in root_logger.handlers:
        handler.setFormatter(formatter)
"""
Middleware for collecting metrics and monitoring requests
"""

import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable

from app.monitoring.metrics_collector import metrics_collector
from app.monitoring.security_monitor import security_monitor
from app.services.logging_service import get_logger
logger = get_logger("middleware.monitoring")


class MonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware to collect metrics and monitor security events"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Extract request details
        client_ip = self._get_client_ip(request)
        endpoint = str(request.url.path)
        method = request.method
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Check if IP is blocked (security monitor)
        if not security_monitor.is_ip_whitelisted(client_ip):
            if not security_monitor.track_request(
                ip=client_ip,
                endpoint=endpoint,
                method=method,
                user_agent=user_agent,
                status_code=0  # Pre-processing
            ):
                # IP is blocked, return 403
                return Response(
                    content="Access denied",
                    status_code=403,
                    headers={"X-Blocked-Reason": "Security"}
                )
        
        # Process request
        try:
            response = await call_next(request)
            status_code = response.status_code
            
        except Exception as e:
            # Handle exceptions
            logger.error(f"Request failed: {e}")
            status_code = 500
            response = Response(
                content="Internal server error",
                status_code=500
            )
        
        # Calculate request duration
        duration = time.time() - start_time
        
        # Record metrics
        metrics_collector.record_request(
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration=duration
        )
        
        # Update security monitoring
        if not security_monitor.is_ip_whitelisted(client_ip):
            # Get request data for pattern analysis
            request_data = await self._extract_request_data(request)
            security_monitor.track_request(
                ip=client_ip,
                endpoint=endpoint,
                method=method,
                user_agent=user_agent,
                status_code=status_code,
                request_data=request_data
            )
        
        # Add monitoring headers
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        response.headers["X-Request-ID"] = getattr(request.state, "request_id", "unknown")
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check forwarded headers first (for reverse proxy setups)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Use first IP in case of multiple proxies
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct client
        return request.client.host if request.client else "unknown"
    
    async def _extract_request_data(self, request: Request) -> dict:
        """Extract request data for security analysis"""
        try:
            data = {}
            
            # Query parameters
            if request.query_params:
                data["query"] = dict(request.query_params)
            
            # Form data or JSON body (only for specific content types)
            content_type = request.headers.get("content-type", "")
            
            if "application/json" in content_type:
                try:
                    # Note: This would consume the body, so we need to be careful
                    # In production, consider using request.stream() or copying body
                    data["json"] = await request.json()
                except:
                    pass
            elif "application/x-www-form-urlencoded" in content_type:
                try:
                    data["form"] = await request.form()
                except:
                    pass
            
            # Headers (selective)
            suspicious_headers = [
                "user-agent", "referer", "origin", "authorization"
            ]
            data["headers"] = {
                k: v for k, v in request.headers.items()
                if k.lower() in suspicious_headers
            }
            
            return data
            
        except Exception as e:
            logger.warning(f"Failed to extract request data: {e}")
            return {}


class MetricsOnlyMiddleware(BaseHTTPMiddleware):
    """Lightweight middleware for basic metrics collection only"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration and record metrics
        duration = time.time() - start_time
        metrics_collector.record_request(
            endpoint=str(request.url.path),
            method=request.method,
            status_code=response.status_code,
            duration=duration
        )
        
        return response
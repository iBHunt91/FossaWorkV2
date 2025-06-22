"""
Rate Limiting Middleware
Provides DDoS protection and brute force prevention
"""

from fastapi import Request, HTTPException, status
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from typing import Dict
import time

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Custom rate limit exceeded handler
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded responses"""
    logger.warning(f"Rate limit exceeded for {get_remote_address(request)}: {str(exc)}")
    
    # Add CORS headers for proper frontend handling
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "Rate limit exceeded",
            "message": "Too many requests. Please wait before trying again.",
            "retry_after": getattr(exc, 'retry_after', 60)
        },
        headers=headers
    )

# Rate limiting configurations for different endpoint types
RATE_LIMITS = {
    # Authentication endpoints (most restrictive)
    "auth": "5/minute",  # 5 login attempts per minute
    
    # API endpoints (moderate)
    "api": "60/minute",  # 60 API calls per minute
    
    # Automation endpoints (restrictive due to resource usage)
    "automation": "10/minute",  # 10 automation requests per minute
    
    # Scraping endpoints (very restrictive)
    "scraping": "10/minute",  # 10 scraping requests per minute
    
    # File operations
    "files": "100/minute",  # 100 file operations per minute
    
    # General endpoints
    "general": "100/minute",  # 100 requests per minute
}

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware for applying rate limits based on endpoint patterns
    """
    
    def __init__(self, app, limiter_instance=None):
        super().__init__(app)
        self.limiter = limiter_instance or limiter
        self.client_requests = {}  # Track requests per client
        
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
            
        # Get client IP
        client_ip = get_remote_address(request)
        path = request.url.path
        
        # Determine rate limit based on endpoint
        rate_limit_str = self._get_rate_limit_for_path(path)
        
        # Apply rate limiting if configured
        if rate_limit_str:
            try:
                # Parse rate limit (e.g., "5/minute" -> 5 requests per 60 seconds)
                limit, period = rate_limit_str.split("/")
                limit = int(limit)
                period_seconds = {"minute": 60, "hour": 3600, "day": 86400}.get(period, 60)
                
                # Check if client exceeds rate limit
                current_time = time.time()
                if client_ip not in self.client_requests:
                    self.client_requests[client_ip] = []
                
                # Clean old requests
                self.client_requests[client_ip] = [
                    req_time for req_time in self.client_requests[client_ip]
                    if current_time - req_time < period_seconds
                ]
                
                # Check if limit exceeded
                if len(self.client_requests[client_ip]) >= limit:
                    logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
                    return await rate_limit_exceeded_handler(request, 
                        type('MockRateLimitExceeded', (), {'retry_after': period_seconds})())
                
                # Add current request
                self.client_requests[client_ip].append(current_time)
                
                # Log rate limited requests for monitoring
                logger.debug(f"Rate limit check passed for {client_ip} on {path}")
                
            except Exception as e:
                logger.error(f"Rate limiting error for {client_ip} on {path}: {str(e)}")
                # Continue without rate limiting if there's an error
        
        # Continue with request
        response = await call_next(request)
        return response
    
    def _get_rate_limit_for_path(self, path: str) -> str:
        """Determine rate limit based on URL path"""
        
        # Authentication endpoints - most restrictive
        if "/api/auth/" in path:
            return RATE_LIMITS["auth"]
        
        # Automation endpoints - resource intensive
        elif "/api/automation/" in path or "/api/v1/automation/" in path:
            return RATE_LIMITS["automation"]
        
        # Scraping endpoints - very resource intensive
        elif "scrape" in path or "/api/scraping" in path:
            return RATE_LIMITS["scraping"]
        
        # File operations
        elif "/api/v1/logs/" in path or "upload" in path or "download" in path:
            return RATE_LIMITS["files"]
        
        # General API endpoints
        elif "/api/" in path:
            return RATE_LIMITS["api"]
        
        # Health checks and static content - no limits
        elif path in ["/health", "/docs", "/openapi.json", "/redoc"] or path.startswith("/static"):
            return None
        
        # Everything else gets general limit
        else:
            return RATE_LIMITS["general"]

# Track failed authentication attempts for enhanced security
failed_auth_attempts: Dict[str, list] = {}

def track_failed_auth(client_ip: str):
    """Track failed authentication attempts for brute force detection"""
    current_time = time.time()
    
    if client_ip not in failed_auth_attempts:
        failed_auth_attempts[client_ip] = []
    
    # Add current attempt
    failed_auth_attempts[client_ip].append(current_time)
    
    # Clean up old attempts (older than 1 hour)
    failed_auth_attempts[client_ip] = [
        attempt for attempt in failed_auth_attempts[client_ip]
        if current_time - attempt < 3600
    ]
    
    # Check if IP should be temporarily blocked
    recent_attempts = [
        attempt for attempt in failed_auth_attempts[client_ip]
        if current_time - attempt < 300  # Last 5 minutes
    ]
    
    if len(recent_attempts) >= 10:  # 10 failed attempts in 5 minutes
        logger.warning(f"Potential brute force attack detected from {client_ip}")
        return True
    
    return False

def clear_failed_auth(client_ip: str):
    """Clear failed authentication attempts after successful login"""
    if client_ip in failed_auth_attempts:
        del failed_auth_attempts[client_ip]

# Decorator for applying specific rate limits to routes
def rate_limit(limit: str):
    """Decorator for applying rate limits to specific routes"""
    def decorator(func):
        return limiter.limit(limit)(func)
    return decorator

# Pre-configured decorators for common use cases
auth_rate_limit = rate_limit(RATE_LIMITS["auth"])
api_rate_limit = rate_limit(RATE_LIMITS["api"])
automation_rate_limit = rate_limit(RATE_LIMITS["automation"])
scraping_rate_limit = rate_limit(RATE_LIMITS["scraping"])
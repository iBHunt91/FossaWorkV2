"""
Security Headers Middleware for FossaWork V2

Implements OWASP-recommended security headers to protect against common attacks:
- XSS (Cross-Site Scripting)
- Clickjacking
- MIME type sniffing
- And more
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import logging
from typing import Dict, Optional
import os

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all HTTP responses.
    
    This middleware implements security best practices recommended by OWASP
    to protect against common web vulnerabilities.
    """
    
    def __init__(self, app, environment: str = None):
        super().__init__(app)
        self.environment = environment or os.getenv("ENVIRONMENT", "development")
        logger.info(f"Security headers middleware initialized for environment: {self.environment}")
        
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers based on environment
        if self.environment == "development":
            self._add_development_headers(response)
        elif self.environment == "staging":
            self._add_staging_headers(response)
        else:  # production
            self._add_production_headers(response)
        
        # Add common headers for all environments
        self._add_common_headers(response)
        
        return response
    
    def _add_common_headers(self, response: Response):
        """Add security headers common to all environments"""
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS Protection for older browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy (formerly Feature Policy)
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=()"
        )
        
    def _add_development_headers(self, response: Response):
        """Security headers for development environment"""
        
        # Prevent iframe embedding
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        
        # Content Security Policy - Relaxed for development
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: http://localhost:* https:",
            "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https://app.workfossa.com",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "worker-src 'self' blob:",
        ]
        
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # Don't enforce HTTPS in development
        # No HSTS header
        
    def _add_staging_headers(self, response: Response):
        """Security headers for staging environment"""
        
        # Prevent iframe embedding
        response.headers["X-Frame-Options"] = "DENY"
        
        # Content Security Policy - Stricter than development
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",  # Remove unsafe-eval
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' wss: https://app.workfossa.com",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "worker-src 'self' blob:",
            "upgrade-insecure-requests",
        ]
        
        # Add CSP report URI if configured
        report_uri = os.getenv("CSP_REPORT_URI")
        if report_uri:
            csp_directives.append(f"report-uri {report_uri}")
        
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # HSTS with shorter duration for staging
        response.headers["Strict-Transport-Security"] = "max-age=86400; includeSubDomains"
        
    def _add_production_headers(self, response: Response):
        """Security headers for production environment"""
        
        # Prevent iframe embedding
        response.headers["X-Frame-Options"] = "DENY"
        
        # Content Security Policy - Strictest settings
        csp_directives = [
            "default-src 'self'",
            "script-src 'self'",  # Consider adding nonces in future
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  # React needs unsafe-inline
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' wss: https://app.workfossa.com",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "worker-src 'self' blob:",
            "upgrade-insecure-requests",
            "block-all-mixed-content",
        ]
        
        # Add CSP report URI if configured
        report_uri = os.getenv("CSP_REPORT_URI")
        if report_uri:
            csp_directives.append(f"report-uri {report_uri}")
            csp_directives.append(f"report-to csp-endpoint")
        
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # HSTS with long duration for production (2 years)
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
        
        # Additional production headers
        response.headers["Expect-CT"] = 'max-age=86400, enforce'
        
        # Report-To header for modern browsers
        if report_uri:
            response.headers["Report-To"] = (
                '{"group":"csp-endpoint","max_age":10886400,'
                f'"endpoints":[{{"url":"{report_uri}"}}],'
                '"include_subdomains":true}'
            )


def create_security_headers_config(environment: Optional[str] = None) -> Dict[str, str]:
    """
    Create a dictionary of security headers for manual use.
    
    This can be used when you need to add security headers outside of middleware,
    such as in specific route handlers.
    """
    headers = {}
    env = environment or os.getenv("ENVIRONMENT", "development")
    
    # Common headers
    headers["X-Content-Type-Options"] = "nosniff"
    headers["X-XSS-Protection"] = "1; mode=block"
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    headers["X-Frame-Options"] = "DENY" if env != "development" else "SAMEORIGIN"
    
    # Environment-specific CSP
    if env == "development":
        headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "connect-src 'self' http://localhost:* ws://localhost:* https://app.workfossa.com"
        )
    else:
        headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "connect-src 'self' wss: https://app.workfossa.com"
        )
        
        if env == "production":
            headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
    
    return headers
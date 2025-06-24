"""
Security Migration Middleware

This middleware helps identify and optionally block insecure API patterns during
the migration to secure authentication patterns. It logs all endpoints that
accept user_id as a query parameter.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from datetime import datetime
from typing import Set, Dict, List
import logging
import json
from collections import defaultdict

logger = logging.getLogger(__name__)

# Global instance for accessing reports
_migration_middleware_instance = None

class SecurityMigrationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to support migration from query param user_id to JWT-based auth.
    
    Features:
    - Logs all requests with user_id query parameters
    - Tracks unique endpoints that need migration
    - Can be configured to block or allow legacy patterns
    - Provides migration progress reporting
    """
    
    def __init__(self, app, block_legacy: bool = False):
        super().__init__(app)
        self.block_legacy = block_legacy
        self.logged_endpoints: Set[str] = set()
        self.violation_counts: Dict[str, int] = defaultdict(int)
        self.migration_start = datetime.utcnow()
        
        # Store global instance for report access
        global _migration_middleware_instance
        _migration_middleware_instance = self
        
        # Critical endpoints that should NEVER accept user_id from query
        self.critical_endpoints = {
            "/api/v1/credentials/workfossa/decrypt",
            "/api/settings/smtp",
            "/api/credentials",
        }
        
        # Endpoints known to need migration
        self.legacy_endpoints = {
            "/api/v1/work-orders",
            "/api/v1/work-orders/scrape",
            "/api/settings",
            "/api/notifications/preferences",
            "/api/user-preferences",
            "/api/scraping/schedules",
            "/api/dispensers",
            "/api/filters",
        }
    
    async def dispatch(self, request: Request, call_next):
        # Check if request has user_id in query params
        if "user_id" in request.query_params:
            endpoint_path = self._get_endpoint_path(request)
            
            # Log if we haven't seen this endpoint before
            if endpoint_path not in self.logged_endpoints:
                self.logged_endpoints.add(endpoint_path)
                logger.warning(
                    f"SECURITY_MIGRATION: New endpoint found with user_id param: "
                    f"{request.method} {endpoint_path}"
                )
            
            # Track violation count
            self.violation_counts[endpoint_path] += 1
            
            # Check if this is a critical endpoint
            if any(endpoint_path.startswith(critical) for critical in self.critical_endpoints):
                logger.error(
                    f"CRITICAL_SECURITY: Critical endpoint accessed with user_id param: "
                    f"{endpoint_path} | IP: {request.client.host}"
                )
                
                if self.block_legacy:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "This endpoint no longer accepts user_id parameter",
                            "migration_required": True,
                            "severity": "CRITICAL"
                        }
                    )
            
            # Log details for migration tracking
            logger.info(
                f"MIGRATION_TRACKING: {request.method} {endpoint_path} | "
                f"user_id: {request.query_params.get('user_id')} | "
                f"IP: {request.client.host} | "
                f"Count: {self.violation_counts[endpoint_path]}"
            )
            
            # Add deprecation header
            response = await call_next(request)
            response.headers["X-Deprecation-Warning"] = (
                "user_id query parameter is deprecated and will be removed. "
                "User context should come from authentication token."
            )
            
            # Add security headers for critical endpoints
            if any(endpoint_path.startswith(critical) for critical in self.critical_endpoints):
                response.headers["X-Security-Warning"] = "CRITICAL: This endpoint has enhanced security requirements"
            
            return response
        
        # Check if this endpoint SHOULD have authentication but doesn't
        auth_header = request.headers.get("authorization")
        if not auth_header and self._requires_auth(request):
            logger.warning(
                f"MISSING_AUTH: Request without auth header to protected endpoint: "
                f"{request.method} {self._get_endpoint_path(request)}"
            )
        
        return await call_next(request)
    
    def _get_endpoint_path(self, request: Request) -> str:
        """Extract the API endpoint path without query params"""
        return request.url.path
    
    def _requires_auth(self, request: Request) -> bool:
        """Check if endpoint should require authentication"""
        path = self._get_endpoint_path(request)
        
        # Public endpoints that don't need auth
        public_endpoints = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/health",
            "/docs",
            "/openapi.json",
        }
        
        # Check if it's a public endpoint
        if any(path.startswith(public) for public in public_endpoints):
            return False
        
        # All API endpoints should require auth
        return path.startswith("/api/")
    
    def get_migration_report(self) -> dict:
        """Generate a report of endpoints needing migration"""
        return {
            "migration_start": self.migration_start.isoformat(),
            "duration_hours": (datetime.utcnow() - self.migration_start).total_seconds() / 3600,
            "total_legacy_endpoints": len(self.logged_endpoints),
            "total_violations": sum(self.violation_counts.values()),
            "endpoints": [
                {
                    "path": endpoint,
                    "violation_count": self.violation_counts[endpoint],
                    "is_critical": any(endpoint.startswith(c) for c in self.critical_endpoints),
                    "is_known_legacy": any(endpoint.startswith(l) for l in self.legacy_endpoints)
                }
                for endpoint in sorted(self.logged_endpoints)
            ],
            "recommendations": self._generate_recommendations()
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Generate actionable recommendations based on findings"""
        recommendations = []
        
        # Check for critical endpoints
        critical_found = [
            ep for ep in self.logged_endpoints 
            if any(ep.startswith(c) for c in self.critical_endpoints)
        ]
        if critical_found:
            recommendations.append(
                f"URGENT: Fix {len(critical_found)} critical endpoints immediately: {', '.join(critical_found)}"
            )
        
        # Check for high-traffic endpoints
        high_traffic = [
            ep for ep, count in self.violation_counts.items() 
            if count > 100
        ]
        if high_traffic:
            recommendations.append(
                f"Prioritize fixing high-traffic endpoints: {', '.join(high_traffic)}"
            )
        
        # Unknown endpoints
        unknown = [
            ep for ep in self.logged_endpoints
            if not any(ep.startswith(l) for l in self.legacy_endpoints)
        ]
        if unknown:
            recommendations.append(
                f"Review {len(unknown)} unknown endpoints for security: {', '.join(unknown[:5])}..."
            )
        
        return recommendations

def get_migration_middleware_instance():
    """Get the global migration middleware instance for report access"""
    return _migration_middleware_instance
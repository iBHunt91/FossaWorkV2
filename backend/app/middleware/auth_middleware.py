"""
Authentication Middleware
Protects routes by default, with exceptions for public endpoints
"""

from fastapi import Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Set, Optional
import logging

logger = logging.getLogger(__name__)

# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = {
    "/",
    "/health",
    "/api/auth/login",
    "/api/auth/verify",
    "/api/auth/check",
    "/api/setup/status",
    "/api/setup/initialize",
    "/api/v1/logs/write",  # Allow frontend logging without auth
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Prefixes for public endpoints (allow without auth)
PUBLIC_PREFIXES = {
    "/static",
    "/favicon",
}

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware that requires authentication for protected routes
    """
    
    async def dispatch(self, request: Request, call_next):
        # Check if endpoint is public
        path = request.url.path
        
        # Allow OPTIONS requests for CORS preflight
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Allow public endpoints
        if path in PUBLIC_ENDPOINTS:
            return await call_next(request)
        
        # Allow public prefixes
        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)
        
        # Check for Authorization header
        auth_header = request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning(f"Unauthorized access attempt to {path}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication required",
                    "message": "Please provide a valid authentication token"
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Token validation is handled by the endpoint dependencies
        # This middleware just ensures the header exists
        response = await call_next(request)
        return response


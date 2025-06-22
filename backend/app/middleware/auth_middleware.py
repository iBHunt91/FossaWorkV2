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

from ..auth.security import verify_token

logger = logging.getLogger(__name__)

# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = {
    "/",
    "/health",
    "/api/auth/login",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Semi-public endpoints that may need special handling
CONDITIONAL_PUBLIC_ENDPOINTS = {
    "/api/auth/verify",  # Only during initial auth flow
    "/api/auth/check",   # Only for checking current auth status
    "/api/setup/status", # Only during initial setup
    "/api/setup/initialize",  # Only during initial setup
    "/api/v1/logs/write",  # Allow frontend logging but should be rate-limited
}

# Development mode endpoints (REMOVE IN PRODUCTION!)
import os
if os.getenv("ENVIRONMENT", "development") == "development":
    # In development, temporarily allow some endpoints without auth for testing
    DEVELOPMENT_PUBLIC_ENDPOINTS = {
        "/api/auth/demo-login",  # Demo login endpoint
    }
else:
    DEVELOPMENT_PUBLIC_ENDPOINTS = set()

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
        
        # Allow development endpoints in dev mode
        if path in DEVELOPMENT_PUBLIC_ENDPOINTS:
            logger.warning(f"Development endpoint accessed without auth: {path}")
            return await call_next(request)
        
        # Allow public prefixes
        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)
        
        # Handle conditional public endpoints
        if path in CONDITIONAL_PUBLIC_ENDPOINTS:
            # For now, allow these but log access
            logger.info(f"Conditional public endpoint accessed: {path}")
            # TODO: Add rate limiting and additional checks
            return await call_next(request)
        
        # Check for Authorization header
        auth_header = request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning(f"Unauthorized access attempt to {path} - No auth header")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication required",
                    "message": "Please provide a valid authentication token"
                },
                headers={
                    "WWW-Authenticate": "Bearer",
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Extract and validate JWT token
        token = auth_header.split(" ")[1] if len(auth_header.split(" ")) > 1 else None
        
        if not token:
            logger.warning(f"Unauthorized access attempt to {path} - Invalid header format")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Invalid authentication header format",
                    "message": "Authorization header must be in format: Bearer <token>"
                },
                headers={
                    "WWW-Authenticate": "Bearer",
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Validate the JWT token
        payload = verify_token(token)
        if not payload:
            logger.warning(f"Unauthorized access attempt to {path} - Invalid token")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Invalid or expired token",
                    "message": "Please login again to get a new token"
                },
                headers={
                    "WWW-Authenticate": "Bearer",
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Store user info in request state for downstream use
        request.state.user_id = payload.get("sub")
        request.state.token_payload = payload
        
        response = await call_next(request)
        return response


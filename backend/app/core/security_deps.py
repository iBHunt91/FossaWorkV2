"""
Enhanced Security Dependencies for Authentication and Authorization

This module provides secure dependency injection functions that should be used
across all API endpoints to ensure proper authentication and authorization.
"""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, Callable
import logging
from datetime import datetime
from functools import wraps

from ..database import get_db
from ..models import User
from ..auth.dependencies import get_optional_current_user, get_current_user

logger = logging.getLogger(__name__)

# Security event types for logging
class SecurityEvent:
    AUTH_FAILED = "AUTH_FAILED"
    ACCESS_DENIED = "ACCESS_DENIED" 
    ADMIN_ACCESS = "ADMIN_ACCESS"
    CREDENTIAL_ACCESS = "CREDENTIAL_ACCESS"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"

def log_security_event(
    event_type: str,
    user_id: Optional[str],
    details: dict,
    request: Optional[Request] = None
):
    """Log security-related events for audit trail"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "user_id": user_id,
        "details": details,
        "ip_address": request.client.host if request else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown") if request else "unknown"
    }
    
    if event_type in [SecurityEvent.ACCESS_DENIED, SecurityEvent.SUSPICIOUS_ACTIVITY]:
        logger.warning(f"Security Event: {log_entry}")
    else:
        logger.info(f"Security Event: {log_entry}")
    
    # TODO: Write to dedicated security audit log file or database
    # audit_logger.log(log_entry)

async def require_auth(
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user)
) -> User:
    """
    Enhanced authentication requirement that logs failures
    """
    if not current_user:
        log_security_event(
            SecurityEvent.AUTH_FAILED,
            user_id=None,
            details={"endpoint": str(request.url)},
            request=request
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    return current_user

async def require_admin(
    request: Request,
    current_user: User = Depends(require_auth)
) -> User:
    """
    Require admin privileges and log admin actions
    """
    if not current_user.is_admin:
        log_security_event(
            SecurityEvent.ACCESS_DENIED,
            user_id=current_user.id,
            details={
                "endpoint": str(request.url),
                "reason": "Admin access required"
            },
            request=request
        )
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Log successful admin access
    log_security_event(
        SecurityEvent.ADMIN_ACCESS,
        user_id=current_user.id,
        details={"endpoint": str(request.url)},
        request=request
    )
    
    return current_user

async def require_user_access(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_auth)
) -> User:
    """
    Verify that the authenticated user can access the requested user_id's data.
    This prevents users from accessing other users' data.
    
    Args:
        user_id: The user_id being accessed (from query param or path)
        request: The FastAPI request object
        current_user: The authenticated user
        
    Returns:
        The authenticated user if access is allowed
        
    Raises:
        HTTPException: 403 if user tries to access another user's data
    """
    # Users can only access their own data unless they're admin
    if current_user.id != user_id and not current_user.is_admin:
        log_security_event(
            SecurityEvent.ACCESS_DENIED,
            user_id=current_user.id,
            details={
                "endpoint": str(request.url),
                "attempted_user_id": user_id,
                "reason": "Attempted to access another user's data"
            },
            request=request
        )
        raise HTTPException(
            status_code=403,
            detail="You can only access your own data"
        )
    
    # Log admin accessing another user's data
    if current_user.id != user_id and current_user.is_admin:
        log_security_event(
            SecurityEvent.ADMIN_ACCESS,
            user_id=current_user.id,
            details={
                "endpoint": str(request.url),
                "target_user_id": user_id,
                "action": "Accessing another user's data"
            },
            request=request
        )
    
    return current_user

def log_security_violation(
    user_id: str,
    violation_type: str,
    details: dict,
    request: Request
):
    """
    Log potential security violations for investigation
    """
    log_security_event(
        SecurityEvent.SUSPICIOUS_ACTIVITY,
        user_id=user_id,
        details={
            "violation_type": violation_type,
            **details
        },
        request=request
    )

# Dependency to get current user's ID directly
async def get_current_user_id(
    current_user: User = Depends(require_auth)
) -> str:
    """Get the authenticated user's ID - use this instead of query params"""
    return current_user.id

# Rate limiting decorator for sensitive endpoints
def rate_limit(max_calls: int = 10, window_seconds: int = 60):
    """
    Simple rate limiting decorator for sensitive endpoints
    TODO: Implement with Redis for production use
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # TODO: Implement actual rate limiting
            return await func(*args, **kwargs)
        return wrapper
    return decorator
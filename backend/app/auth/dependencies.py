"""
Authentication Dependencies
Easy-to-use dependencies for protecting routes
"""

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user_models import User
from .security import get_current_user, get_optional_current_user

# Re-export for convenience
__all__ = ['get_current_user', 'get_optional_current_user', 'require_auth', 'RequireAuth']

# Simple dependency that can be added to any route
async def require_auth(current_user: User = Depends(get_current_user)) -> User:
    """
    Simple dependency to require authentication
    Usage: 
        @router.get("/protected")
        async def protected_route(user: User = Depends(require_auth)):
            return {"user": user.username}
    """
    return current_user

class RequireAuth:
    """
    Class-based dependency for more complex authentication requirements
    """
    
    def __init__(self, scopes: Optional[List[str]] = None):
        self.scopes = scopes or []
    
    async def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Here we could check for specific permissions/scopes
        # For now, just return the authenticated user
        if not current_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user account"
            )
        return current_user

# Convenience instances
require_active_user = RequireAuth()
"""
Setup Routes for Initial System Configuration
These routes are only available when no users exist in the system
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from ..database import get_db
from ..models.user_models import User

router = APIRouter(prefix="/api/setup", tags=["setup"])

@router.get("/status", response_model=Dict[str, Any])
async def get_setup_status(db: Session = Depends(get_db)):
    """Check if initial setup is required"""
    user_count = db.query(User).count()
    
    return {
        "setup_required": user_count == 0,
        "user_count": user_count,
        "message": "Please complete initial setup" if user_count == 0 else "System is configured"
    }
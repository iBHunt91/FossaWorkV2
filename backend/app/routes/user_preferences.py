#!/usr/bin/env python3
"""
User Preferences API routes - Manage user settings and preferences
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import json
from datetime import datetime

from database import get_db
from models_simple import User

router = APIRouter(prefix="/api/v1/users", tags=["user_preferences"])

# Default preferences structure
DEFAULT_PREFERENCES = {
    "notifications": {
        "email_enabled": True,
        "push_enabled": True,
        "frequency": "immediate"
    },
    "system": {
        "auto_scrape": True,
        "auto_start": True,
        "cleanup_days": 30
    },
    "ui": {
        "theme": "light",
        "default_view": "work_orders",
        "show_animations": True
    }
}

@router.get("/{user_id}/preferences")
async def get_user_preferences(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Get user preferences"""
    try:
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # For demo mode, return default preferences
            return DEFAULT_PREFERENCES
        
        # Parse user preferences or return defaults
        if user.preferences:
            try:
                preferences = json.loads(user.preferences) if isinstance(user.preferences, str) else user.preferences
                # Merge with defaults to ensure all keys exist
                result = DEFAULT_PREFERENCES.copy()
                result.update(preferences)
                return result
            except:
                return DEFAULT_PREFERENCES
        
        return DEFAULT_PREFERENCES
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@router.put("/{user_id}/preferences/{preference_type}")
async def update_user_preference(
    user_id: str,
    preference_type: str,
    preference_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Update a specific user preference type"""
    try:
        # Verify user exists or create demo user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Create demo user for demo mode
            user = User(
                id=user_id,
                username="demo-user",
                email="demo@fossawork.com",
                preferences=json.dumps(DEFAULT_PREFERENCES)
            )
            db.add(user)
            db.flush()
        
        # Get current preferences
        current_prefs = DEFAULT_PREFERENCES.copy()
        if user.preferences:
            try:
                current_prefs.update(json.loads(user.preferences) if isinstance(user.preferences, str) else user.preferences)
            except:
                pass
        
        # Update specific preference type
        if preference_type in current_prefs:
            current_prefs[preference_type].update(preference_data)
        else:
            current_prefs[preference_type] = preference_data
        
        # Save back to user
        user.preferences = json.dumps(current_prefs)
        user.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "status": "success",
            "message": f"Preference '{preference_type}' updated successfully",
            "updated_preferences": current_prefs[preference_type],
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update preference: {str(e)}")

@router.put("/{user_id}/preferences")
async def update_all_user_preferences(
    user_id: str,
    preferences: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Update all user preferences"""
    try:
        # Verify user exists or create demo user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Create demo user for demo mode
            user = User(
                id=user_id,
                username="demo-user",
                email="demo@fossawork.com",
                preferences=json.dumps(DEFAULT_PREFERENCES)
            )
            db.add(user)
            db.flush()
        
        # Merge with defaults to ensure all required keys exist
        final_prefs = DEFAULT_PREFERENCES.copy()
        final_prefs.update(preferences)
        
        # Save to user
        user.preferences = json.dumps(final_prefs)
        user.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "status": "success",
            "message": "All preferences updated successfully",
            "preferences": final_prefs,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")

@router.delete("/{user_id}/preferences")
async def reset_user_preferences(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Reset user preferences to defaults"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Reset to default preferences
        user.preferences = json.dumps(DEFAULT_PREFERENCES)
        user.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Preferences reset to defaults",
            "preferences": DEFAULT_PREFERENCES,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset preferences: {str(e)}")
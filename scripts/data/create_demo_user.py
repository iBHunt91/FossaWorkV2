#!/usr/bin/env python3
"""
Create a demo user for testing the frontend without authentication
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import SessionLocal, engine
from app.models.user_models import User, UserCredential, UserPreference
from app.services.credential_manager import CredentialManager, WorkFossaCredentials

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_demo_user():
    """Create a demo user for testing"""
    db = SessionLocal()
    
    try:
        # Demo user details
        user_id = "demo-user"
        username = "demo@example.com"
        password = "demo123"
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.id == user_id).first()
        if existing_user:
            print(f"✓ Demo user already exists: {username} (ID: {user_id})")
            return
        
        # Create new demo user
        print(f"Creating demo user: {username}")
        
        new_user = User(
            id=user_id,  # Force specific ID for demo user
            email=username,
            password_hash=pwd_context.hash(password),
            label="Demo User",
            friendly_name="Demo",
            configured_email=username,
            last_used=datetime.now(timezone.utc)
        )
        
        db.add(new_user)
        
        # Store dummy WorkFossa credentials
        credential_manager = CredentialManager()
        wf_credentials = WorkFossaCredentials(
            username="demo@workfossa.com",
            password="demo_password",
            user_id=user_id,
            is_valid=False,  # Mark as invalid since these are dummy credentials
            last_used=datetime.now(timezone.utc)
        )
        credential_manager.store_credentials(wf_credentials)
        
        # Set default preferences
        default_preferences = [
            UserPreference(
                user_id=user_id,
                category="notification_settings",
                settings={
                    "email": {"enabled": False},
                    "pushover": {"enabled": False}
                }
            ),
            UserPreference(
                user_id=user_id,
                category="work_week",
                settings={
                    "monday": True,
                    "tuesday": True,
                    "wednesday": True,
                    "thursday": True,
                    "friday": True,
                    "saturday": False,
                    "sunday": False
                }
            )
        ]
        
        for pref in default_preferences:
            db.add(pref)
        
        db.commit()
        
        print(f"✓ Successfully created demo user: {username}")
        print(f"  - User ID: {user_id}")
        print(f"  - Email: {username}")
        print(f"  - Password: {password}")
        print(f"  - Display Name: Demo User")
        print("\n✓ Demo user ready for testing!")
        
    except Exception as e:
        print(f"✗ Error creating demo user: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_user()
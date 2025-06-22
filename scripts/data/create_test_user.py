#!/usr/bin/env python3
"""
Create a test user directly in the database for development
This bypasses WorkFossa authentication for testing purposes
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import SessionLocal, engine
from app.models.user_models import User, UserCredential, UserPreference, generate_user_id
from app.services.credential_manager import CredentialManager, WorkFossaCredentials

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_test_user():
    """Create a test user directly in the database"""
    db = SessionLocal()
    
    try:
        # Test user credentials
        username = os.getenv("TEST_USERNAME", "test@example.com")
        password = os.getenv("TEST_PASSWORD", "test_password")
        
        # Generate user ID
        user_id = generate_user_id(username)
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.id == user_id).first()
        if existing_user:
            print(f"✓ User already exists: {username} (ID: {user_id})")
            print(f"  You can login with these credentials!")
            return
        
        # Create new user with correct V1-compatible model structure
        print(f"Creating test user: {username}")
        
        new_user = User(
            email=username,  # User constructor will generate ID from email
            password_hash=pwd_context.hash(password),
            label="Bruce Hunt",  # Display name
            friendly_name="Bruce",  # Short name
            configured_email=username,  # Notification email
            last_used=datetime.now(timezone.utc)
        )
        
        db.add(new_user)
        
        # Store WorkFossa credentials using CredentialManager's store_credentials method
        credential_manager = CredentialManager()
        wf_credentials = WorkFossaCredentials(
            username=username,
            password=password,
            user_id=user_id,
            is_valid=True,
            last_used=datetime.now(timezone.utc)
        )
        credential_manager.store_credentials(wf_credentials)
        
        # Set default preferences
        default_preferences = [
            UserPreference(
                user_id=user_id,
                category="notification_settings",
                settings={
                    "email": {"enabled": True, "frequency": "immediate"},
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
        
        print(f"✓ Successfully created test user: {username}")
        print(f"  - User ID: {user_id}")
        print(f"  - Email: {username}")
        print(f"  - Password: {password}")
        print(f"  - Display Name: Bruce Hunt")
        print("\n✓ You can now login with these credentials!")
        
    except Exception as e:
        print(f"✗ Error creating test user: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
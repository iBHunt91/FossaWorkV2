#!/usr/bin/env python3
"""
Debug notification and settings endpoints
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal, engine
from app.models.user_models import User
from app.auth.dependencies import get_current_user
from app.routes.notifications import get_notification_manager_dependency
from sqlalchemy.orm import Session

def test_endpoints():
    """Test the problematic endpoints locally"""
    
    # Create a database session
    db = SessionLocal()
    
    try:
        # Get a user
        user = db.query(User).filter(User.email == "bruce.hunt@owlservices.com").first()
        if user:
            print(f"Found user: {user.email} (ID: {user.id})")
            
            # Test notification manager
            print("\nTesting notification manager initialization...")
            try:
                nm = get_notification_manager_dependency()
                print("✓ Notification manager created successfully")
            except Exception as e:
                print(f"✗ Error creating notification manager: {e}")
                import traceback
                traceback.print_exc()
            
            # Test loading user preferences
            print("\nTesting user preferences...")
            try:
                from app.services.user_management import UserManagementService
                user_service = UserManagementService(db)
                prefs = user_service.get_user_preferences(user.id)
                print(f"✓ User preferences loaded: {list(prefs.keys())}")
            except Exception as e:
                print(f"✗ Error loading preferences: {e}")
                import traceback
                traceback.print_exc()
                
            # Test settings path
            print("\nTesting settings paths...")
            try:
                from app.routes.settings import get_settings_path, load_settings
                smtp_path = get_settings_path(user.id, "smtp")
                print(f"SMTP settings path: {smtp_path}")
                print(f"Path exists: {smtp_path.exists()}")
                
                settings = load_settings(user.id, "smtp", {})
                print(f"Loaded settings: {settings}")
            except Exception as e:
                print(f"✗ Error with settings: {e}")
                import traceback
                traceback.print_exc()
                
        else:
            print("User not found!")
            
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Endpoint Debug Tool ===")
    test_endpoints()
#!/usr/bin/env python3
"""
Debug script to test auth endpoints and identify the 500 error
"""

import os
import sys
import traceback
import asyncio
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, '.')

async def test_auth_endpoints():
    """Test auth endpoints step by step to find the error"""
    
    print("=== Testing Auth Debug ===")
    
    try:
        print("1. Testing imports...")
        
        # Test basic imports
        from app.database import get_db, SessionLocal
        print("✓ Database imports successful")
        
        from app.models.user_models import User
        print("✓ User model import successful")
        
        from app.auth.security import AuthenticationService, create_access_token
        print("✓ Security imports successful")
        
        print("2. Testing database connection...")
        db = SessionLocal()
        user_count = db.query(User).count()
        print(f"✓ Database connection successful. User count: {user_count}")
        db.close()
        
        print("3. Testing password hashing...")
        password_hash = User.hash_password("demo123")
        print(f"✓ Password hashing successful: {password_hash[:20]}...")
        
        print("4. Testing demo user creation...")
        demo_user_id = "demo"
        db = SessionLocal()
        
        # Check if demo user exists
        demo_user = db.query(User).filter(User.id == demo_user_id).first()
        if demo_user:
            print(f"✓ Demo user already exists: {demo_user.email}")
        else:
            print("Creating demo user...")
            # Test user creation
            demo_user = User(
                id=demo_user_id,
                email="demo@fossawork.com",
                password_hash=User.hash_password("demo123"),
                label="Demo User",
                friendly_name="Demo",
                created_at=datetime.utcnow()
            )
            db.add(demo_user)
            db.commit()
            print("✓ Demo user created successfully")
        
        print("5. Testing token creation...")
        from datetime import timedelta
        access_token_expires = timedelta(hours=24)
        access_token = create_access_token(
            data={"sub": demo_user.id},
            expires_delta=access_token_expires
        )
        print(f"✓ Token creation successful: {access_token[:20]}...")
        
        db.close()
        print("\n✅ All auth components are working correctly!")
        print("The 500 error must be in the FastAPI route handling or middleware.")
        
    except Exception as e:
        print(f"\n❌ Error found: {e}")
        print("\nFull traceback:")
        traceback.print_exc()
        return False
        
    return True

if __name__ == "__main__":
    # Change to backend directory
    os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes/backend')
    
    # Run the test
    asyncio.run(test_auth_endpoints())
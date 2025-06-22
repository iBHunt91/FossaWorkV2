#!/usr/bin/env python3
"""
Test database and environment loading directly
"""

import os
import sys
from pathlib import Path

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes/backend')
sys.path.insert(0, '.')

# Load environment variables manually
from dotenv import load_dotenv
load_dotenv()

print("=== Environment Test ===")
print(f"SECRET_KEY set: {'Yes' if os.getenv('SECRET_KEY') else 'No'}")
print(f"SECRET_KEY value: {os.getenv('SECRET_KEY', 'Not set')[:20]}...")
print(f"ENVIRONMENT: {os.getenv('ENVIRONMENT', 'Not set')}")
print(f"DATABASE_URL: {os.getenv('DATABASE_URL', 'Not set')}")

print("\n=== Database Test ===")
try:
    from app.database import SessionLocal
    from app.models.user_models import User
    
    db = SessionLocal()
    user_count = db.query(User).count()
    print(f"✓ Database connection successful. User count: {user_count}")
    
    # List users
    users = db.query(User).all()
    for user in users:
        print(f"  - User: {user.email} (ID: {user.id})")
    
    db.close()
    
except Exception as e:
    print(f"❌ Database error: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Security Module Test ===")
try:
    from app.auth.security import create_access_token
    print("✓ Security module imports successful")
    
    # Test token creation
    token = create_access_token(data={"sub": "test_user"})
    print(f"✓ Token creation successful: {token[:30]}...")
    
except Exception as e:
    print(f"❌ Security error: {e}")
    import traceback
    traceback.print_exc()
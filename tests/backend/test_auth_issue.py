#!/usr/bin/env python3
"""
Test authentication and user resolution issues
"""

import os
import sys
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')
sys.path.insert(0, '/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def test_auth_issue():
    print("=== Testing Authentication Issues ===")
    
    try:
        print("1. Testing database and user queries...")
        
        from app.database import get_db
        from app.models.user_models import User
        
        # Get database session
        db_gen = get_db()
        db = next(db_gen)
        
        # Query all users
        users = db.query(User).all()
        print(f"Found {len(users)} users in database:")
        for user in users:
            print(f"  - ID: {user.id}, Username: {user.username}")
        
        print("\n2. Testing JWT token decoding...")
        
        # Test JWT token decoding
        from jose import jwt
        from app.auth.security import SECRET_KEY
        
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmVhM2JkYjdlOGUzMDNlYWNhYmE0NDJiZDgyNDAwNCIsInVzZXJuYW1lIjoiYnJ1Y2UuaHVudEBvd2xzZXJ2aWNlcy5jb20iLCJleHAiOjE3NTA2NDI3MzR9.wYbVr3QpmJlpbkITMvs5G01oEGL0b7YaffugMru_1Zo"
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            print(f"JWT payload: {payload}")
            user_id = payload.get("sub")
            print(f"User ID from token: {user_id}")
            
            # Try to find this user
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                print(f"✓ Found user: {user.username}")
            else:
                print(f"❌ User not found in database with ID: {user_id}")
                
        except jwt.ExpiredSignatureError:
            print("❌ JWT token expired")
        except jwt.InvalidTokenError as e:
            print(f"❌ JWT token invalid: {e}")
        
        print("\n3. Testing auth dependencies...")
        
        # Test the auth dependency
        from app.auth.dependencies import get_current_user
        from fastapi import Request
        
        # This would require more complex setup for actual testing
        print("Auth dependency import successful")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Full traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    test_auth_issue()
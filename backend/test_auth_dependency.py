#!/usr/bin/env python3
"""
Test the authentication dependency directly
"""

import os
import sys
import asyncio
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes/backend')
sys.path.insert(0, '.')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

async def test_auth_dependency():
    print("=== Testing Authentication Dependency ===")
    
    try:
        from app.database import get_db
        from app.auth.dependencies import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials
        
        # Create a mock authorization credentials object
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmVhM2JkYjdlOGUzMDNlYWNhYmE0NDJiZDgyNDAwNCIsInVzZXJuYW1lIjoiYnJ1Y2UuaHVudEBvd2xzZXJ2aWNlcy5jb20iLCJleHAiOjE3NTA2NDI3MzR9.wYbVr3QpmJlpbkITMvs5G01oEGL0b7YaffugMru_1Zo"
        
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=token
        )
        
        # Get database session
        db_gen = get_db()
        db = next(db_gen)
        
        print("1. Testing get_current_user with valid token...")
        
        # Test the get_current_user function directly
        from app.auth.security import get_current_user as security_get_current_user
        
        user = await security_get_current_user(credentials, db)
        print(f"✓ get_current_user succeeded: {user.username}")
        
        print("2. Testing dependency wrapper...")
        
        # Test the dependency wrapper
        dependency_user = await get_current_user(credentials, db)
        print(f"✓ dependency get_current_user succeeded: {dependency_user.username}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Full traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_auth_dependency())
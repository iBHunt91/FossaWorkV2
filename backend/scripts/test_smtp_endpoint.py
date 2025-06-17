#!/usr/bin/env python3
"""Test SMTP settings endpoint to diagnose 500 error"""

import requests
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.auth.security import create_access_token
from app.database import SessionLocal
from app.models.user_models import User

def test_smtp_endpoint():
    """Test the SMTP settings endpoint"""
    
    # Get a test user from database
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("❌ No users found in database")
            return
        
        print(f"✅ Found user: {user.email} (ID: {user.id})")
        
        # Create a valid JWT token
        token_data = {"sub": user.id}
        token = create_access_token(token_data)
        print(f"✅ Created JWT token")
        
        # Test the endpoint
        # Test without auth first
        print("\n🔍 Testing without authentication...")
        try:
            response = requests.get(
                f"http://localhost:8000/api/settings/smtp/{user.id}"
            )
            print(f"Response status: {response.status_code}")
            print(f"Response: {response.text}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test with auth
        print("\n🔍 Testing with authentication...")
        headers = {"Authorization": f"Bearer {token}"}
        try:
            response = requests.get(
                f"http://localhost:8000/api/settings/smtp/{user.id}",
                headers=headers
            )
            print(f"Response status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                print("✅ SMTP endpoint working correctly")
            else:
                print(f"❌ Unexpected status code: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error with auth: {e}")
            import traceback
            traceback.print_exc()
            
        # Test OPTIONS for CORS
        print("\n🔍 Testing OPTIONS request (CORS preflight)...")
        try:
            response = requests.options(
                f"http://localhost:8000/api/settings/smtp/{user.id}",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "authorization"
                }
            )
            print(f"OPTIONS status: {response.status_code}")
            print("CORS headers:")
            for header, value in response.headers.items():
                if header.lower().startswith('access-control'):
                    print(f"  {header}: {value}")
        except Exception as e:
            print(f"❌ OPTIONS error: {e}")
            
    finally:
        db.close()

if __name__ == "__main__":
    print("🧪 Testing SMTP Settings Endpoint")
    print("=" * 50)
    test_smtp_endpoint()
#!/usr/bin/env python3
"""
Debug script to check credential property access
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.user_models import UserCredential

def test_credential_properties():
    """Test credential property access"""
    print("=== Testing Credential Property Access ===\n")
    
    db = SessionLocal()
    try:
        # Get Bruce's credentials
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            print("❌ No credentials found")
            return
        
        print("📋 Raw database values:")
        print(f"   encrypted_username: {user_credential.encrypted_username[:50]}...")
        print(f"   encrypted_password: {user_credential.encrypted_password[:50]}...")
        
        print("\n🔍 Testing property access:")
        
        # Test username property
        try:
            username_result = user_credential.username
            print(f"   username property returned: '{username_result}'")
            print(f"   Type: {type(username_result)}")
            print(f"   Length: {len(username_result)}")
            print(f"   Is empty: {not username_result}")
        except Exception as e:
            print(f"   ❌ Error accessing username property: {e}")
        
        # Test password property  
        try:
            password_result = user_credential.password
            print(f"\n   password property returned: {'*' * len(password_result) if password_result else '(empty)'}")
            print(f"   Type: {type(password_result)}")
            print(f"   Length: {len(password_result)}")
            print(f"   Is empty: {not password_result}")
        except Exception as e:
            print(f"   ❌ Error accessing password property: {e}")
        
        # Try direct decryption
        print("\n🔐 Testing direct decryption:")
        from app.services.encryption_service import decrypt_string
        
        try:
            direct_username = decrypt_string(user_credential.encrypted_username)
            print(f"   Direct decrypt username: '{direct_username}'")
        except Exception as e:
            print(f"   ❌ Direct decrypt failed: {e}")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_credential_properties()
#!/usr/bin/env python3
"""
Test direct decryption in scheduler context
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables FIRST before any imports
from dotenv import load_dotenv
load_dotenv()

# Now import everything else
from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.encryption_service import decrypt_string, get_encryption_service

async def test_scheduler_context():
    """Test decryption in scheduler-like context"""
    print("=== Testing Decryption in Scheduler Context ===\n")
    
    # Ensure encryption service is initialized
    encryption_service = get_encryption_service()
    print(f"✅ Encryption service initialized: {encryption_service is not None}")
    
    db = SessionLocal()
    try:
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == "7bea3bdb7e8e303eacaba442bd824004",
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            print("❌ No credentials found")
            return
        
        print(f"\n📋 Testing credential decryption:")
        print(f"   User ID: {user_credential.user_id}")
        
        # Method 1: Using properties
        print("\n1️⃣ Using credential properties:")
        username_prop = user_credential.username
        password_prop = user_credential.password
        print(f"   Username: {username_prop}")
        print(f"   Password: {'*' * len(password_prop) if password_prop else '(empty)'}")
        
        # Method 2: Direct decryption
        print("\n2️⃣ Using direct decryption:")
        username_direct = decrypt_string(user_credential.encrypted_username)
        password_direct = decrypt_string(user_credential.encrypted_password)
        print(f"   Username: {username_direct}")
        print(f"   Password: {'*' * len(password_direct) if password_direct else '(empty)'}")
        
        # Method 3: Creating dict like scheduler does
        print("\n3️⃣ Creating credentials dict:")
        credentials = {
            'username': user_credential.username,
            'password': user_credential.password
        }
        print(f"   Dict username: {credentials['username']}")
        print(f"   Dict password: {'*' * len(credentials['password']) if credentials['password'] else '(empty)'}")
        
        # Method 4: Direct decryption into dict (recommended fix)
        print("\n4️⃣ Direct decryption into dict (RECOMMENDED):")
        credentials_fixed = {
            'username': decrypt_string(user_credential.encrypted_username),
            'password': decrypt_string(user_credential.encrypted_password)
        }
        print(f"   Fixed username: {credentials_fixed['username']}")
        print(f"   Fixed password: {'*' * len(credentials_fixed['password']) if credentials_fixed['password'] else '(empty)'}")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_scheduler_context())
#!/usr/bin/env python3
"""
Test just the credential retrieval part of the scheduler
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

# Import what the scheduler imports
from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.encryption_service import decrypt_string
from app.services.logging_service import get_logger

logger = get_logger("test_scheduler")

def test_credential_retrieval():
    """Test credential retrieval as done in scheduler"""
    print("=== Testing Scheduler Credential Retrieval ===\n")
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Exact copy of scheduler code
    db = SessionLocal()
    try:
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            print("❌ No WorkFossa credentials found")
            return
        
        print(f"✅ Found credential record for user: {user_id}")
        print(f"   Encrypted username: {user_credential.encrypted_username[:50]}...")
        print(f"   Encrypted password: {user_credential.encrypted_password[:50]}...")
        
        # Decrypt credentials directly
        username = decrypt_string(user_credential.encrypted_username)
        password = decrypt_string(user_credential.encrypted_password)
        
        print(f"\n🔓 Decryption results:")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password) if password else '(empty)'}")
        
        logger.info(f"Decrypted username: {username}")
        logger.info(f"Password decrypted: {'Yes' if password else 'No'}")
        
        # Convert to expected format
        credentials = {
            'username': username,
            'password': password
        }
        
        print(f"\n📋 Final credentials dict:")
        print(f"   username: {credentials['username']}")
        print(f"   password: {'*' * len(credentials['password']) if credentials['password'] else '(empty)'}")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_credential_retrieval()
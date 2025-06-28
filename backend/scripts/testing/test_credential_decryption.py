#!/usr/bin/env python3
"""
Test script to diagnose credential decryption issues
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.encryption_service import decrypt_string, get_encryption_service

def test_credential_decryption():
    """Test decryption of stored credentials"""
    print("=== Testing Credential Decryption ===\n")
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    print(f"ENCRYPTION_PASSWORD set: {'ENCRYPTION_PASSWORD' in os.environ}")
    print(f"SECRET_KEY set: {'SECRET_KEY' in os.environ}")
    print(f"ENCRYPTION_SALT set: {'ENCRYPTION_SALT' in os.environ}")
    print()
    
    db = SessionLocal()
    try:
        # Get all WorkFossa credentials
        credentials = db.query(UserCredential).filter(
            UserCredential.service_name == 'workfossa'
        ).all()
        
        print(f"Found {len(credentials)} WorkFossa credentials in database\n")
        
        for cred in credentials:
            print(f"User ID: {cred.user_id}")
            print(f"Service: {cred.service_name}")
            print(f"Encrypted username: {cred.encrypted_username[:50]}...")
            print(f"Encrypted password: {cred.encrypted_password[:50]}...")
            
            # Try to decrypt using the properties
            try:
                username = cred.username
                password = cred.password
                print(f"Decrypted username: {username}")
                print(f"Password decrypted: {'Yes' if password and password != cred.encrypted_password else 'No'}")
            except Exception as e:
                print(f"Decryption error: {e}")
            
            # Check if data appears to be encrypted
            encryption_service = get_encryption_service()
            is_username_encrypted = encryption_service._is_likely_encrypted(cred.encrypted_username)
            is_password_encrypted = encryption_service._is_likely_encrypted(cred.encrypted_password)
            
            print(f"Username appears encrypted: {is_username_encrypted}")
            print(f"Password appears encrypted: {is_password_encrypted}")
            
            # Try direct decryption
            try:
                direct_username = decrypt_string(cred.encrypted_username)
                print(f"Direct decryption of username: {direct_username}")
            except Exception as e:
                print(f"Direct decryption error: {e}")
            
            print("-" * 50)
            print()
            
    finally:
        db.close()

if __name__ == "__main__":
    test_credential_decryption()
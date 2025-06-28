#!/usr/bin/env python3
"""
Test credential decryption to verify WorkFossa credentials are properly decrypted
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.encryption_service import EncryptionService

def test_credentials():
    """Test credential decryption"""
    db = SessionLocal()
    try:
        # Get all WorkFossa credentials
        creds = db.query(UserCredential).filter(
            UserCredential.service_name == 'workfossa'
        ).all()
        
        print(f"Found {len(creds)} WorkFossa credential(s)\n")
        
        for cred in creds:
            print(f"User ID: {cred.user_id}")
            print(f"Service: {cred.service_name}")
            
            # Show encrypted values
            print(f"Encrypted username: {cred.encrypted_username[:40]}..." if len(cred.encrypted_username) > 40 else f"Encrypted username: {cred.encrypted_username}")
            print(f"Has encrypted password: {bool(cred.encrypted_password)}")
            
            # Show decrypted values
            print(f"Decrypted username: {cred.username}")
            print(f"Has decrypted password: {bool(cred.password)}")
            
            # Test direct decryption
            if cred.encrypted_username:
                try:
                    direct_decrypted = EncryptionService.decrypt(cred.encrypted_username)
                    print(f"Direct decryption result: {direct_decrypted}")
                except Exception as e:
                    print(f"Direct decryption failed: {str(e)}")
            
            print("-" * 50)
            
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_credentials()
#!/usr/bin/env python3
"""
Fix WorkFossa credentials by properly storing the decrypted username
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.encryption_service import EncryptionService

def fix_credentials():
    """Fix the problematic credential for user 7bea3bdb7e8e303eacaba442bd824004"""
    db = SessionLocal()
    encryption_service = EncryptionService()
    
    try:
        # Get the problematic credential
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not cred:
            print("Credential not found")
            return
            
        print(f"Found credential for user: {cred.user_id}")
        print(f"Current encrypted username: {cred.encrypted_username[:40]}...")
        
        # The actual username should be bruce.hunt@owlservices.com
        correct_username = "bruce.hunt@owlservices.com"
        
        # Update with correct username
        print(f"\nUpdating username to: {correct_username}")
        
        # Set the username properly (this will encrypt it)
        cred.username = correct_username
        
        db.commit()
        print("✅ Credential updated successfully!")
        
        # Verify the fix
        db.refresh(cred)
        print(f"\nVerification:")
        print(f"Decrypted username now: {cred.username}")
        print(f"Encrypted username now: {cred.encrypted_username[:40]}...")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    response = input("This will update the WorkFossa credentials for user 7bea3bdb7e8e303eacaba442bd824004 to bruce.hunt@owlservices.com. Continue? (y/n): ")
    if response.lower() == 'y':
        fix_credentials()
    else:
        print("Cancelled")
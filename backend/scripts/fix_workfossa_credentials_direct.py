#!/usr/bin/env python3
"""
Fix WorkFossa credentials by directly updating the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app.models.user_models import UserCredential
from app.services.encryption_service import EncryptionService
from sqlalchemy import text

def fix_credentials():
    """Fix the problematic credential"""
    encryption_service = EncryptionService()
    
    # The actual username that should be used
    correct_username = "bruce.hunt@owlservices.com"
    
    # Encrypt the username properly
    encrypted_username = encryption_service.encrypt(correct_username)
    
    print(f"Correct username: {correct_username}")
    print(f"Encrypted username: {encrypted_username[:40]}...")
    
    # Update directly in database
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                UPDATE user_credentials 
                SET encrypted_username = :encrypted_username 
                WHERE user_id = :user_id 
                AND service_name = 'workfossa'
            """),
            {
                "encrypted_username": encrypted_username,
                "user_id": "7bea3bdb7e8e303eacaba442bd824004"
            }
        )
        conn.commit()
        
        print(f"✅ Updated {result.rowcount} row(s)")
    
    # Verify the fix
    db = SessionLocal()
    try:
        cred = db.query(UserCredential).filter(
            UserCredential.user_id == '7bea3bdb7e8e303eacaba442bd824004',
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if cred:
            print(f"\nVerification:")
            print(f"Decrypted username: {cred.username}")
        else:
            print("Could not find credential to verify")
    finally:
        db.close()

if __name__ == "__main__":
    fix_credentials()
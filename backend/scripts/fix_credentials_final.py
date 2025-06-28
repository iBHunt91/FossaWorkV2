#!/usr/bin/env python3
"""
Fix WorkFossa credentials - final attempt
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variables before importing
os.environ['SECRET_KEY'] = 'development-secret-key-12345678901234567890123456789012345678901234567890123456'

from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.encryption_service import encrypt_string, decrypt_string
from datetime import datetime

# The correct credentials
correct_username = "bruce.hunt@owlservices.com"
correct_password = "OWLSsleepNow13"  # From previous testing

user_id = "7bea3bdb7e8e303eacaba442bd824004"

print("🔧 Fixing WorkFossa Credentials")
print("=" * 50)

db = SessionLocal()
try:
    # Find existing credential
    user_credential = db.query(UserCredential).filter(
        UserCredential.user_id == user_id,
        UserCredential.service_name == 'workfossa'
    ).first()
    
    if user_credential:
        print(f"✅ Found existing credential")
        print(f"   Current encrypted username: {user_credential.encrypted_username[:50]}...")
        print(f"   Current encrypted password: {user_credential.encrypted_password[:50]}..." if user_credential.encrypted_password else "   Current encrypted password: EMPTY")
        
        # Test decryption of current values
        try:
            current_username = decrypt_string(user_credential.encrypted_username)
            print(f"   Current decrypted username: {current_username}")
        except:
            print("   ❌ Failed to decrypt current username")
        
        try:
            current_password = decrypt_string(user_credential.encrypted_password)
            print(f"   Current decrypted password: {'*' * len(current_password) if current_password else 'EMPTY'}")
        except:
            print("   ❌ Failed to decrypt current password")
        
        # Update with correct values
        print(f"\n🔄 Updating credentials...")
        print(f"   New username: {correct_username}")
        print(f"   New password: {'*' * len(correct_password)}")
        
        # Encrypt the new values
        encrypted_username = encrypt_string(correct_username)
        encrypted_password = encrypt_string(correct_password)
        
        print(f"   Encrypted username: {encrypted_username[:50]}...")
        print(f"   Encrypted password: {encrypted_password[:50]}...")
        
        # Update the database
        user_credential.encrypted_username = encrypted_username
        user_credential.encrypted_password = encrypted_password
        user_credential.updated_at = datetime.utcnow()
        
        db.commit()
        print("✅ Database updated")
        
        # Verify the update
        db.refresh(user_credential)
        
        verified_username = decrypt_string(user_credential.encrypted_username)
        verified_password = decrypt_string(user_credential.encrypted_password)
        
        print(f"\n✅ Verification:")
        print(f"   Username matches: {verified_username == correct_username}")
        print(f"   Password matches: {verified_password == correct_password}")
        print(f"   Decrypted username: {verified_username}")
        print(f"   Decrypted password: {'*' * len(verified_password)}")
        
    else:
        print("❌ No WorkFossa credentials found - creating new")
        
        # Create new credential
        encrypted_username = encrypt_string(correct_username)
        encrypted_password = encrypt_string(correct_password)
        
        new_credential = UserCredential(
            user_id=user_id,
            service_name='workfossa',
            encrypted_username=encrypted_username,
            encrypted_password=encrypted_password
        )
        
        db.add(new_credential)
        db.commit()
        
        print("✅ Created new WorkFossa credentials")
        
except Exception as e:
    print(f"💥 Error: {str(e)}")
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()

print("\n✅ Complete!")
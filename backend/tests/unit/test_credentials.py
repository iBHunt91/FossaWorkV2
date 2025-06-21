#!/usr/bin/env python3
"""
Test credential decryption
"""

import sys
from pathlib import Path
import base64

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models import UserCredential

def test_credentials():
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    print("Testing credential decryption...")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        creds = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa",
            UserCredential.is_active == True
        ).first()
        
        if not creds:
            print("❌ No credentials found in database")
            return
        
        print(f"✅ Found credentials in database")
        print(f"   Created: {creds.created_at}")
        print(f"   Updated: {creds.updated_at}")
        
        # Test the encrypted values
        print(f"\n📦 Encrypted values:")
        print(f"   Username (encrypted): {creds.encrypted_username[:20]}...")
        print(f"   Password (encrypted): {creds.encrypted_password[:20]}...")
        
        # Test simple decrypt
        def simple_decrypt(encrypted_password: str) -> str:
            """Simple decryption - check if it's base64 or plain text"""
            try:
                # Try base64 decode first
                return base64.b64decode(encrypted_password.encode()).decode()
            except Exception as e:
                print(f"   ℹ️  Not base64 encoded, using as plain text")
                # If that fails, it might be plain text
                return encrypted_password
        
        username = simple_decrypt(creds.encrypted_username)
        password = simple_decrypt(creds.encrypted_password)
        
        print(f"\n🔓 Decrypted values:")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password) if password else '(empty)'}")
        
        # Check if they look valid
        print(f"\n✅ Validation:")
        print(f"   Username looks like email: {'@' in username}")
        print(f"   Password length: {len(password)}")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_credentials()
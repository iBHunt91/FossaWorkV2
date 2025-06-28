#!/usr/bin/env python3
"""
Test script to verify credential retrieval for scheduler
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

def test_credential_retrieval(user_id: str):
    """Test retrieving credentials for a user"""
    
    print(f"\n=== Testing Credential Retrieval for User: {user_id} ===\n")
    
    # Check environment variable
    master_key = os.environ.get('FOSSAWORK_MASTER_KEY')
    print(f"1. FOSSAWORK_MASTER_KEY present: {'Yes' if master_key else 'No'}")
    if master_key:
        print(f"   Key length: {len(master_key)} characters")
    
    # Try credential manager
    try:
        from app.services.credential_manager import credential_manager
        
        print("\n2. Testing credential manager retrieval...")
        credentials = credential_manager.retrieve_credentials(user_id)
        
        if credentials:
            print(f"   ✓ Credentials found!")
            print(f"   Username: {credentials.username}")
            print(f"   Password: {'*' * 8 if credentials.password else 'None'}")
            print(f"   Valid: {credentials.is_valid}")
        else:
            print(f"   ✗ No credentials found")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Try database directly
    try:
        from app.database import SessionLocal
        from app.models.user_models import UserCredential
        
        print("\n3. Checking database directly...")
        db = SessionLocal()
        try:
            db_creds = db.query(UserCredential).filter(
                UserCredential.user_id == user_id,
                UserCredential.service_name == "workfossa"
            ).first()
            
            if db_creds:
                print(f"   ✓ Database record found!")
                print(f"   Active: {db_creds.is_active}")
                print(f"   Verified: {db_creds.is_verified}")
                print(f"   Last verified: {db_creds.last_verified}")
                print(f"   Has encrypted username: {'Yes' if db_creds.encrypted_username else 'No'}")
                print(f"   Has encrypted password: {'Yes' if db_creds.encrypted_password else 'No'}")
                
                # Try to decrypt
                try:
                    username = db_creds.get_username()
                    password = db_creds.get_password()
                    print(f"   Decryption successful: Username={username}, Password={'*' * 8 if password else 'None'}")
                except Exception as e:
                    print(f"   Decryption failed: {e}")
            else:
                print(f"   ✗ No database record found")
                
        finally:
            db.close()
            
    except Exception as e:
        print(f"   ✗ Database error: {e}")
    
    # Check credential files
    try:
        print("\n4. Checking credential files...")
        cred_dir = Path("data/credentials")
        if cred_dir.exists():
            print(f"   Credential directory exists: {cred_dir}")
            cred_files = list(cred_dir.glob(f"{user_id}*"))
            if cred_files:
                print(f"   Found {len(cred_files)} credential file(s):")
                for f in cred_files:
                    print(f"     - {f.name}")
            else:
                print(f"   No credential files found for user")
        else:
            print(f"   Credential directory does not exist")
            
    except Exception as e:
        print(f"   ✗ File check error: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
    else:
        print("Usage: python test_credential_retrieval.py <user_id>")
        print("\nTrying to find users in database...")
        
        try:
            from app.database import SessionLocal
            from app.models.user_models import User
            
            db = SessionLocal()
            users = db.query(User).all()
            db.close()
            
            if users:
                print(f"\nFound {len(users)} user(s):")
                for user in users:
                    print(f"  - {user.id} ({user.email})")
                print(f"\nUsing first user: {users[0].id}")
                user_id = users[0].id
            else:
                print("No users found in database!")
                sys.exit(1)
                
        except Exception as e:
            print(f"Error listing users: {e}")
            sys.exit(1)
    
    test_credential_retrieval(user_id)
#!/usr/bin/env python3
"""
Access and display available WorkFossa credentials for testing
"""
import sys
import os
import json
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

def get_workfossa_credentials():
    """Get WorkFossa credentials from various sources"""
    
    print("🔑 Searching for WorkFossa Credentials")
    print("="*60)
    
    credentials_found = []
    
    # Method 1: Check credential files
    print("\n1️⃣ Checking credential files...")
    cred_dir = Path(str(Path(__file__).resolve().parent.parent.parent / "backend" / "data") + "/credentials")
    
    if cred_dir.exists():
        for cred_file in cred_dir.glob("*.cred"):
            print(f"   Found: {cred_file.name}")
            try:
                with open(cred_file, 'r') as f:
                    data = json.load(f)
                    user_id = data.get('user_id', 'unknown')
                    
                    # Try to decrypt using credential manager
                    from app.services.credential_manager import CredentialManager
                    cm = CredentialManager()
                    creds = cm.retrieve_credentials(user_id)
                    
                    if creds and creds.username and creds.password:
                        credentials_found.append({
                            'user_id': user_id,
                            'username': creds.username,
                            'password': creds.password,
                            'source': f'credential_file_{cred_file.name}'
                        })
                        print(f"   ✅ Successfully retrieved credentials for user: {user_id}")
                        print(f"      Username: {creds.username}")
                        print(f"      Password: {'*' * len(creds.password)}")
            except Exception as e:
                print(f"   ❌ Failed to read {cred_file.name}: {e}")
    
    # Method 2: Check database
    print("\n2️⃣ Checking database...")
    try:
        from app.database import SessionLocal
        from app.models.user_models import UserCredential
        
        db = SessionLocal()
        db_creds = db.query(UserCredential).filter(
            UserCredential.service_name == "workfossa"
        ).all()
        
        for cred in db_creds:
            try:
                credentials_found.append({
                    'user_id': cred.user_id,
                    'username': cred.username,  # Will be decrypted by property
                    'password': cred.password,  # Will be decrypted by property
                    'source': 'database'
                })
                print(f"   ✅ Found credentials in database for user: {cred.user_id}")
                print(f"      Username: {cred.username}")
                print(f"      Password: {'*' * len(cred.password)}")
            except Exception as e:
                print(f"   ❌ Failed to decrypt database credentials: {e}")
        
        db.close()
    except Exception as e:
        print(f"   ❌ Failed to check database: {e}")
    
    # Method 3: Check environment variables
    print("\n3️⃣ Checking environment variables...")
    env_username = os.environ.get('WORKFOSSA_USERNAME')
    env_password = os.environ.get('WORKFOSSA_PASSWORD')
    
    if env_username and env_password:
        credentials_found.append({
            'user_id': 'env_user',
            'username': env_username,
            'password': env_password,
            'source': 'environment'
        })
        print(f"   ✅ Found credentials in environment")
        print(f"      Username: {env_username}")
        print(f"      Password: {'*' * len(env_password)}")
    else:
        print("   ❌ No credentials in environment variables")
    
    # Summary
    print(f"\n📊 Summary: Found {len(credentials_found)} credential set(s)")
    
    if credentials_found:
        print("\n✅ Available credentials for testing:")
        for i, cred in enumerate(credentials_found, 1):
            print(f"\n   {i}. User ID: {cred['user_id']}")
            print(f"      Source: {cred['source']}")
            print(f"      Username: {cred['username']}")
            print(f"      Can be used for testing: Yes")
        
        # Return the first valid credential set
        return credentials_found[0]
    else:
        print("\n❌ No valid credentials found")
        print("\n💡 To add credentials:")
        print("   1. Use the frontend Settings page to save WorkFossa credentials")
        print("   2. Or set environment variables:")
        print("      export WORKFOSSA_USERNAME='your_username'")
        print("      export WORKFOSSA_PASSWORD='your_password'")
        return None

if __name__ == "__main__":
    credentials = get_workfossa_credentials()
    
    if credentials:
        print("\n🎯 Selected credentials for testing:")
        print(f"   User ID: {credentials['user_id']}")
        print(f"   Username: {credentials['username']}")
        print(f"   Ready for automated testing: ✅")
    else:
        print("\n❌ Cannot proceed with automated testing without credentials")
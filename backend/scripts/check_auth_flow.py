#!/usr/bin/env python3
"""
Check the authentication flow
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.database import SessionLocal
from app.models import User

def check_auth():
    """Check authentication setup"""
    print("🔐 Checking Authentication Setup")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # Check if there are any users
        users = db.query(User).all()
        print(f"\n📊 Total users in database: {len(users)}")
        
        if users:
            print("\n👤 Users found:")
            for user in users:
                print(f"   - {user.username} (ID: {user.id})")
                print(f"     WorkFossa linked: {'Yes' if user.workfossa_user_id else 'No'}")
        else:
            print("\n⚠️  No users found in database")
            print("💡 This is expected - users are created when they log in with WorkFossa credentials")
        
        print("\n📝 Authentication Flow:")
        print("1. User enters WorkFossa credentials in frontend")
        print("2. Frontend sends credentials to /api/v1/auth/login")
        print("3. Backend validates with WorkFossa")
        print("4. Backend creates/updates user record")
        print("5. Backend returns JWT token")
        print("6. Frontend stores token and includes in all requests")
        
        print("\n🔍 Current Issue:")
        print("The 500 error suggests the user might not be logged in properly")
        print("or the token isn't being sent with requests")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_auth()
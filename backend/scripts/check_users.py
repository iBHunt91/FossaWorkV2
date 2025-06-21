#!/usr/bin/env python3
"""
Check users in database
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.user_models import User

def check_users():
    print("🔍 Checking Users in Database")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\n📋 Found {len(users)} users:")
        
        for user in users:
            print(f"\n👤 User:")
            print(f"   - ID: {user.id}")
            print(f"   - Username: {user.username}")
            print(f"   - Email: {user.email}")
            print(f"   - Is Active: {user.is_active}")
            print(f"   - Created: {user.created_at}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_users()
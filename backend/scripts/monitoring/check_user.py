#!/usr/bin/env python3
"""
Check if a user exists in the database
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal
from app.models.user_models import User

def check_user(user_id: str):
    """Check if user exists"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if user:
            print(f"✅ User found!")
            print(f"   ID: {user.id}")
            print(f"   Username: {user.username}")
            print(f"   Email: {user.email}")
            print(f"   Created: {user.created_at}")
        else:
            print(f"❌ User not found with ID: {user_id}")
            
            # Show all users
            print("\nAll users in database:")
            all_users = db.query(User).all()
            if all_users:
                for u in all_users:
                    print(f"   - {u.id}: {u.username} ({u.email})")
            else:
                print("   No users found in database")
                
    finally:
        db.close()

if __name__ == "__main__":
    user_id = sys.argv[1] if len(sys.argv) > 1 else "7bea3bdb7e8e303eacaba442bd824004"
    check_user(user_id)
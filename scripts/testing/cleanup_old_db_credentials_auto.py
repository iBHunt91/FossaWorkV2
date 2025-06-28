#!/usr/bin/env python3
"""Clean up old database credential entries that are no longer needed - auto mode"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import SessionLocal
from app.models.user_models import UserCredential

def cleanup_old_credentials():
    """Remove old database credential entries since we now use credential_manager"""
    
    db = SessionLocal()
    try:
        # Find all database credential entries
        old_credentials = db.query(UserCredential).filter(
            UserCredential.service_name == 'workfossa'
        ).all()
        
        if not old_credentials:
            print("No old database credentials found.")
            return
        
        print(f"Found {len(old_credentials)} old database credential entries:")
        
        for cred in old_credentials:
            print(f"\nUser ID: {cred.user_id}")
            print(f"  Encrypted username starts with: {cred.encrypted_username[:50] if cred.encrypted_username else 'None'}...")
            print(f"  Created: {cred.created_at}")
            print(f"  Updated: {cred.updated_at}")
        
        print("\n🧹 Cleaning up old database entries...")
        
        for cred in old_credentials:
            db.delete(cred)
        db.commit()
        
        print(f"\n✅ Removed {len(old_credentials)} old database credential entries.")
        print("The application now uses the secure file-based credential manager.")
            
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_old_credentials()
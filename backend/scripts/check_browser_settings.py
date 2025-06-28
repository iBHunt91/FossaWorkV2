#!/usr/bin/env python3
"""
Check browser settings for a user
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user_models import UserPreference

def check_browser_settings(user_id: str):
    """Check browser settings for a user"""
    
    db = SessionLocal()
    try:
        # Check all preferences for user
        prefs = db.query(UserPreference).filter(
            UserPreference.user_id == user_id
        ).all()
        
        print(f"\nAll preferences for user {user_id[:8]}...:")
        for pref in prefs:
            print(f"  Category: {pref.category}")
            print(f"  Settings: {pref.settings}")
            print()
        
        # Check browser settings specifically
        browser_pref = db.query(UserPreference).filter(
            UserPreference.user_id == user_id,
            UserPreference.category == "browser_settings"
        ).first()
        
        if browser_pref:
            print(f"Browser settings found:")
            print(f"  show_browser_during_sync: {browser_pref.settings.get('show_browser_during_sync', 'NOT SET')}")
            print(f"  headless: {browser_pref.settings.get('headless', 'NOT SET')}")
            print(f"  All settings: {browser_pref.settings}")
        else:
            print("No browser settings found for this user")
            
    finally:
        db.close()

if __name__ == "__main__":
    # Check for Bruce's user
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    check_browser_settings(user_id)
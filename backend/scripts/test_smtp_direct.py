#!/usr/bin/env python3
"""Direct test of SMTP settings logic"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.user_models import User, generate_user_id
from app.routes.settings import get_settings_path, load_settings, SMTPSettings

def test_smtp_logic():
    """Test SMTP settings logic directly"""
    
    # Get a test user from database
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("❌ No users found in database")
            return
        
        print(f"✅ Found user: {user.email} (ID: {user.id})")
        
        # Test settings path creation
        print(f"\n🔍 Testing settings path for user {user.id}...")
        try:
            settings_path = get_settings_path(user.id, "smtp")
            print(f"✅ Settings path: {settings_path}")
            print(f"   Path exists: {settings_path.exists()}")
            print(f"   Parent exists: {settings_path.parent.exists()}")
            
            # Try to load settings
            print(f"\n🔍 Loading SMTP settings...")
            default_settings = SMTPSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=587,
                username="",
                password="",
                use_tls=True,
                use_ssl=False,
                from_email="",
                from_name="FossaWork Automation"
            ).dict()
            
            settings = load_settings(user.id, "smtp", default_settings)
            print(f"✅ Loaded settings: {settings}")
            
        except Exception as e:
            print(f"❌ Error with settings: {e}")
            import traceback
            traceback.print_exc()
            
    finally:
        db.close()

if __name__ == "__main__":
    print("🧪 Testing SMTP Settings Logic")
    print("=" * 50)
    test_smtp_logic()
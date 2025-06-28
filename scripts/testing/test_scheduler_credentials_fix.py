#!/usr/bin/env python3
"""
Test script to verify the scheduler credentials fix
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.logging_service import get_logger

logger = get_logger("test_scheduler_fix")

async def test_credentials_fix():
    """Test that credentials are properly passed and used in login"""
    print("=== Testing Scheduler Credentials Fix ===\n")
    
    # Get a test user's credentials
    db = SessionLocal()
    try:
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == "7bea3bdb7e8e303eacaba442bd824004",  # Bruce's user ID
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            print("❌ No WorkFossa credentials found for test user")
            return
        
        print(f"✅ Found credentials for user: {user_credential.user_id}")
        print(f"   Username (decrypted): {user_credential.username}")
        print(f"   Password decrypted: {'Yes' if user_credential.password else 'No'}")
        
        # Create credentials dict as scheduler does
        credentials = {
            'username': user_credential.username,
            'password': user_credential.password
        }
        
        print(f"\n📋 Created credentials dict:")
        print(f"   username: {credentials['username']}")
        print(f"   password: {'*' * len(credentials['password'])}")
        
    finally:
        db.close()
    
    # Test the automation service
    print("\n🔧 Testing WorkFossaAutomationService...")
    
    automation = WorkFossaAutomationService(headless=True)
    session_id = f"test_{datetime.now().timestamp()}"
    
    try:
        # Create session
        print("\n1️⃣ Creating session...")
        await automation.create_session(
            session_id=session_id,
            user_id="7bea3bdb7e8e303eacaba442bd824004",
            credentials=credentials
        )
        print("✅ Session created successfully")
        
        # Test login
        print("\n2️⃣ Testing login...")
        login_success = await automation.login_to_workfossa(session_id)
        
        if login_success:
            print("✅ Login successful! Credentials are working properly.")
        else:
            print("❌ Login failed - check credentials or WorkFossa site")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
        logger.exception("Test failed")
    finally:
        # Cleanup
        print("\n🧹 Cleaning up...")
        try:
            await automation.cleanup_session(session_id)
            print("✅ Session cleaned up")
        except:
            pass

async def main():
    """Run the test"""
    await test_credentials_fix()

if __name__ == "__main__":
    asyncio.run(main())
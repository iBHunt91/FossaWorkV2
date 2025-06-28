#!/usr/bin/env python3
"""
Simple test script to check what's failing in the testing endpoint
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal, get_db
from backend.app.models.user_models import User
from backend.app.routes.testing import send_test_notification

async def test_notification_call():
    """Test the problematic notification call"""
    db = SessionLocal()
    try:
        # Get a user
        user = db.query(User).filter(User.username == "Bruce Hunt").first()
        if not user:
            print("User not found")
            return
        
        print(f"Testing with user: {user.username}")
        
        # Test the problematic call
        test_data = {"title": "Test", "message": "Test from dashboard"}
        
        # This is the problematic line from the /all endpoint
        try:
            result = await send_test_notification(test_data, user)
            print(f"Success: {result}")
        except Exception as e:
            print(f"Error calling send_test_notification: {e}")
            print(f"Error type: {type(e).__name__}")
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_notification_call())
#!/usr/bin/env python3
"""
Test the scraping schedules route directly to identify the error
"""

import os
import sys
import asyncio
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')
sys.path.insert(0, '/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

async def test_scraping_route():
    print("=== Testing Scraping Schedules Route ===")
    
    try:
        print("1. Setting up test environment...")
        
        # Import dependencies
        from app.database import get_db
        from app.models.user_models import User
        from sqlalchemy.orm import Session
        
        # Import the route function directly
        from app.routes.scraping_schedules import get_schedules
        
        print("✓ Imports successful")
        
        print("2. Creating test database session...")
        db_gen = get_db()
        db = next(db_gen)
        print("✓ Database session created")
        
        print("3. Getting test user...")
        # Get a user from the database
        user = db.query(User).first()
        if not user:
            print("❌ No users found in database")
            return
        
        print(f"✓ Found user: {user.username}")
        
        print("4. Calling get_schedules function...")
        result = await get_schedules(db=db, current_user=user)
        print(f"✓ get_schedules() succeeded: {result}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Full traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scraping_route())
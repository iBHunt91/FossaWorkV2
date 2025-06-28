#!/usr/bin/env python3
"""
Debug the scraping schedules endpoint specifically
"""

import os
import sys
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')
sys.path.insert(0, '/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

print("=== Scraping Schedules Debug ===")

try:
    print("1. Testing database models...")
    from app.models.scraping_models import ScrapingSchedule
    from app.database import SessionLocal
    
    db = SessionLocal()
    schedules_count = db.query(ScrapingSchedule).count()
    print(f"✓ ScrapingSchedule model working. Count: {schedules_count}")
    
    schedules = db.query(ScrapingSchedule).all()
    for schedule in schedules:
        print(f"  - Schedule: user_id={schedule.user_id}, type={schedule.schedule_type}, enabled={schedule.enabled}")
    
    db.close()
    
    print("\n2. Testing scheduler service import...")
    try:
        from app.services.scheduler_service import scheduler_service
        print(f"✓ Scheduler service imported successfully")
        print(f"  - Service type: {type(scheduler_service)}")
        print(f"  - Has is_initialized: {hasattr(scheduler_service, 'is_initialized')}")
        if hasattr(scheduler_service, 'is_initialized'):
            print(f"  - Is initialized: {scheduler_service.is_initialized}")
    except ImportError as e:
        print(f"⚠ Scheduler service import failed: {e}")
        scheduler_service = None
    
    print("\n3. Testing route function directly...")
    from app.routes.scraping_schedules import get_schedules
    from app.auth.security import get_current_user
    from app.models.user_models import User
    
    # Get a test user
    db = SessionLocal()
    test_user = db.query(User).first()
    print(f"✓ Test user: {test_user.email}")
    
    # Test the route function directly (simulating FastAPI dependency injection)
    class MockCredentials:
        def __init__(self, token):
            self.credentials = token
    
    # We can't easily test the async route without the full FastAPI context
    # So let's test the core logic manually
    print("✓ Route import successful - detailed testing requires FastAPI context")
    
    db.close()

except Exception as e:
    print(f"❌ Error found: {e}")
    print("\nFull traceback:")
    traceback.print_exc()

print("\n=== Debug Complete ===")
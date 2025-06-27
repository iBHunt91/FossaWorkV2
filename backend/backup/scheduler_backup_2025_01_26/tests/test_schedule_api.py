#!/usr/bin/env python3
"""
Test schedule API endpoints directly
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.user_models import User
from app.models.scraping_models import ScrapingSchedule

async def test_schedule_api():
    print("🔧 Testing Schedule API")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get Bruce's user
        user = db.query(User).filter(User.email == "bruce.hunt@owlservices.com").first()
        if not user:
            print("❌ User not found")
            return
            
        print(f"✅ Found user: {user.username} (ID: {user.id})")
        
        # Check existing schedule
        existing_schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user.id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if existing_schedule:
            print(f"\n📋 Existing schedule found:")
            print(f"   - Interval: {existing_schedule.interval_hours} hours")
            print(f"   - Active hours: {existing_schedule.active_hours}")
            print(f"   - Enabled: {existing_schedule.enabled}")
            print(f"   - Last run: {existing_schedule.last_run}")
            print(f"   - Created: {existing_schedule.created_at}")
        else:
            print("\n❌ No existing schedule found")
            
        # Test the route functions directly
        print("\n🔍 Testing route handlers...")
        
        # Import route functions
        from app.routes.scraping_schedules import get_schedules, create_schedule
        from app.routes.scraping_schedules import CreateScheduleRequest
        
        # Create a mock current user dependency
        class MockUser:
            def __init__(self, user_obj):
                self.id = user_obj.id
                self.username = user_obj.username
                self.email = user_obj.email
        
        mock_user = MockUser(user)
        
        # Test get_schedules
        print("\n📋 Testing get_schedules...")
        try:
            # Call the function directly
            schedules = await get_schedules(db=db, current_user=mock_user)
            print(f"✅ Got {len(schedules)} schedules")
            for s in schedules:
                print(f"   - {s['job_id']}: {s['type']} (enabled: {s['enabled']})")
        except Exception as e:
            print(f"❌ Error getting schedules: {e}")
            
        # Test create_schedule
        print("\n📋 Testing create_schedule...")
        try:
            request = CreateScheduleRequest(
                schedule_type="work_orders",
                interval_hours=1.0,
                active_hours={"start": 6, "end": 22},
                enabled=True
            )
            
            result = await create_schedule(request=request, db=db, current_user=mock_user)
            print(f"✅ Schedule creation result:")
            print(f"   - Success: {result.get('success')}")
            print(f"   - Message: {result.get('message')}")
            print(f"   - Job ID: {result.get('job_id')}")
            
            if result.get('schedule'):
                print(f"   - Schedule details:")
                for k, v in result['schedule'].items():
                    print(f"     {k}: {v}")
                    
        except Exception as e:
            print(f"❌ Error creating schedule: {e}")
            import traceback
            traceback.print_exc()
            
    finally:
        db.close()
        
    print("\n✅ Test complete")

if __name__ == "__main__":
    asyncio.run(test_schedule_api())
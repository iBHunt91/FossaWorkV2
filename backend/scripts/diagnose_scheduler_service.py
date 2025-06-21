#!/usr/bin/env python3
"""
Diagnose scheduler service issue
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def main():
    print("🔍 Diagnosing Scheduler Service")
    print("=" * 50)
    
    # Check which scheduler service is being used
    print("\n1. Checking scheduler service import...")
    try:
        from app.services.scheduler_service import scheduler_service
        print("✅ Full scheduler_service imported successfully")
        print(f"   Type: {type(scheduler_service)}")
        print("   This means APScheduler is installed!")
    except ImportError as e:
        print(f"❌ Failed to import scheduler_service: {e}")
        print("   Checking for simple scheduler fallback...")
        try:
            from app.services.simple_scheduler_service import simple_scheduler_service as scheduler_service
            print("✅ Using simple_scheduler_service as fallback")
            print(f"   Type: {type(scheduler_service)}")
            print("   ⚠️  This is a stub implementation - no actual scheduling!")
        except ImportError as e2:
            print(f"❌ Failed to import simple scheduler: {e2}")
            return
    
    # Check scheduler attributes
    print("\n2. Checking scheduler attributes...")
    print(f"   is_initialized: {getattr(scheduler_service, 'is_initialized', 'Not found')}")
    print(f"   scheduler: {getattr(scheduler_service, 'scheduler', 'Not found')}")
    
    # Try to get all schedules
    print("\n3. Testing get_all_schedules()...")
    try:
        schedules = await scheduler_service.get_all_schedules()
        print(f"✅ get_all_schedules() returned: {schedules}")
    except Exception as e:
        print(f"❌ Error calling get_all_schedules(): {e}")
    
    # Check database for schedules
    print("\n4. Checking database directly...")
    try:
        from app.database import get_db, SessionLocal
        from app.models.scraping_models import ScrapingSchedule
        
        db = SessionLocal()
        db_schedules = db.query(ScrapingSchedule).all()
        print(f"✅ Found {len(db_schedules)} schedules in database:")
        for s in db_schedules:
            print(f"   - User: {s.user_id}, Type: {s.schedule_type}, Enabled: {s.enabled}")
        db.close()
    except Exception as e:
        print(f"❌ Error checking database: {e}")
    
    # Check if APScheduler is installed
    print("\n5. Checking APScheduler installation...")
    try:
        import apscheduler
        print(f"✅ APScheduler is installed: version {apscheduler.__version__}")
    except ImportError:
        print("❌ APScheduler is NOT installed")
        print("   Run: pip install apscheduler>=3.10.0")
    
    print("\n" + "=" * 50)
    print("Summary:")
    if 'simple_scheduler_service' in str(type(scheduler_service)):
        print("⚠️  Using simple scheduler service (stub implementation)")
        print("   - Schedules are stored in database only")
        print("   - No actual background scheduling occurs")
        print("   - Install APScheduler for full functionality")
    else:
        print("✅ Using full scheduler service with APScheduler")

if __name__ == "__main__":
    asyncio.run(main())
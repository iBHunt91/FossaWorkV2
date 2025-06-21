#!/usr/bin/env python3
"""
Test scheduler initialization directly
"""

import sys
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def test_scheduler():
    print("🔧 Testing Scheduler Initialization Directly")
    print("=" * 50)
    
    # Test database URL
    database_url = "sqlite:///./fossawork_v2.db"
    print(f"Database URL: {database_url}")
    
    try:
        from app.services.scheduler_service import scheduler_service
        print("\n✅ Imported scheduler_service successfully")
        print(f"   Current state: initialized={scheduler_service.is_initialized}")
        
        # Try to initialize
        print("\n🚀 Attempting to initialize scheduler...")
        await scheduler_service.initialize(database_url)
        
        print("✅ Scheduler initialized successfully!")
        print(f"   Is initialized: {scheduler_service.is_initialized}")
        print(f"   Scheduler running: {scheduler_service.scheduler.running if scheduler_service.scheduler else 'No scheduler'}")
        
        # Check for jobs
        if scheduler_service.scheduler:
            jobs = scheduler_service.scheduler.get_jobs()
            print(f"\n📋 Active jobs: {len(jobs)}")
            for job in jobs:
                print(f"   - {job.id}: {job.name}")
                print(f"     Next run: {job.next_run_time}")
        
        # Shutdown
        await scheduler_service.shutdown()
        print("\n✅ Scheduler shutdown cleanly")
        
    except Exception as e:
        print(f"\n❌ Error during initialization: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scheduler())
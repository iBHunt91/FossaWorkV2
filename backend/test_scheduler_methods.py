#!/usr/bin/env python3
"""
Test specific scheduler service methods used in scraping schedules route
"""

import os
import sys
import asyncio
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes/backend')
sys.path.insert(0, '.')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

async def test_scheduler_methods():
    print("=== Scheduler Service Methods Test ===")
    
    try:
        print("1. Importing scheduler service...")
        from app.services.scheduler_service import scheduler_service
        print(f"✓ Scheduler service imported: {type(scheduler_service)}")
        print(f"  - Has is_initialized: {hasattr(scheduler_service, 'is_initialized')}")
        print(f"  - Is initialized: {getattr(scheduler_service, 'is_initialized', 'N/A')}")
        
        print("\n2. Testing scheduler methods...")
        
        # Test get_all_schedules method
        if hasattr(scheduler_service, 'get_all_schedules'):
            print("Testing get_all_schedules()...")
            try:
                all_schedules = await scheduler_service.get_all_schedules()
                print(f"✓ get_all_schedules() succeeded: {len(all_schedules)} schedules")
                for schedule in all_schedules:
                    print(f"  - Schedule: {schedule}")
            except Exception as e:
                print(f"❌ get_all_schedules() failed: {e}")
                traceback.print_exc()
        else:
            print("❌ get_all_schedules method not found")
        
        # Test get_schedule_status method
        if hasattr(scheduler_service, 'get_schedule_status'):
            print("\nTesting get_schedule_status()...")
            try:
                test_job_id = "work_order_scrape_7bea3bdb7e8e303eacaba442bd824004"
                status = await scheduler_service.get_schedule_status(test_job_id)
                print(f"✓ get_schedule_status() succeeded: {status}")
            except Exception as e:
                print(f"❌ get_schedule_status() failed: {e}")
                traceback.print_exc()
        else:
            print("❌ get_schedule_status method not found")
        
        # Test is_initialized attribute and methods
        print(f"\n3. Scheduler state check...")
        print(f"  - Type: {type(scheduler_service)}")
        print(f"  - Dir: {[attr for attr in dir(scheduler_service) if not attr.startswith('_')]}")
        
        # Try to initialize if not initialized
        if hasattr(scheduler_service, 'initialize') and not getattr(scheduler_service, 'is_initialized', False):
            print("  - Attempting to initialize scheduler...")
            try:
                database_url = os.getenv("DATABASE_URL", "sqlite:///./fossawork.db")
                await scheduler_service.initialize(database_url)
                print(f"  - Initialization result: {getattr(scheduler_service, 'is_initialized', 'N/A')}")
            except Exception as e:
                print(f"  - Initialization failed: {e}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scheduler_methods())
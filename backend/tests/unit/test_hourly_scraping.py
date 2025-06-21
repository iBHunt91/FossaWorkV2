#!/usr/bin/env python3
"""
Test script for hourly work order scraping functionality
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.scheduler_service import scheduler_service
from app.database import SessionLocal, create_tables
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory

async def test_hourly_scraping():
    """Test the hourly scraping functionality"""
    
    print("🔧 Testing Hourly Work Order Scraping")
    print("=" * 50)
    
    # Create tables if needed
    print("\n📊 Creating database tables...")
    create_tables()
    
    # Initialize scheduler
    print("\n🚀 Initializing scheduler service...")
    database_url = "sqlite:///./fossawork_v2.db"
    await scheduler_service.initialize(database_url)
    
    # Test user ID (you should replace with actual user ID)
    test_user_id = "test_user_123"
    
    # Add a test schedule
    print(f"\n📅 Adding hourly scraping schedule for user: {test_user_id}")
    job_id = await scheduler_service.add_work_order_scraping_schedule(
        user_id=test_user_id,
        interval_hours=0.02,  # 1.2 minutes for testing (instead of 1 hour)
        active_hours=None,  # No restrictions for testing
        enabled=True
    )
    print(f"✅ Schedule created with job ID: {job_id}")
    
    # Get schedule status
    print("\n📋 Schedule Status:")
    status = await scheduler_service.get_schedule_status(job_id)
    if status:
        print(f"  - Job ID: {status['job_id']}")
        print(f"  - User ID: {status['user_id']}")
        print(f"  - Type: {status['type']}")
        print(f"  - Enabled: {status['enabled']}")
        print(f"  - Next Run: {status['next_run']}")
    
    # Wait for a few runs
    print("\n⏰ Waiting for scheduled scraping to run...")
    print("   (Schedule set to run every 1.2 minutes)")
    
    try:
        # Wait for 3 minutes to see at least 2 runs
        for i in range(18):  # 18 * 10 seconds = 3 minutes
            await asyncio.sleep(10)
            print(f"   Waiting... {(i+1)*10}/180 seconds")
            
            # Check for new history entries
            db = SessionLocal()
            try:
                history_count = db.query(ScrapingHistory).filter(
                    ScrapingHistory.user_id == test_user_id
                ).count()
                if history_count > 0:
                    print(f"\n   📊 Found {history_count} scraping runs in history!")
            finally:
                db.close()
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    
    # Show scraping history
    print("\n📜 Scraping History:")
    history = await scheduler_service.get_scraping_history(test_user_id, limit=10)
    
    if history:
        for idx, run in enumerate(history, 1):
            print(f"\n  Run #{idx}:")
            print(f"    - Started: {run['started_at']}")
            print(f"    - Completed: {run['completed_at']}")
            print(f"    - Success: {run['success']}")
            print(f"    - Items: {run['items_processed']}")
            if run['error_message']:
                print(f"    - Error: {run['error_message']}")
    else:
        print("  No scraping history found yet.")
    
    # Clean up
    print("\n🧹 Cleaning up...")
    await scheduler_service.remove_schedule(job_id)
    await scheduler_service.shutdown()
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    print("Starting hourly scraping test...")
    print("Press Ctrl+C to stop early\n")
    
    asyncio.run(test_hourly_scraping())
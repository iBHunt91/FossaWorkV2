#!/usr/bin/env python3
"""
Trigger an immediate work order scrape
This bypasses the scheduler and runs the scraping job directly
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.services.scheduler_service import execute_work_order_scraping
from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule
from app.services.logging_service import get_logger

logger = get_logger("manual.trigger")

async def trigger_scrape_for_user(user_id: str):
    """Trigger scraping for a specific user"""
    print(f"\n🚀 Triggering immediate scrape for user: {user_id}")
    print(f"   Started at: {datetime.now()}")
    print("-" * 60)
    
    try:
        # Execute the scraping job
        await execute_work_order_scraping(user_id)
        print(f"\n✅ Scraping completed for user: {user_id}")
    except Exception as e:
        print(f"\n❌ Error during scraping: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Main function"""
    print("\n" + "="*80)
    print("🔧 MANUAL WORK ORDER SCRAPING TRIGGER")
    print("="*80)
    print(f"Time: {datetime.now()}")
    print("="*80)
    
    # Get all enabled schedules
    db = SessionLocal()
    try:
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True,
            ScrapingSchedule.schedule_type == "work_orders"
        ).all()
        
        if not schedules:
            print("\n❌ No enabled work order scraping schedules found!")
            return
        
        print(f"\n📊 Found {len(schedules)} enabled schedules:")
        for i, schedule in enumerate(schedules):
            print(f"  {i+1}. User: {schedule.user_id}")
            print(f"     Last run: {schedule.last_run or 'Never'}")
            print(f"     Next run: {schedule.next_run or 'Not scheduled'}")
        
        # If only one schedule, use it automatically
        if len(schedules) == 1:
            user_id = schedules[0].user_id
            print(f"\n🔄 Auto-selecting the only user: {user_id}")
        else:
            # Ask which user to scrape
            print("\n📝 Which user would you like to scrape?")
            choice = input(f"Enter number (1-{len(schedules)}) or 'all' for all users: ")
            
            if choice.lower() == 'all':
                print("\n🔄 Scraping all users...")
                for schedule in schedules:
                    await trigger_scrape_for_user(schedule.user_id)
                return
            else:
                try:
                    idx = int(choice) - 1
                    if 0 <= idx < len(schedules):
                        user_id = schedules[idx].user_id
                    else:
                        print("❌ Invalid choice")
                        return
                except ValueError:
                    print("❌ Invalid input")
                    return
        
        # Trigger scraping for selected user
        await trigger_scrape_for_user(user_id)
        
    finally:
        db.close()
    
    print("\n✅ Manual trigger complete")
    print("\n💡 TIP: Check the logs for detailed execution information:")
    print("   - Frontend logs: /logs/frontend/")
    print("   - Backend logs: /logs/backend/")
    print("   - Automation logs: /logs/automation/")

if __name__ == "__main__":
    asyncio.run(main())
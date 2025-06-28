#!/usr/bin/env python3
"""
Test complete scraping workflow from user perspective
"""
import sys
import os
import time
import asyncio
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, desc
from sqlalchemy.orm import sessionmaker
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.database import DATABASE_URL

# Create database connection
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def test_complete_workflow():
    """Test the complete scraping workflow"""
    print("🧪 Testing Complete Scraping Workflow")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Step 1: Check current schedules
        print("\n📊 Step 1: Current Schedules")
        schedules = db.query(ScrapingSchedule).filter_by(enabled=True).all()
        for schedule in schedules:
            print(f"   Schedule {schedule.id}: User {schedule.user_id[:8]}...")
            print(f"      Enabled: {schedule.enabled}")
            print(f"      Interval: {schedule.interval_hours} hours")
            print(f"      Last Run: {schedule.last_run}")
            print(f"      Next Run: {schedule.next_run}")
        
        # Step 2: Trigger manual run for schedule 1
        print("\n🚀 Step 2: Triggering Manual Run for Schedule 1")
        schedule = db.query(ScrapingSchedule).filter_by(id=1).first()
        if schedule:
            old_next_run = schedule.next_run
            schedule.next_run = datetime.now(timezone.utc)
            db.commit()
            print(f"   ✅ Manual run triggered!")
            print(f"   Old next_run: {old_next_run}")
            print(f"   New next_run: {schedule.next_run}")
        
        # Step 3: Wait for daemon to pick it up
        print("\n⏳ Step 3: Waiting for daemon to process (60 seconds)...")
        for i in range(12):  # Check every 5 seconds for 60 seconds
            time.sleep(5)
            
            # Check for new history entries
            latest_history = db.query(ScrapingHistory).filter_by(
                user_id=schedule.user_id,
                schedule_type="work_orders"
            ).order_by(desc(ScrapingHistory.started_at)).first()
            
            if latest_history and latest_history.started_at > datetime.now() - timedelta(minutes=1):
                print(f"\n   🎉 Scraping detected after {(i+1)*5} seconds!")
                print(f"   History ID: {latest_history.id}")
                print(f"   Started: {latest_history.started_at}")
                print(f"   Success: {latest_history.success}")
                if latest_history.completed_at:
                    print(f"   Duration: {latest_history.duration_seconds}s")
                    print(f"   Items: {latest_history.items_processed}")
                if latest_history.error_message:
                    print(f"   Error: {latest_history.error_message}")
                break
            else:
                print(f"   Checking... ({(i+1)*5}s)", end="\r", flush=True)
        
        # Step 4: Check updated schedule
        print("\n📅 Step 4: Checking Updated Schedule")
        db.refresh(schedule)
        print(f"   Schedule {schedule.id} after run:")
        print(f"      Last Run: {schedule.last_run}")
        print(f"      Next Run: {schedule.next_run}")
        print(f"      Next automatic run should be ~1 hour from last run")
        
        # Step 5: Verify work orders were scraped
        print("\n📦 Step 5: Checking Work Orders")
        work_order_count = db.execute(
            text("SELECT COUNT(*) FROM work_orders WHERE user_id = :user_id"),
            {"user_id": schedule.user_id}
        ).scalar()
        print(f"   Total work orders for user: {work_order_count}")
        
        # Show recent work orders
        recent_orders = db.execute(
            text("""
                SELECT id, store_name, scheduled_date, created_at 
                FROM work_orders 
                WHERE user_id = :user_id 
                ORDER BY created_at DESC 
                LIMIT 5
            """),
            {"user_id": schedule.user_id}
        ).fetchall()
        
        if recent_orders:
            print("\n   Recent work orders:")
            for order in recent_orders:
                print(f"      {order.id}: {order.store_name} - Scheduled: {order.scheduled_date}")
        
        print("\n✅ Workflow test complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_complete_workflow())
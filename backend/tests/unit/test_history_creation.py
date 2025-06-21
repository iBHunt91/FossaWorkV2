#!/usr/bin/env python3
"""
Test that history records are created properly
"""

import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

# Set environment
os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.scheduler_service import execute_work_order_scraping

async def test_history():
    """Test history creation"""
    print("\n" + "="*80)
    print("🧪 TESTING HISTORY RECORD CREATION")
    print("="*80)
    
    db = SessionLocal()
    try:
        # Get first user
        schedule = db.query(ScrapingSchedule).first()
        if not schedule:
            print("❌ No schedules found")
            return
        
        user_id = schedule.user_id
        print(f"Testing with user: {user_id}")
        
        # Count history before
        history_before = db.query(ScrapingHistory).filter(
            ScrapingHistory.user_id == user_id
        ).count()
        print(f"History records before: {history_before}")
        
        # Run scraping
        print("\n🚀 Running scraping...")
        await execute_work_order_scraping(user_id)
        
        # Wait a bit
        await asyncio.sleep(3)
        
        # Count history after
        history_after = db.query(ScrapingHistory).filter(
            ScrapingHistory.user_id == user_id
        ).count()
        print(f"\n📊 History records after: {history_after}")
        
        # Get latest history
        latest = db.query(ScrapingHistory).filter(
            ScrapingHistory.user_id == user_id
        ).order_by(ScrapingHistory.started_at.desc()).first()
        
        if latest:
            print("\n✅ LATEST HISTORY RECORD:")
            print(f"  Started: {latest.started_at}")
            print(f"  Completed: {latest.completed_at}")
            print(f"  Success: {latest.success}")
            print(f"  Items: {latest.items_processed}")
            
            if history_after > history_before:
                print("\n✅ SUCCESS! History record was created!")
            else:
                print("\n⚠️  History count didn't increase but record exists")
        else:
            print("\n❌ No history record found!")
            
    finally:
        db.close()
    
    print("\n" + "="*80)
    print("Test complete!")

if __name__ == "__main__":
    asyncio.run(test_history())
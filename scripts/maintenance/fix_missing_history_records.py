#!/usr/bin/env python3
"""
Fix the missing ScrapingHistory records issue.
This script:
1. Updates the execute_work_order_scraping function to create history records
2. Optionally creates a history record for the last manual run
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.core_models import WorkOrder


def create_missing_history_record(user_id: str):
    """Create a history record based on the last work order scrape."""
    db = SessionLocal()
    try:
        # Get the most recent work orders
        recent_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).order_by(WorkOrder.updated_at.desc()).limit(10).all()
        
        if not recent_orders:
            print(f"No work orders found for user {user_id}")
            return False
        
        # Estimate when the last scrape happened
        last_update = recent_orders[0].updated_at
        
        # Check if we already have a history record around this time
        existing = db.query(ScrapingHistory).filter(
            ScrapingHistory.user_id == user_id,
            ScrapingHistory.started_at >= last_update - timedelta(minutes=5),
            ScrapingHistory.started_at <= last_update + timedelta(minutes=5)
        ).first()
        
        if existing:
            print(f"History record already exists for this time period")
            return False
        
        # Count total work orders
        total_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).count()
        
        # Create history record
        history = ScrapingHistory(
            user_id=user_id,
            schedule_type="work_orders",
            started_at=last_update - timedelta(seconds=30),  # Assume 30 second scrape
            completed_at=last_update,
            success=True,
            items_processed=total_orders,
            items_added=0,  # Can't determine this retroactively
            items_updated=0,  # Can't determine this retroactively
            items_failed=0,
            duration_seconds=30.0,
            run_metadata={"source": "manual_fix", "reason": "missing_history"}
        )
        
        db.add(history)
        db.commit()
        
        print(f"✅ Created history record:")
        print(f"   - User: {user_id}")
        print(f"   - Started: {history.started_at}")
        print(f"   - Items: {total_orders}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating history record: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def show_fix_code():
    """Show the code that needs to be added to execute_work_order_scraping."""
    print("\n" + "=" * 80)
    print("📝 CODE FIX FOR scheduler_service.py")
    print("=" * 80)
    
    print("""
The execute_work_order_scraping function needs to create ScrapingHistory records.

Add this code after the work order saving section (around line 260):

```python
    # Create history record
    history_created = False
    try:
        db = SessionLocal()
        try:
            history = ScrapingHistory(
                user_id=user_id,
                schedule_type="work_orders",
                started_at=start_time,
                completed_at=datetime.utcnow(),
                success=success,
                items_processed=items_processed,
                items_added=saved_count,
                items_updated=updated_count,
                items_failed=0,
                error_message=error_message,
                duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
                run_metadata={
                    "trigger": "scheduler",
                    "total_found": len(work_order_data_list)
                }
            )
            db.add(history)
            db.commit()
            history_created = True
            logger.info(f"Created history record for {items_processed} items")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to create history record: {e}")
```

This should be added right before the final log statement in the function.
""")


def main():
    """Main function."""
    print("🔧 Fix Missing ScrapingHistory Records")
    print("=" * 80)
    
    # Show the code fix
    show_fix_code()
    
    # Check current state
    db = SessionLocal()
    try:
        # Get all users with schedules
        schedules = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).all()
        
        print(f"\n📊 Current State:")
        print(f"Active schedules: {len(schedules)}")
        
        for schedule in schedules:
            history_count = db.query(ScrapingHistory).filter(
                ScrapingHistory.user_id == schedule.user_id
            ).count()
            
            work_order_count = db.query(WorkOrder).filter(
                WorkOrder.user_id == schedule.user_id
            ).count()
            
            print(f"\nUser: {schedule.user_id}")
            print(f"  - Work orders: {work_order_count}")
            print(f"  - History records: {history_count}")
            
            if work_order_count > 0 and history_count == 0:
                print("  ⚠️  Has work orders but no history!")
                
    finally:
        db.close()
    
    # Offer to create missing records
    print("\n" + "-" * 80)
    response = input("\nCreate missing history records for users with work orders? (y/N): ")
    
    if response.lower() == 'y':
        db = SessionLocal()
        try:
            schedules = db.query(ScrapingSchedule).all()
            
            for schedule in schedules:
                # Check if user has work orders but no history
                work_order_count = db.query(WorkOrder).filter(
                    WorkOrder.user_id == schedule.user_id
                ).count()
                
                history_count = db.query(ScrapingHistory).filter(
                    ScrapingHistory.user_id == schedule.user_id
                ).count()
                
                if work_order_count > 0 and history_count == 0:
                    print(f"\nProcessing user: {schedule.user_id}")
                    create_missing_history_record(schedule.user_id)
                    
        finally:
            db.close()
    
    print("\n✅ Complete!")
    print("\nNOTE: To permanently fix this issue, the code in scheduler_service.py")
    print("needs to be updated to create history records on every run.")


if __name__ == "__main__":
    main()
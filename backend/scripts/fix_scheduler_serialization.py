#!/usr/bin/env python3
"""
Fix scheduler serialization issue by creating standalone job functions
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

print("🔧 Fixing Scheduler Serialization Issue")
print("=" * 50)

scheduler_file = backend_dir / "app" / "services" / "scheduler_service.py"

# Read the current file
with open(scheduler_file, 'r') as f:
    lines = f.readlines()

# Find the imports section and add necessary imports
import_index = 0
for i, line in enumerate(lines):
    if line.startswith("from ..models.scraping_models"):
        import_index = i + 1
        break

# Check if standalone function already exists
if not any("async def execute_work_order_scraping(" in line for line in lines):
    print("✅ Adding standalone job function...")
    
    # Add the standalone function before the class
    standalone_function = '''
# Standalone job functions to avoid serialization issues
async def execute_work_order_scraping(user_id: str):
    """Execute work order scraping task - standalone function for scheduler"""
    from datetime import datetime
    from ..database import SessionLocal
    from ..services.workfossa_scraper import WorkFossaScraper
    from ..services.logging_service import get_logger
    
    logger = get_logger("scheduler.jobs")
    start_time = datetime.utcnow()
    success = False
    error_message = None
    items_processed = 0
    
    try:
        logger.info(f"Starting scheduled work order scraping for user {user_id}")
        
        # Get database session
        db = SessionLocal()
        try:
            # Initialize scraper
            scraper = WorkFossaScraper(db, user_id)
            
            # Perform scraping
            result = await scraper.scrape_work_orders()
            
            if result.get("success"):
                items_processed = len(result.get("work_orders", []))
                success = True
                
                # Check for new work orders and send notifications
                new_orders = result.get("new_work_orders", [])
                if new_orders:
                    logger.info(f"Found {len(new_orders)} new work orders for user {user_id}")
            else:
                error_message = result.get("error", "Unknown error")
                logger.error(f"Work order scraping failed: {error_message}")
                
        finally:
            db.close()
            
    except Exception as e:
        error_message = str(e)
        logger.exception(f"Error during scheduled work order scraping: {e}")
    
    # Log execution stats
    duration = (datetime.utcnow() - start_time).total_seconds()
    logger.info(f"Work order scraping completed - Success: {success}, "
                f"Items: {items_processed}, Duration: {duration:.1f}s")
    
    # Update last run info in database
    db = SessionLocal()
    try:
        from ..models.scraping_models import ScrapingSchedule
        schedule = db.query(ScrapingSchedule).filter(
            ScrapingSchedule.user_id == user_id,
            ScrapingSchedule.schedule_type == "work_orders"
        ).first()
        
        if schedule:
            schedule.last_run_at = datetime.utcnow()
            schedule.last_run_success = success
            schedule.last_run_message = error_message or f"Processed {items_processed} work orders"
            db.commit()
    finally:
        db.close()

'''
    
    # Find the class definition
    class_index = 0
    for i, line in enumerate(lines):
        if line.startswith("class SchedulerService"):
            class_index = i
            break
    
    # Insert the standalone function before the class
    lines.insert(class_index, standalone_function)
    print("✅ Standalone function added")
else:
    print("✅ Standalone function already exists")

# Now update the reference in add_work_order_scraping_schedule
modified = False
for i, line in enumerate(lines):
    if "func=self._execute_work_order_scraping," in line:
        lines[i] = line.replace("func=self._execute_work_order_scraping,", "func=execute_work_order_scraping,")
        modified = True
        print("✅ Updated function reference in add_work_order_scraping_schedule")
        break

# Write the file back
with open(scheduler_file, 'w') as f:
    f.writelines(lines)

print("\n✅ Scheduler serialization issue fixed!")
print("\n📌 The scheduler can now properly serialize jobs")
print("   Next: Restart the backend server to apply changes")
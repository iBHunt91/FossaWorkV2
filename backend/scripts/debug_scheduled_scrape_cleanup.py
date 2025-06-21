#!/usr/bin/env python3
"""
Debug script to trace the scheduled scrape execution and see if cleanup is happening
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import WorkOrder, User, ScrapingHistory
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = "sqlite:///./fossawork_v2.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_scraping_history():
    """Check recent scraping history"""
    db = SessionLocal()
    try:
        logger.info("\n" + "="*60)
        logger.info("Recent Scraping History (Last 10)")
        logger.info("="*60)
        
        # Get recent scraping history
        histories = db.query(ScrapingHistory).order_by(
            ScrapingHistory.started_at.desc()
        ).limit(10).all()
        
        if not histories:
            logger.info("No scraping history found")
            return
        
        for history in histories:
            logger.info(f"\nScrape ID: {history.id}")
            logger.info(f"  User: {history.user_id}")
            logger.info(f"  Started: {history.started_at}")
            logger.info(f"  Completed: {history.completed_at}")
            logger.info(f"  Success: {history.success}")
            logger.info(f"  Items processed: {history.items_processed}")
            if history.error_message:
                logger.info(f"  Error: {history.error_message}")
            
            # Check work order count at that time
            user_work_orders = db.query(WorkOrder).filter(
                WorkOrder.user_id == history.user_id
            ).count()
            logger.info(f"  Current work orders for user: {user_work_orders}")
            
    finally:
        db.close()

def analyze_work_order_changes():
    """Analyze work order changes over time"""
    db = SessionLocal()
    try:
        logger.info("\n" + "="*60)
        logger.info("Work Order Analysis")
        logger.info("="*60)
        
        users = db.query(User).all()
        for user in users:
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.user_id == user.id
            ).order_by(WorkOrder.updated_at.desc()).all()
            
            if not work_orders:
                continue
                
            logger.info(f"\nUser: {user.username} (ID: {user.id})")
            logger.info(f"Total work orders: {len(work_orders)}")
            
            # Group by last update date
            today = datetime.now().date()
            yesterday = today - timedelta(days=1)
            week_ago = today - timedelta(days=7)
            
            updated_today = 0
            updated_yesterday = 0
            updated_this_week = 0
            never_updated = 0
            
            for wo in work_orders:
                if wo.updated_at:
                    update_date = wo.updated_at.date()
                    if update_date == today:
                        updated_today += 1
                    elif update_date == yesterday:
                        updated_yesterday += 1
                    elif update_date > week_ago:
                        updated_this_week += 1
                else:
                    never_updated += 1
            
            logger.info(f"  Updated today: {updated_today}")
            logger.info(f"  Updated yesterday: {updated_yesterday}")
            logger.info(f"  Updated this week: {updated_this_week}")
            logger.info(f"  Never updated: {never_updated}")
            
            # Show oldest work orders (candidates for removal)
            oldest_work_orders = sorted(work_orders, key=lambda x: x.created_at)[:5]
            logger.info(f"\n  Oldest work orders (potential cleanup candidates):")
            for wo in oldest_work_orders:
                age = (datetime.now() - wo.created_at).days
                logger.info(f"    - {wo.external_id}: {wo.site_name} (Age: {age} days, Status: {wo.status})")
            
    finally:
        db.close()

def check_scheduler_logs():
    """Check for scheduler log files to see cleanup messages"""
    logger.info("\n" + "="*60)
    logger.info("Checking for Scheduler Logs")
    logger.info("="*60)
    
    log_dirs = [
        "/Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/backend/logs",
        "/Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/logs",
        "logs",
        "../logs"
    ]
    
    for log_dir in log_dirs:
        if os.path.exists(log_dir):
            logger.info(f"\nChecking {log_dir}...")
            for root, dirs, files in os.walk(log_dir):
                for file in files:
                    if 'schedule' in file.lower() or 'scrape' in file.lower():
                        file_path = os.path.join(root, file)
                        logger.info(f"  Found: {file_path}")
                        
                        # Check file size and modification time
                        try:
                            stat = os.stat(file_path)
                            mod_time = datetime.fromtimestamp(stat.st_mtime)
                            logger.info(f"    Size: {stat.st_size} bytes")
                            logger.info(f"    Modified: {mod_time}")
                            
                            # If recent and small enough, check for cleanup messages
                            if stat.st_size < 1000000 and (datetime.now() - mod_time).days < 1:
                                with open(file_path, 'r') as f:
                                    content = f.read()
                                    if 'cleanup' in content.lower() or 'remove' in content.lower() or 'delete' in content.lower():
                                        logger.info(f"    Contains cleanup-related messages!")
                        except Exception as e:
                            logger.error(f"    Error reading file: {e}")

def simulate_scheduled_scrape_locally():
    """Simulate what the scheduled scrape should do"""
    db = SessionLocal()
    try:
        logger.info("\n" + "="*60)
        logger.info("Simulating Scheduled Scrape Cleanup Logic")
        logger.info("="*60)
        
        users = db.query(User).all()
        for user in users:
            logger.info(f"\nUser: {user.username} (ID: {user.id})")
            
            # Get all work orders
            existing_work_orders = db.query(WorkOrder).filter(
                WorkOrder.user_id == user.id
            ).all()
            
            logger.info(f"Current work orders: {len(existing_work_orders)}")
            
            # Simulate that we scraped and found 80% of work orders (20% completed)
            current_external_ids = {wo.external_id for wo in existing_work_orders}
            
            # Remove 20% to simulate completed work orders
            num_to_remove = max(1, len(current_external_ids) // 5)
            external_ids_list = list(current_external_ids)
            for i in range(min(num_to_remove, len(external_ids_list))):
                current_external_ids.remove(external_ids_list[i])
            
            logger.info(f"Simulated scrape found: {len(current_external_ids)} work orders")
            logger.info(f"Missing from scrape: {len(existing_work_orders) - len(current_external_ids)} work orders")
            
            # Show what would be removed
            for existing_wo in existing_work_orders:
                if existing_wo.external_id not in current_external_ids:
                    logger.info(f"  Would remove: {existing_wo.external_id} - {existing_wo.site_name}")
            
    finally:
        db.close()

def main():
    """Main debug function"""
    logger.info("Work Order Cleanup Debug Script")
    logger.info("="*60)
    
    # Check scraping history
    check_scraping_history()
    
    # Analyze work order changes
    analyze_work_order_changes()
    
    # Check for log files
    check_scheduler_logs()
    
    # Simulate cleanup
    simulate_scheduled_scrape_locally()
    
    logger.info("\n" + "="*60)
    logger.info("Debug Summary")
    logger.info("="*60)
    logger.info("""
The cleanup code exists in two places:
1. scheduler_service.py lines 206-236 (in execute_work_order_scraping function)
2. work_orders.py lines 688-708 (in perform_scrape function)

Both should remove work orders that are no longer in the WorkFossa scrape results.

If cleanup is not happening, possible reasons:
1. The scraper is finding ALL work orders (including completed ones)
2. The cleanup code is not being reached due to an error
3. The database commit is failing
4. The work order external_ids don't match between scrapes

To verify cleanup is working:
1. Check if scraping history shows successful scrapes
2. Manually mark a work order as completed in WorkFossa
3. Wait for next scheduled scrape
4. Check if that work order is removed from the database
""")

if __name__ == "__main__":
    main()
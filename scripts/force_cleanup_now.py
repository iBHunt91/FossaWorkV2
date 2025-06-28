#!/usr/bin/env python3
"""Force cleanup of completed work orders immediately"""

import sys
from pathlib import Path
from datetime import datetime
import logging

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.core_models import WorkOrder
from app.models.user_models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def force_cleanup():
    """Force cleanup of completed work orders based on the fix"""
    db = SessionLocal()
    
    try:
        logger.info("Force Work Order Cleanup")
        logger.info("=" * 60)
        
        # Get all users
        users = db.query(User).all()
        logger.info(f"\nFound {len(users)} users")
        
        total_removed = 0
        
        for user in users:
            logger.info(f"\nProcessing user: {user.email}")
            
            # Get all work orders for this user
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.user_id == user.id
            ).all()
            
            logger.info(f"  Current work orders: {len(work_orders)}")
            
            # Since we know the issue is that completed work orders aren't being fetched,
            # we'll identify likely completed work orders based on their age and status
            
            # Work orders that are likely completed:
            # 1. Scheduled date is in the past
            # 2. Status is still "pending" (never updated)
            # 3. No recent updates
            
            work_orders_to_check = []
            for wo in work_orders:
                # Check if scheduled date is in the past
                if wo.scheduled_date and wo.scheduled_date < datetime.now():
                    # If it's more than 1 day past scheduled date and still pending
                    days_past = (datetime.now() - wo.scheduled_date).days
                    if days_past > 0 and wo.status == "pending":
                        work_orders_to_check.append(wo)
                        logger.info(f"  - {wo.external_id} ({wo.site_name}) scheduled {days_past} days ago")
            
            if work_orders_to_check:
                logger.info(f"\n  Found {len(work_orders_to_check)} work orders that are likely completed")
                response = input("\n  Remove these work orders? (yes/no): ")
                
                if response.lower() == "yes":
                    for wo in work_orders_to_check:
                        logger.info(f"  Removing: {wo.external_id} - {wo.site_name}")
                        db.delete(wo)
                        total_removed += 1
                    
                    db.commit()
                    logger.info(f"  Removed {len(work_orders_to_check)} work orders")
                else:
                    logger.info("  Skipping removal")
            else:
                logger.info("  No work orders to remove")
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"Total work orders removed: {total_removed}")
        logger.info("\nNOTE: The proper fix has been applied to the scraper.")
        logger.info("Future scrapes will automatically remove completed work orders.")
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    force_cleanup()
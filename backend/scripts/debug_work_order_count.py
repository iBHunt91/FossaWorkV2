#!/usr/bin/env python3
"""Debug work order count discrepancy"""

import sys
from pathlib import Path
from datetime import datetime
import logging

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import WorkOrder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_work_order_count():
    """Debug why we have 51 work orders instead of 49"""
    db = SessionLocal()
    
    try:
        logger.info("Work Order Count Debug")
        logger.info("=" * 60)
        
        # Get all work orders for the user
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).order_by(WorkOrder.external_id).all()
        
        logger.info(f"\nTotal work orders in database: {len(work_orders)}")
        logger.info("Expected from WorkFossa: 49")
        logger.info(f"Difference: {len(work_orders) - 49}")
        
        # Look for potential duplicates
        external_ids = {}
        duplicates = []
        
        for wo in work_orders:
            if wo.external_id in external_ids:
                duplicates.append((wo.external_id, wo.site_name))
                logger.warning(f"\nDUPLICATE FOUND: {wo.external_id}")
                logger.warning(f"  First: {external_ids[wo.external_id]}")
                logger.warning(f"  Second: {wo.site_name}")
            else:
                external_ids[wo.external_id] = wo.site_name
        
        if duplicates:
            logger.info(f"\nFound {len(duplicates)} duplicate work orders!")
        else:
            logger.info("\nNo duplicates found.")
        
        # Show all work order IDs and names
        logger.info("\nAll work orders in database:")
        logger.info("-" * 60)
        
        for i, wo in enumerate(work_orders, 1):
            scheduled_str = wo.scheduled_date.strftime("%m/%d") if wo.scheduled_date else "No date"
            logger.info(f"{i:3d}. {wo.external_id:<8} - {wo.site_name:<40} - {scheduled_str}")
        
        # Check for work orders that might be completed (past scheduled date)
        logger.info("\n" + "=" * 60)
        logger.info("Work orders that might be completed (scheduled in past):")
        logger.info("-" * 60)
        
        past_count = 0
        for wo in work_orders:
            if wo.scheduled_date and wo.scheduled_date < datetime.now():
                days_past = (datetime.now() - wo.scheduled_date).days
                if days_past > 0:
                    past_count += 1
                    logger.info(f"  {wo.external_id} - {wo.site_name} - {days_past} days past scheduled")
        
        logger.info(f"\nTotal past scheduled date: {past_count}")
        
        # Look for any work orders not visible on WorkFossa page
        logger.info("\n" + "=" * 60)
        logger.info("Next steps to identify the extra 2 work orders:")
        logger.info("1. Compare the list above with what you see on WorkFossa")
        logger.info("2. The 2 work orders in our database but not on WorkFossa are the completed ones")
        logger.info("3. Once identified, the cleanup will remove them on the next scrape")
        
    except Exception as e:
        logger.error(f"Error during debug: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug_work_order_count()
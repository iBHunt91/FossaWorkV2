#!/usr/bin/env python3
"""
Test script to verify work order cleanup functionality
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import WorkOrder, User
from app.database import Base
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = "sqlite:///./fossawork_v2.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_current_work_orders():
    """Check current work orders in the database"""
    db = SessionLocal()
    try:
        # Get all users
        users = db.query(User).all()
        logger.info(f"\n{'='*60}")
        logger.info(f"Current Database State")
        logger.info(f"{'='*60}")
        logger.info(f"Total users: {len(users)}")
        
        total_work_orders = 0
        for user in users:
            work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user.id).all()
            if work_orders:
                logger.info(f"\nUser: {user.username} (ID: {user.id})")
                logger.info(f"  Total work orders: {len(work_orders)}")
                
                # Group by status
                status_counts = {}
                for wo in work_orders:
                    status = wo.status or 'unknown'
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                for status, count in status_counts.items():
                    logger.info(f"    {status}: {count}")
                
                # Show sample work orders
                logger.info(f"\n  Sample work orders (first 5):")
                for wo in work_orders[:5]:
                    logger.info(f"    - {wo.external_id}: {wo.site_name} (Status: {wo.status}, Updated: {wo.updated_at})")
                
                total_work_orders += len(work_orders)
        
        logger.info(f"\nTotal work orders across all users: {total_work_orders}")
        return total_work_orders
    finally:
        db.close()

def simulate_cleanup(user_id: str, current_external_ids: set):
    """Simulate the cleanup process to see what would be removed"""
    db = SessionLocal()
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"Simulating Cleanup for User: {user_id}")
        logger.info(f"{'='*60}")
        
        # Get all existing work orders for this user
        existing_work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).all()
        
        logger.info(f"Database has {len(existing_work_orders)} work orders for user")
        logger.info(f"Current scrape found {len(current_external_ids)} work orders")
        
        # Find work orders that would be removed
        work_orders_to_remove = []
        for existing_wo in existing_work_orders:
            if existing_wo.external_id not in current_external_ids:
                work_orders_to_remove.append(existing_wo)
                logger.info(f"  Would remove: {existing_wo.external_id} - {existing_wo.site_name} (Status: {existing_wo.status})")
        
        logger.info(f"\nWould remove {len(work_orders_to_remove)} completed/missing work orders")
        
        # Show which ones would remain
        remaining_count = len(existing_work_orders) - len(work_orders_to_remove)
        logger.info(f"Would keep {remaining_count} work orders that are still active")
        
        return work_orders_to_remove
    finally:
        db.close()

def test_actual_cleanup(user_id: str, current_external_ids: set, dry_run: bool = True):
    """Test the actual cleanup logic from the code"""
    db = SessionLocal()
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing Actual Cleanup Logic (dry_run={dry_run})")
        logger.info(f"{'='*60}")
        
        # This is the exact logic from scheduler_service.py lines 206-236
        # Get all existing work orders for this user
        existing_work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).all()
        logger.info(f"Database has {len(existing_work_orders)} work orders for user")
        
        # Find work orders that are no longer present (completed/removed)
        work_orders_to_remove = []
        for existing_wo in existing_work_orders:
            if existing_wo.external_id not in current_external_ids:
                work_orders_to_remove.append(existing_wo)
                logger.info(f"Work order {existing_wo.external_id} ({existing_wo.site_name}) no longer present - will be removed")
        
        removed_count = 0
        if not dry_run and work_orders_to_remove:
            logger.info(f"\nActually removing {len(work_orders_to_remove)} work orders...")
            for wo_to_remove in work_orders_to_remove:
                logger.info(f"Removing completed work order: {wo_to_remove.external_id} - {wo_to_remove.site_name}")
                db.delete(wo_to_remove)
                removed_count += 1
            
            db.commit()
            logger.info(f"Successfully removed {removed_count} work orders")
        else:
            logger.info(f"\nDry run - would remove {len(work_orders_to_remove)} work orders")
        
        return removed_count
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        db.rollback()
        return 0
    finally:
        db.close()

def main():
    """Main test function"""
    logger.info("Work Order Cleanup Test Script")
    logger.info("="*60)
    
    # Check current state
    total_work_orders = check_current_work_orders()
    
    if total_work_orders == 0:
        logger.info("\nNo work orders found in database. Nothing to test.")
        return
    
    # Get a user to test with
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            logger.error("No users found in database")
            return
        
        # Use the first user with work orders
        test_user = None
        for user in users:
            if db.query(WorkOrder).filter(WorkOrder.user_id == user.id).count() > 0:
                test_user = user
                break
        
        if not test_user:
            logger.error("No users with work orders found")
            return
        
        logger.info(f"\nUsing test user: {test_user.username} (ID: {test_user.id})")
        
        # Simulate a scrape that finds fewer work orders (simulating some completed)
        # Get current work orders and simulate that 2 of them are completed/missing
        current_work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == test_user.id
        ).all()
        
        # Simulate that some work orders are no longer present
        current_external_ids = {wo.external_id for wo in current_work_orders}
        logger.info(f"\nSimulating that 2 work orders have been completed...")
        
        # Remove 2 work orders from the "current" set to simulate they're completed
        external_ids_to_remove = list(current_external_ids)[:2] if len(current_external_ids) >= 2 else []
        for ext_id in external_ids_to_remove:
            current_external_ids.remove(ext_id)
            logger.info(f"  Simulating {ext_id} as completed/removed from WorkFossa")
        
        # Test the cleanup simulation
        simulate_cleanup(test_user.id, current_external_ids)
        
        # Ask if user wants to run actual cleanup
        logger.info("\n" + "="*60)
        response = input("Do you want to run the actual cleanup (remove work orders)? (yes/no): ")
        
        if response.lower() == 'yes':
            removed = test_actual_cleanup(test_user.id, current_external_ids, dry_run=False)
            logger.info(f"\nCleanup completed. Removed {removed} work orders.")
            
            # Check final state
            logger.info("\nFinal database state:")
            check_current_work_orders()
        else:
            logger.info("\nSkipping actual cleanup. Database unchanged.")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
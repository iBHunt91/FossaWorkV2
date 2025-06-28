#!/usr/bin/env python3
"""
Script to verify that work order cleanup is now working correctly
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import WorkOrder, User
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = "sqlite:///./fossawork_v2.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_work_order_snapshot():
    """Get current work order snapshot"""
    db = SessionLocal()
    try:
        snapshot = {}
        users = db.query(User).all()
        
        for user in users:
            work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user.id).all()
            snapshot[user.id] = {
                'username': user.username,
                'work_orders': {
                    wo.external_id: {
                        'site_name': wo.site_name,
                        'status': wo.status,
                        'created_at': wo.created_at,
                        'updated_at': wo.updated_at
                    }
                    for wo in work_orders
                }
            }
        
        return snapshot
    finally:
        db.close()

def compare_snapshots(before, after):
    """Compare two snapshots and show differences"""
    logger.info("\n" + "="*60)
    logger.info("Work Order Changes")
    logger.info("="*60)
    
    for user_id in before:
        if user_id not in after:
            logger.warning(f"User {user_id} no longer exists!")
            continue
            
        username = before[user_id]['username']
        before_wos = before[user_id]['work_orders']
        after_wos = after[user_id]['work_orders']
        
        # Find removed work orders
        removed = set(before_wos.keys()) - set(after_wos.keys())
        # Find added work orders
        added = set(after_wos.keys()) - set(before_wos.keys())
        # Find unchanged
        unchanged = set(before_wos.keys()) & set(after_wos.keys())
        
        if removed or added:
            logger.info(f"\nUser: {username} (ID: {user_id})")
            logger.info(f"  Before: {len(before_wos)} work orders")
            logger.info(f"  After: {len(after_wos)} work orders")
            
            if removed:
                logger.info(f"\n  ✅ Removed {len(removed)} work orders (cleanup working!):")
                for wo_id in removed:
                    wo = before_wos[wo_id]
                    logger.info(f"    - {wo_id}: {wo['site_name']} (was: {wo['status']})")
            
            if added:
                logger.info(f"\n  ➕ Added {len(added)} new work orders:")
                for wo_id in added:
                    wo = after_wos[wo_id]
                    logger.info(f"    - {wo_id}: {wo['site_name']} (status: {wo['status']})")
            
            logger.info(f"\n  📋 Unchanged: {len(unchanged)} work orders")

async def trigger_manual_scrape(user_id: str):
    """Trigger a manual scrape via API"""
    import httpx
    
    logger.info(f"\nTriggering manual scrape for user {user_id}...")
    
    # First, we need to get auth token (you may need to adjust this based on your auth setup)
    # For now, we'll assume you have a valid token or can run this locally
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"http://localhost:8000/api/v1/work-orders/scrape?user_id={user_id}",
                headers={"Authorization": "Bearer YOUR_TOKEN_HERE"}  # Update with actual token
            )
            
            if response.status_code == 200:
                logger.info("✅ Scrape triggered successfully")
                return True
            else:
                logger.error(f"❌ Failed to trigger scrape: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"❌ Error triggering scrape: {e}")
        return False

def main():
    """Main verification function"""
    logger.info("Work Order Cleanup Verification Script")
    logger.info("="*60)
    
    # Take initial snapshot
    logger.info("\nTaking initial snapshot...")
    before_snapshot = get_work_order_snapshot()
    
    total_work_orders = sum(len(user['work_orders']) for user in before_snapshot.values())
    logger.info(f"Found {len(before_snapshot)} users with {total_work_orders} total work orders")
    
    if total_work_orders == 0:
        logger.warning("\nNo work orders found. Please run a scrape first.")
        return
    
    # Show current state
    for user_id, data in before_snapshot.items():
        if data['work_orders']:
            logger.info(f"\nUser: {data['username']} - {len(data['work_orders'])} work orders")
    
    logger.info("\n" + "="*60)
    logger.info("Instructions to test cleanup:")
    logger.info("="*60)
    logger.info("""
1. Go to WorkFossa and complete one or more work orders
2. Run a manual scrape using one of these methods:
   a) Use the UI "Refresh Work Orders" button
   b) Run: python scripts/trigger_manual_scrape.py
   c) Wait for the next hourly scheduled scrape
3. Run this script again to see if completed work orders were removed

The fix changes the scraper to fetch ALL work orders instead of just incomplete ones,
allowing the cleanup logic to properly identify and remove completed work orders.
""")
    
    response = input("\nHave you completed work orders and run a scrape? (yes/no): ")
    
    if response.lower() == 'yes':
        # Take after snapshot
        logger.info("\nTaking after snapshot...")
        after_snapshot = get_work_order_snapshot()
        
        # Compare snapshots
        compare_snapshots(before_snapshot, after_snapshot)
        
        # Summary
        total_before = sum(len(user['work_orders']) for user in before_snapshot.values())
        total_after = sum(len(user['work_orders']) for user in after_snapshot.values())
        
        logger.info("\n" + "="*60)
        logger.info("Summary")
        logger.info("="*60)
        logger.info(f"Total work orders before: {total_before}")
        logger.info(f"Total work orders after: {total_after}")
        logger.info(f"Net change: {total_after - total_before}")
        
        if total_after < total_before:
            logger.info("\n✅ SUCCESS: Work order cleanup is working! Completed work orders were removed.")
        elif total_after > total_before:
            logger.info("\n📋 New work orders were added but no cleanup occurred.")
        else:
            logger.info("\n⚠️ No changes detected. Make sure you completed work orders in WorkFossa.")

if __name__ == "__main__":
    main()
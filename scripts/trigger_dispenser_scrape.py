#!/usr/bin/env python3
"""
Trigger a dispenser scrape for a work order to populate new fields
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.database import SessionLocal
from app.core_models import WorkOrder
from app.routes.work_orders import perform_dispenser_scrape
from app.services.credential_manager import credential_manager

async def trigger_scrape():
    """Trigger dispenser scrape for a work order"""
    print("🚀 Triggering Dispenser Scrape")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # Get Bruce's user ID
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        # Find a work order with a customer URL
        work_order = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id,
            WorkOrder.customer_url.isnot(None)
        ).first()
        
        if not work_order:
            print("❌ No work orders found with customer URL")
            return
            
        print(f"✅ Found work order: {work_order.external_id}")
        print(f"   Site: {work_order.site_name}")
        print(f"   Customer URL: {work_order.customer_url}")
        
        # Get credentials
        creds = credential_manager.retrieve_credentials(user_id)
        if not creds:
            print("❌ No credentials found")
            return
            
        credentials = {
            "username": creds.username,
            "password": creds.password
        }
        
        print(f"\n🔐 Using credentials for: {credentials['username']}")
        print("\n🌐 Starting dispenser scrape...")
        
        # Perform the scrape
        await perform_dispenser_scrape(
            work_order.id,
            user_id,
            credentials,
            work_order.customer_url
        )
        
        print("\n✅ Dispenser scrape completed!")
        print("\n📊 Check the results:")
        print("  1. Run: python3 scripts/test_dispenser_db_check.py")
        print("  2. Or start the app and view dispensers in the UI")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(trigger_scrape())
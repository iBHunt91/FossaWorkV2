#!/usr/bin/env python3
"""
Simple work order scraping using the existing API endpoints
This mimics what the UI does when triggering a scrape
"""

import asyncio
import aiohttp
import json
import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def run_work_order_scrape():
    print("🚀 Simple Work Order Scraping")
    print("=" * 50)
    
    # Configuration
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    api_base = "http://localhost:8000"
    
    # Read encrypted credentials and decrypt them
    from app.services.credential_manager import credential_manager
    
    # Set a temporary master key if not set
    import os
    if not os.getenv('FOSSAWORK_MASTER_KEY'):
        os.environ['FOSSAWORK_MASTER_KEY'] = 'temporary-key-for-testing-only-do-not-use-in-production'
    
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found for user")
        return
    
    email = creds.username
    password = creds.password
    
    print(f"✅ Found credentials for user: {email}")
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Create automation session
        print("\n📝 Creating automation session...")
        create_session_data = {
            "email": email,
            "password": password
        }
        
        try:
            async with session.post(
                f"{api_base}/api/automation/sessions",
                json=create_session_data,
                headers={"X-User-ID": user_id}
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Failed to create session: {resp.status} - {text}")
                    return
                
                session_data = await resp.json()
                session_id = session_data['session_id']
                print(f"✅ Session created: {session_id}")
        except Exception as e:
            print(f"❌ Error creating session: {e}")
            return
        
        # Step 2: Start work order scraping
        print("\n🔍 Starting work order scraping...")
        scrape_data = {
            "email": email,
            "password": password,
            "filters": {}
        }
        
        try:
            async with session.post(
                f"{api_base}/api/automation/scrape-work-orders",
                json=scrape_data,
                headers={"X-User-ID": user_id}
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    print(f"❌ Failed to start scraping: {resp.status} - {text}")
                    return
                
                result = await resp.json()
                job_id = result.get('job_id')
                print(f"✅ Scraping started with job ID: {job_id}")
        except Exception as e:
            print(f"❌ Error starting scrape: {e}")
            return
        
        # Step 3: Wait for completion (simplified - just wait a bit)
        print("\n⏳ Waiting for scraping to complete...")
        await asyncio.sleep(30)  # Wait 30 seconds for scraping
        
        # Step 4: Get results
        print("\n📊 Checking results...")
        try:
            # Get work orders from database
            from app.database import SessionLocal
            from app.core_models import WorkOrder
            
            db = SessionLocal()
            try:
                work_orders = db.query(WorkOrder).filter(
                    WorkOrder.user_id == user_id
                ).order_by(WorkOrder.created_at.desc()).limit(10).all()
                
                print(f"\n✅ Found {len(work_orders)} work orders in database:")
                for wo in work_orders[:5]:  # Show first 5
                    print(f"   - {wo.external_id}: {wo.site_name} ({wo.scheduled_date})")
                
                if len(work_orders) > 5:
                    print(f"   ... and {len(work_orders) - 5} more")
                    
            finally:
                db.close()
                
        except Exception as e:
            print(f"❌ Error checking results: {e}")
        
        # Step 5: Close session
        print("\n🔚 Closing session...")
        try:
            async with session.delete(
                f"{api_base}/api/automation/sessions",
                headers={"X-User-ID": user_id}
            ) as resp:
                if resp.status == 200:
                    print("✅ Session closed successfully")
                else:
                    print(f"⚠️  Session close returned status: {resp.status}")
        except Exception as e:
            print(f"⚠️  Error closing session: {e}")
    
    print("\n✅ Work order scraping completed!")

if __name__ == "__main__":
    asyncio.run(run_work_order_scrape())
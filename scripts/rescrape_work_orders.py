#!/usr/bin/env python3
"""
Script to clear and re-scrape work orders to test visit URL extraction fix
"""
import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser, User
from app.services.credential_manager import CredentialManager
import requests

async def rescrape_work_orders():
    """Clear and re-scrape work orders"""
    db = SessionLocal()
    
    try:
        # Get first user
        user = db.query(User).first()
        if not user:
            print("❌ No users found in database")
            return
        
        user_id = user.id
        print(f"✅ Found user: {user.username} (ID: {user_id})")
        
        # Check credentials
        credential_manager = CredentialManager()
        creds = credential_manager.retrieve_credentials(user_id)
        if not creds or not creds.username or not creds.password:
            print("❌ No WorkFossa credentials found")
            return
        
        print(f"✅ Found credentials for: {creds.username}")
        
        # Clear existing work orders
        print("\n🗑️  Clearing existing work orders...")
        dispensers_deleted = db.query(Dispenser).filter(
            Dispenser.work_order_id.in_(
                db.query(WorkOrder.id).filter(WorkOrder.user_id == user_id)
            )
        ).delete(synchronize_session=False)
        
        work_orders_deleted = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).delete(synchronize_session=False)
        
        db.commit()
        print(f"✅ Deleted {work_orders_deleted} work orders and {dispensers_deleted} dispensers")
        
        # Trigger new scrape
        print("\n🔄 Triggering new work order scrape...")
        response = requests.post(
            "http://localhost:8000/api/v1/work-orders/scrape",
            params={"user_id": user_id}
        )
        
        if response.status_code == 200:
            print("✅ Scraping started successfully")
            print(f"Response: {response.json()}")
            
            # Monitor progress
            print("\n📊 Monitoring scraping progress...")
            import time
            while True:
                time.sleep(2)
                progress_response = requests.get(
                    f"http://localhost:8000/api/v1/work-orders/scrape/progress/{user_id}"
                )
                if progress_response.status_code == 200:
                    progress = progress_response.json()
                    print(f"Status: {progress['status']} - {progress['phase']} ({progress['percentage']}%) - {progress['message']}")
                    
                    if progress['status'] in ['completed', 'failed']:
                        if progress['status'] == 'completed':
                            print(f"\n✅ Scraping completed! Found {progress['work_orders_found']} work orders")
                        else:
                            print(f"\n❌ Scraping failed: {progress.get('error', 'Unknown error')}")
                        break
            
            # Check the results
            print("\n🔍 Checking scraped work orders...")
            db.expire_all()  # Refresh session
            work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).limit(5).all()
            
            for wo in work_orders:
                print(f"\nWork Order: {wo.external_id}")
                print(f"  Site: {wo.site_name}")
                print(f"  Visit URL: {wo.visit_url}")
                print(f"  Customer URL: {wo.customer_url}")
                print(f"  Visit ID: {wo.visit_id}")
                print(f"  Visit Number: {wo.visit_number}")
                
                # Check if URLs are correct
                if wo.visit_url and '/customers/locations/' in wo.visit_url:
                    print("  ❌ ERROR: visit_url contains customer URL pattern!")
                elif wo.visit_url and '/visits/' in wo.visit_url:
                    print("  ✅ CORRECT: visit_url contains /visits/ pattern")
                elif wo.visit_url and '/app/work/' in wo.visit_url and '/visits/' not in wo.visit_url:
                    print("  ⚠️  WARNING: visit_url is just a work order URL (no visit ID)")
                    
        else:
            print(f"❌ Failed to start scraping: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(rescrape_work_orders())
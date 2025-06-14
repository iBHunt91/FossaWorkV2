#!/usr/bin/env python3
from pathlib import Path
"""
Test to understand the dispenser scraping issue
"""
import asyncio
import logging
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def analyze_dispenser_issue():
    """Analyze why dispenser scraping isn't working"""
    
    print("\n🔍 Analyzing Dispenser Scraping Issue")
    print("="*60)
    
    # Check recent screenshots
    print("\n1️⃣ Checking for recent debug screenshots...")
    screenshot_dirs = [
        "/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend/screenshots",
        "/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend"
    ]
    
    screenshots_found = []
    for dir_path in screenshot_dirs:
        if os.path.exists(dir_path):
            for file in os.listdir(dir_path):
                if file.endswith('.png') and ('debug' in file.lower() or 'dispenser' in file.lower() or 'customer' in file.lower()):
                    file_path = os.path.join(dir_path, file)
                    stat = os.stat(file_path)
                    screenshots_found.append({
                        'name': file,
                        'path': file_path,
                        'size': stat.st_size,
                        'modified': os.path.getmtime(file_path)
                    })
    
    # Sort by modification time
    screenshots_found.sort(key=lambda x: x['modified'], reverse=True)
    
    if screenshots_found:
        print("📸 Recent screenshots found:")
        for ss in screenshots_found[:5]:
            print(f"   - {ss['name']} ({ss['size']} bytes)")
    else:
        print("   No recent screenshots found")
    
    # Check the database for work order data
    print("\n2️⃣ Analyzing work order data...")
    from app.database import SessionLocal
    from app.models import WorkOrder, Dispenser
    
    db = SessionLocal()
    
    try:
        # Get work orders with dispenser service codes
        dispenser_codes = ["2861", "2862", "3146", "3002"]
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(dispenser_codes)
        ).limit(3).all()
        
        print(f"\n📊 Sample work orders with dispenser services:")
        for wo in work_orders:
            print(f"\n   Work Order: {wo.external_id}")
            print(f"   Site: {wo.site_name}")
            print(f"   Service: {wo.service_code} - {wo.service_description}")
            
            # Check scraped data
            if wo.scraped_data:
                print(f"   Has scraped_data: Yes")
                print(f"   Customer URL: {wo.scraped_data.get('customer_url', 'None')}")
                print(f"   Address components: {wo.scraped_data.get('address_components', {})}")
                
                # Check for dispensers in scraped data
                if 'dispensers' in wo.scraped_data:
                    print(f"   Dispensers in scraped_data: {len(wo.scraped_data['dispensers'])}")
                    if wo.scraped_data['dispensers']:
                        print(f"   First dispenser: {wo.scraped_data['dispensers'][0]}")
            else:
                print(f"   Has scraped_data: No")
            
            # Check actual dispenser records
            dispensers = db.query(Dispenser).filter(
                Dispenser.work_order_id == wo.id
            ).all()
            
            print(f"   Dispenser records in DB: {len(dispensers)}")
            if dispensers:
                print(f"   Dispenser types: {[d.dispenser_type for d in dispensers]}")
        
        print("\n3️⃣ Diagnosis:")
        print("   ❌ Customer URLs are not being extracted during work order scraping")
        print("   ❌ Without customer URLs, dispenser scraping can't navigate to equipment pages")
        print("   ❌ Default placeholder dispensers are being created instead")
        
        print("\n4️⃣ Root Causes:")
        print("   1. The store numbers might not be clickable links in the work order table")
        print("   2. The customer URL extraction logic might be looking in the wrong cell")
        print("   3. The page structure might have changed from when the code was written")
        
        print("\n5️⃣ Solution:")
        print("   We need to update the customer URL extraction to match the current page structure")
        print("   This likely requires analyzing the actual HTML structure of the work order table")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(analyze_dispenser_issue())
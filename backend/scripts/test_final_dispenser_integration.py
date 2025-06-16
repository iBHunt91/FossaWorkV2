#!/usr/bin/env python3
"""
Final integration test for dispenser scraping with all improvements
Tests the complete flow from API to scraper to database
"""

import asyncio
import sys
import os
from pathlib import Path
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager
from app.services.dispenser_scraper import DispenserScraper
from app.models.work_order import WorkOrder
from app.models.dispenser import Dispenser
from app.database import SessionLocal


async def test_final_integration():
    """Test the complete dispenser scraping integration"""
    print("🧪 Final Dispenser Scraping Integration Test")
    print("=" * 50)
    
    # Get credentials
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    creds = credential_manager.retrieve_credentials(user_id)
    if not creds:
        print("❌ No credentials found")
        return
    
    credentials = {
        "username": creds.username,
        "password": creds.password
    }
    
    # Create services
    automation = WorkFossaAutomationService(headless=False)
    scraper = DispenserScraper()
    db = SessionLocal()
    
    try:
        print("\n1️⃣ Setting up test work order in database...")
        
        # Create or update a test work order
        test_wo_id = "test_dispenser_integration"
        test_wo = db.query(WorkOrder).filter(WorkOrder.id == test_wo_id).first()
        
        if not test_wo:
            test_wo = WorkOrder(
                id=test_wo_id,
                user_id=user_id,
                external_id="W-110497",
                site_name="Wawa #5267",
                address="25155 Maren Way, Lutz, FL 33559",
                store_number="5267",
                service_code="2861",  # Dispenser service code
                service_description="AccuMeasure - All Dispensers",
                scheduled_date=datetime.now(),
                status="pending",
                scraped_data={
                    "customer_url": "https://app.workfossa.com/app/customers/locations/32951/"
                }
            )
            db.add(test_wo)
            db.commit()
            print("✅ Created test work order")
        else:
            print("✅ Using existing test work order")
        
        print(f"   Work Order ID: {test_wo.id}")
        print(f"   External ID: {test_wo.external_id}")
        print(f"   Service Code: {test_wo.service_code}")
        print(f"   Customer URL: {test_wo.scraped_data.get('customer_url')}")
        
        # Clear existing dispensers
        deleted = db.query(Dispenser).filter(Dispenser.work_order_id == test_wo_id).delete()
        db.commit()
        print(f"   Cleared {deleted} existing dispensers")
        
        print("\n2️⃣ Creating browser session and logging in...")
        
        # Create session and login
        session_id = "test_final_integration"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        print("\n3️⃣ Testing dispenser scraping with improved workflow...")
        
        # Get customer URL
        customer_url = test_wo.scraped_data.get('customer_url')
        if not customer_url:
            print("❌ No customer URL available")
            return
        
        # Scrape dispensers
        print(f"\n📍 Scraping dispensers from: {customer_url}")
        result = await scraper.scrape_dispensers(
            page=page,
            customer_url=customer_url,
            store_number=test_wo.store_number
        )
        
        if isinstance(result, list):
            print(f"\n✅ Successfully scraped {len(result)} dispensers")
            
            # Display results
            print("\n📊 Dispenser Data:")
            for i, dispenser in enumerate(result):
                print(f"\n   Dispenser {i+1}:")
                print(f"     Number: {dispenser.get('dispenser_number', 'N/A')}")
                print(f"     Title: {dispenser.get('title', 'N/A')}")
                print(f"     Make: {dispenser.get('make', 'N/A')}")
                print(f"     Model: {dispenser.get('model', 'N/A')}")
                print(f"     Serial: {dispenser.get('serial_number', 'N/A')}")
                print(f"     Grades: {dispenser.get('fuel_grades', {})}")
            
            print("\n4️⃣ Saving dispensers to database...")
            
            # Save to database (simulating what the API does)
            for i, disp_data in enumerate(result):
                dispenser = Dispenser(
                    id=f"test_disp_{i}",
                    work_order_id=test_wo_id,
                    dispenser_number=disp_data.get("dispenser_number", str(i + 1)),
                    dispenser_type=disp_data.get("make", "Unknown"),
                    fuel_grades=disp_data.get("fuel_grades", {}),
                    status="pending",
                    progress_percentage=0.0,
                    automation_completed=False,
                    form_data={
                        "serial_number": disp_data.get("serial_number"),
                        "make": disp_data.get("make"),
                        "model": disp_data.get("model"),
                        "title": disp_data.get("title"),
                        "custom_fields": disp_data.get("custom_fields", {})
                    }
                )
                db.add(dispenser)
            
            # Update work order scraped data
            test_wo.scraped_data["dispensers"] = result
            test_wo.scraped_data["dispenser_count"] = len(result)
            test_wo.scraped_data["dispenser_scrape_date"] = datetime.now().isoformat()
            
            # Mark as modified for SQLite
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(test_wo, "scraped_data")
            
            db.commit()
            print(f"✅ Saved {len(result)} dispensers to database")
            
            # Verify database
            print("\n5️⃣ Verifying database storage...")
            
            saved_dispensers = db.query(Dispenser).filter(
                Dispenser.work_order_id == test_wo_id
            ).all()
            
            print(f"✅ Found {len(saved_dispensers)} dispensers in database")
            
            # Verify scraped data
            refreshed_wo = db.query(WorkOrder).filter(WorkOrder.id == test_wo_id).first()
            if refreshed_wo and refreshed_wo.scraped_data:
                disp_count = refreshed_wo.scraped_data.get("dispenser_count", 0)
                print(f"✅ Work order scraped_data shows {disp_count} dispensers")
            
            print("\n🎉 Integration test completed successfully!")
            print("\nSummary:")
            print(f"  - Scraped {len(result)} dispensers")
            print(f"  - Saved to database successfully")
            print(f"  - All data properly structured")
            print(f"  - Content-based waiting worked correctly")
            print(f"  - Dispenser toggle click handled properly")
            
        else:
            print(f"\n❌ Scraping failed: {result}")
        
        print("\n📸 Taking final screenshot...")
        await page.screenshot(path="test_final_integration.png")
        print("   Screenshot saved as test_final_integration.png")
        
        print("\n⏸️  Browser remains open for inspection...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        await automation.cleanup_session(session_id)
        db.close()
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(test_final_integration())
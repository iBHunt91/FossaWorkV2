#!/usr/bin/env python3
"""
Show detailed results of dispenser scraping test with step-by-step analysis
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper
from app.database import SessionLocal
from app.models import WorkOrder
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def show_test_results():
    """Show detailed dispenser scraping test results"""
    
    print("📊 DISPENSER SCRAPING TEST RESULTS")
    print("="*80)
    
    # Get credentials
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    
    # Get a work order with customer URL
    db = SessionLocal()
    try:
        wo = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"]),
            WorkOrder.user_id == user_id
        ).first()
        
        if not wo:
            print("❌ No dispenser work orders found!")
            return
        
        customer_url = wo.scraped_data.get('customer_url') if wo.scraped_data else None
        
        print(f"🎯 Test Work Order: {wo.external_id}")
        print(f"📍 Site: {wo.site_name}")
        print(f"🔗 Customer URL: {customer_url}")
        print()
        
        if not customer_url:
            print("❌ No customer URL found!")
            return
        
        # Initialize services
        print("🔧 STEP 1: Initialize Services")
        print("-" * 40)
        automation_service = WorkFossaAutomationService(headless=False)
        scraper = WorkFossaScraper(automation_service)
        print("✅ Services initialized successfully")
        print()
        
        # Create session and login
        print("🔧 STEP 2: Create Session and Login")
        print("-" * 40)
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        await automation_service.create_session(session_id, user_id, credentials)
        print("✅ Browser session created")
        
        await automation_service.login_to_workfossa(session_id)
        print("✅ Successfully logged into WorkFossa")
        print()
        
        # Test dispenser scraping
        print("🔧 STEP 3: Scrape Dispensers")
        print("-" * 40)
        print("📍 Navigating to customer page...")
        print(f"🔗 URL: {customer_url}")
        
        dispensers = await scraper.scrape_dispenser_details(session_id, wo.external_id, customer_url)
        
        print()
        print("📊 SCRAPING RESULTS:")
        print("="*50)
        
        if dispensers:
            print(f"✅ SUCCESS! Found {len(dispensers)} dispensers")
            print()
            
            for i, dispenser in enumerate(dispensers, 1):
                print(f"🏪 DISPENSER #{i}")
                print(f"   Number: {dispenser.get('dispenser_number', 'N/A')}")
                print(f"   Type: {dispenser.get('dispenser_type', 'N/A')}")
                print(f"   Serial #: {dispenser.get('serial_number', 'N/A')}")
                
                # Parse the title for more details
                title = dispenser.get('title', '')
                if title:
                    lines = title.split('\n')
                    if lines:
                        first_line = lines[0].strip()
                        print(f"   Details: {first_line}")
                        
                        # Look for make/model info
                        for line in lines:
                            if 'Make:' in line:
                                print(f"   Make/Model: {line.strip()}")
                
                # Fuel grades
                fuel_grades = dispenser.get('fuel_grades', {})
                if fuel_grades:
                    fuels = []
                    for fuel, info in fuel_grades.items():
                        if isinstance(info, dict) and 'octane' in info:
                            fuels.append(f"{fuel.title()} ({info['octane']})")
                        else:
                            fuels.append(fuel.title())
                    print(f"   Fuels: {', '.join(fuels)}")
                
                print()
            
            # Analyze the data quality
            print("📈 DATA QUALITY ANALYSIS:")
            print("="*50)
            
            real_dispensers = [d for d in dispensers if d.get('dispenser_type') != 'Wayne 300']
            has_serial_numbers = [d for d in dispensers if d.get('serial_number') and d.get('serial_number') != 'N/A']
            has_detailed_info = [d for d in dispensers if d.get('title') and 'S/N:' in d.get('title', '')]
            
            print(f"✅ Total dispensers extracted: {len(dispensers)}")
            print(f"✅ Real dispensers (not defaults): {len(real_dispensers)}")
            print(f"✅ Dispensers with serial numbers: {len(has_serial_numbers)}")
            print(f"✅ Dispensers with detailed info: {len(has_detailed_info)}")
            
            if has_detailed_info:
                print("\n🎯 DETAILED DISPENSER INFO FOUND:")
                for d in has_detailed_info:
                    title = d.get('title', '')
                    if 'Make:' in title and 'Model:' in title:
                        print(f"   - Dispenser #{d.get('dispenser_number')}: {title.split('Make:')[1].strip()}")
            
            print(f"\n🎉 SUCCESS RATE: {len(has_detailed_info)}/{len(dispensers)} dispensers have complete data")
            
        else:
            print("❌ No dispensers found")
        
        print()
        print("🔧 STEP 4: Verify Screenshot")
        print("-" * 40)
        screenshot_files = list(Path(".").glob("dispenser_scrape_*.png"))
        if screenshot_files:
            latest_screenshot = max(screenshot_files, key=lambda p: p.stat().st_mtime)
            print(f"📸 Screenshot saved: {latest_screenshot}")
            print("🌐 This shows the actual WorkFossa page that was scraped")
        else:
            print("📸 No screenshots found")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()
        
        # Clean up
        if hasattr(automation_service, 'browser') and automation_service.browser:
            await automation_service.browser.close()
        
        print("\n" + "="*80)
        print("🏁 TEST COMPLETED")
        print("="*80)

if __name__ == "__main__":
    asyncio.run(show_test_results())
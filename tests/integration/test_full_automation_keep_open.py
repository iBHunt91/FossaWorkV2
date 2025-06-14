#!/usr/bin/env python3
"""
Full dispenser scraping automation test - keeps browser open at end for inspection
"""
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import WorkFossaScraper

async def full_automation_test():
    """Run full dispenser scraping automation and keep browser open"""
    
    print("🔍 FULL DISPENSER SCRAPING AUTOMATION TEST")
    print("=" * 60)
    print("Running complete dispenser scraping workflow...")
    print("Browser will stay OPEN at the end for inspection")
    print()
    
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    automation_service = None
    
    try:
        # Initialize services in VISIBLE mode
        print("🔧 Initializing services (visible browser)...")
        automation_service = WorkFossaAutomationService(headless=False)
        scraper = WorkFossaScraper(automation_service)
        print("✅ Services initialized")
        
        # Create session and login
        print("🔧 Creating session and logging in...")
        session_id = str(uuid.uuid4())
        credentials = {
            'username': creds['username'],
            'password': creds['password']
        }
        
        await automation_service.create_session(session_id, user_id, credentials)
        await automation_service.login_to_workfossa(session_id)
        print("✅ Successfully logged into WorkFossa")
        
        # Use the customer URL we know works
        customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
        work_order_id = "#38437"
        
        print(f"🔧 Running dispenser scraping for work order {work_order_id}...")
        print(f"📍 Customer URL: {customer_url}")
        
        # Run the full dispenser scraping
        dispensers = await scraper.scrape_dispenser_details(session_id, work_order_id, customer_url)
        
        print("\n📊 DISPENSER SCRAPING RESULTS:")
        print("=" * 50)
        
        if dispensers:
            print(f"✅ SUCCESS! Found {len(dispensers)} dispensers")
            print()
            
            for i, dispenser in enumerate(dispensers, 1):
                print(f"🏪 DISPENSER #{i}")
                print(f"   Number: {dispenser.get('dispenser_number', 'N/A')}")
                print(f"   Type: {dispenser.get('dispenser_type', 'N/A')}")
                print(f"   Serial #: {dispenser.get('serial_number', 'N/A')}")
                
                # Parse title for details
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
            
            # Data quality analysis
            print("📈 DATA QUALITY ANALYSIS:")
            print("=" * 50)
            
            real_dispensers = [d for d in dispensers if d.get('dispenser_type') != 'Wayne 300']
            has_serial_numbers = [d for d in dispensers if d.get('serial_number') and d.get('serial_number') != 'N/A']
            has_detailed_info = [d for d in dispensers if d.get('title') and 'S/N:' in d.get('title', '')]
            
            print(f"✅ Total dispensers extracted: {len(dispensers)}")
            print(f"✅ Real dispensers (not defaults): {len(real_dispensers)}")
            print(f"✅ Dispensers with serial numbers: {len(has_serial_numbers)}")
            print(f"✅ Dispensers with detailed info: {len(has_detailed_info)}")
            
            if has_detailed_info:
                print("\n🎯 DETAILED DISPENSER INFO:")
                for d in has_detailed_info:
                    title = d.get('title', '')
                    if 'Make:' in title and 'Model:' in title:
                        make_model = title.split('Make:')[1].strip() if 'Make:' in title else 'Unknown'
                        print(f"   - Dispenser #{d.get('dispenser_number')}: {make_model}")
            
            success_rate = (len(has_detailed_info) / len(dispensers)) * 100 if dispensers else 0
            print(f"\n🎉 SUCCESS RATE: {success_rate:.1f}% ({len(has_detailed_info)}/{len(dispensers)} dispensers have complete data)")
            
        else:
            print("❌ No dispensers found")
        
        print("\n🔧 Taking final screenshot...")
        session_data = automation_service.sessions.get(session_id)
        if session_data and session_data.get('page'):
            page = session_data.get('page')
            await page.screenshot(path="final_automation_state.png")
            print("📸 Final screenshot saved: final_automation_state.png")
        
        print("\n" + "=" * 60)
        print("🎉 AUTOMATION COMPLETED SUCCESSFULLY!")
        print("🌐 Browser is STAYING OPEN for your inspection")
        print("👀 You can now examine:")
        print("   • The final page state")
        print("   • Equipment tab content")
        print("   • Dispenser section")
        print("   • Any expanded content")
        print()
        print("⚠️  IMPORTANT: Close the browser window manually when done")
        print("=" * 60)
        
        # Keep the script running so browser stays open
        print("\n💡 Script will keep running to maintain browser session...")
        print("   Press Ctrl+C to exit and close browser")
        
        # Wait indefinitely until user stops the script
        try:
            while True:
                await asyncio.sleep(10)  # Keep script alive
        except KeyboardInterrupt:
            print("\n🛑 Keyboard interrupt received")
            print("🧹 Closing browser...")
            if automation_service and hasattr(automation_service, 'browser') and automation_service.browser:
                await automation_service.browser.close()
            print("✅ Browser closed")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Close browser on error
        if automation_service and hasattr(automation_service, 'browser') and automation_service.browser:
            print("🧹 Closing browser due to error...")
            await automation_service.browser.close()

if __name__ == "__main__":
    asyncio.run(full_automation_test())
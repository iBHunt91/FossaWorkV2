#!/usr/bin/env python3
from pathlib import Path
"""
Direct test of dispenser scraping with manual credentials
"""
import asyncio
import logging
import sys
import getpass

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import workfossa_scraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_dispenser_scraping():
    """Direct test of dispenser scraping"""
    
    print("\n🧪 WorkFossa Dispenser Scraping Test")
    print("="*50)
    print("\nThis test will:")
    print("1. Login to WorkFossa")
    print("2. Navigate to a customer page")
    print("3. Extract dispenser information")
    print("\n⚠️  You'll need valid WorkFossa credentials\n")
    
    # Get credentials
    username = input("Enter WorkFossa username/email: ")
    password = getpass.getpass("Enter WorkFossa password: ")
    
    if not username or not password:
        print("❌ Credentials required")
        return
    
    credentials = {
        "username": username,
        "password": password
    }
    
    # Test parameters
    user_id = "test_user"
    session_id = f"test_dispenser_manual"
    customer_url = "https://app.workfossa.com/app/customers/locations/46769/"  # 7-Eleven #38437
    work_order_id = "test_38437"
    
    print(f"\n🎯 Target: 7-Eleven Store #38437")
    print(f"🔗 Customer URL: {customer_url}")
    
    automation_service = None
    
    try:
        # Create automation service
        print("\n🔧 Initializing automation service...")
        automation_service = WorkFossaAutomationService()
        
        # Create session
        print("🌐 Creating browser session...")
        await automation_service.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        print("✅ Browser session created")
        
        # Login
        print("\n🔐 Logging in to WorkFossa...")
        login_success = await automation_service.login_to_workfossa(session_id)
        
        if not login_success:
            print("❌ Login failed - please check credentials")
            return
        
        print("✅ Successfully logged in")
        
        # Scrape dispensers
        print("\n🔍 Navigating to customer page and extracting dispensers...")
        print("   This will:")
        print("   - Navigate to the customer location page")
        print("   - Click on the Equipment tab")
        print("   - Expand the Dispenser section")
        print("   - Extract dispenser details\n")
        
        dispensers = await workfossa_scraper.scrape_dispenser_details(
            session_id=session_id,
            work_order_id=work_order_id,
            customer_url=customer_url
        )
        
        # Display results
        print(f"\n{'='*60}")
        print(f"📊 RESULTS")
        print(f"{'='*60}")
        print(f"Dispensers found: {len(dispensers)}")
        
        if len(dispensers) == 0:
            print("\n⚠️  No dispensers found")
            print("\nPossible reasons:")
            print("- The page structure may have changed")
            print("- The Equipment tab might not be accessible")
            print("- The Dispenser section might be empty")
            print("\n💡 Check screenshots in /backend/screenshots/ for debugging")
        else:
            for i, dispenser in enumerate(dispensers, 1):
                print(f"\n📋 Dispenser #{i}:")
                for key, value in dispenser.items():
                    if key != 'raw_html':  # Skip raw HTML in output
                        print(f"   {key}: {value}")
        
        print(f"\n{'='*60}")
        print("✅ Test completed successfully!")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if automation_service:
            try:
                print("\n🧹 Cleaning up...")
                await automation_service.cleanup_session(session_id)
                print("✅ Cleanup complete")
            except:
                pass

if __name__ == "__main__":
    asyncio.run(test_dispenser_scraping())
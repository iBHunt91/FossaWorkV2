#!/usr/bin/env python3
"""
Interactive WorkFossa Scraping Test - Shows Browser
Tests the work order scraping with visible browser to debug credential issues
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
sys.path.insert(0, backend_path)

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.logging_service import get_logger
from app.database import SessionLocal
from app.models.user_models import UserCredential

logger = get_logger("interactive_scraping_test")

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

async def wait_for_user(message: str = "Press Enter to continue..."):
    """Wait for user input before proceeding"""
    print(f"\n{Colors.YELLOW}⏸️  {message}{Colors.END}")
    await asyncio.get_event_loop().run_in_executor(None, input)

async def test_scraping_with_browser():
    """Test work order scraping with visible browser"""
    print(f"{Colors.BOLD}{Colors.CYAN}🧪 INTERACTIVE WORKFOSSA SCRAPING TEST{Colors.END}")
    print("=" * 50)
    print("This test will show the browser so you can see what's happening")
    print("=" * 50)
    
    # Get user credentials from database
    print(f"\n{Colors.BLUE}📋 Step 1: Retrieving user credentials from database{Colors.END}")
    
    db = SessionLocal()
    try:
        # For this test, we'll use the demo user ID
        user_id = "demo"
        
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == 'workfossa'
        ).first()
        
        if not user_credential:
            print(f"{Colors.RED}❌ No WorkFossa credentials found for user {user_id}{Colors.END}")
            print(f"{Colors.YELLOW}Please save your WorkFossa credentials in the Settings page first.{Colors.END}")
            return
        
        # Show what credentials we're using (without showing the password)
        print(f"{Colors.GREEN}✅ Found credentials for user: {user_id}{Colors.END}")
        print(f"   Username: {user_credential.username}")
        print(f"   Password: {'*' * 8} (hidden)")
        print(f"   Encrypted: {'Yes' if user_credential.username != user_credential._username else 'No'}")
        
        await wait_for_user("Ready to start browser and test login?")
        
    finally:
        db.close()
    
    # Initialize scraper with headless=False to show browser
    print(f"\n{Colors.BLUE}🌐 Step 2: Initializing WorkFossa scraper (browser will be visible){Colors.END}")
    
    scraper = WorkFossaScraper(headless=False)  # Show browser
    
    try:
        # Test authentication
        print(f"\n{Colors.BLUE}🔐 Step 3: Testing WorkFossa authentication{Colors.END}")
        print(f"   Navigating to: https://app.workfossa.com")
        print(f"   Using username: {user_credential.username}")
        
        auth_result = await scraper.authenticate(user_id)
        
        if auth_result['status'] == 'success':
            print(f"{Colors.GREEN}✅ Authentication successful!{Colors.END}")
            print(f"   Message: {auth_result.get('message', 'Logged in successfully')}")
            
            await wait_for_user("Login successful! Check the browser. Ready to scrape work orders?")
            
            # Test work order scraping
            print(f"\n{Colors.BLUE}📋 Step 4: Scraping work orders{Colors.END}")
            print(f"   Navigating to work orders page...")
            
            work_orders = await scraper.scrape_work_orders(limit=10)
            
            if work_orders:
                print(f"{Colors.GREEN}✅ Successfully scraped {len(work_orders)} work orders!{Colors.END}")
                
                # Show first few work orders
                for i, wo in enumerate(work_orders[:3], 1):
                    print(f"\n   Work Order {i}:")
                    print(f"   - Job ID: {wo.get('job_id', 'N/A')}")
                    print(f"   - Store: {wo.get('store_number', 'N/A')}")
                    print(f"   - Customer: {wo.get('customer_name', 'N/A')}")
                    print(f"   - Service: {wo.get('service_code', 'N/A')} - {wo.get('service_name', 'N/A')}")
                
                if len(work_orders) > 3:
                    print(f"\n   ... and {len(work_orders) - 3} more work orders")
            else:
                print(f"{Colors.YELLOW}⚠️ No work orders found{Colors.END}")
            
        else:
            print(f"{Colors.RED}❌ Authentication failed!{Colors.END}")
            print(f"   Status: {auth_result.get('status', 'unknown')}")
            print(f"   Message: {auth_result.get('message', 'Unknown error')}")
            print(f"\n{Colors.YELLOW}Check the browser to see what went wrong.{Colors.END}")
        
        await wait_for_user("Test complete. Press Enter to close browser...")
        
    except Exception as e:
        print(f"{Colors.RED}💥 Error during scraping: {str(e)}{Colors.END}")
        logger.exception("Scraping test failed")
        await wait_for_user("Error occurred. Check browser and press Enter to close...")
    
    finally:
        # Clean up
        print(f"\n{Colors.BLUE}🧹 Cleaning up...{Colors.END}")
        await scraper.close()
        print(f"{Colors.GREEN}✅ Browser closed{Colors.END}")

async def main():
    """Main entry point"""
    try:
        await test_scraping_with_browser()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test interrupted by user{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}Fatal error: {str(e)}{Colors.END}")
        logger.exception("Test failed")

if __name__ == "__main__":
    print(f"{Colors.BOLD}Starting WorkFossa Scraping Test...{Colors.END}")
    print(f"This will open a browser window to show the scraping process\n")
    
    # Ensure we're using the virtual environment
    venv_warning = """
    ⚠️  Make sure you're running this from the backend virtual environment:
    
    cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
    source venv/bin/activate
    python ../scripts/testing/interactive/test_workfossa_scraping_fixed.py
    """
    print(f"{Colors.YELLOW}{venv_warning}{Colors.END}")
    
    try:
        input(f"{Colors.GREEN}Press Enter when ready to start...{Colors.END}")
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Cancelled by user{Colors.END}")
        sys.exit(0)
    
    asyncio.run(main())
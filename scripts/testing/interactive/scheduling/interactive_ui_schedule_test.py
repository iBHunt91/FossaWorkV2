#!/usr/bin/env python3
"""
Interactive UI test for scheduling system
Tests the complete flow from UI interactions to backend execution
"""

import asyncio
import sys
import os
import requests
import json
from datetime import datetime, timedelta
from pathlib import Path
from playwright.async_api import async_playwright

# Add backend to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.models.user_models import User, UserCredential


async def wait_for_user():
    """Pause and wait for user to continue"""
    print("\n⏸️  Press Enter to continue...")
    await asyncio.get_event_loop().run_in_executor(None, input)


class InteractiveUIScheduleTester:
    """Interactive UI tester for scheduling system"""
    
    def __init__(self):
        self.base_url = "http://localhost:5173"  # Frontend dev server
        self.api_url = "http://localhost:8000"   # Backend API
        self.browser = None
        self.page = None
        self.context = None
        self.playwright = None
        
        # Test user credentials
        self.test_username = "uitest"
        self.test_password = "uitest123"
        self.test_user_id = "ui_test_user"
        
    async def setup_browser(self):
        """Set up browser for testing"""
        print("\n🌐 Step 1: Setting up browser...")
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,  # Show browser for interactive testing
            slow_mo=500      # Slow down actions for visibility
        )
        
        self.context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        self.page = await self.context.new_page()
        
        print("✅ Browser launched")
        await wait_for_user()
    
    async def setup_test_user(self):
        """Set up test user in database"""
        print("\n👤 Step 2: Setting up test user...")
        
        # Create database connection
        engine = create_engine("sqlite:///../../backend/fossawork_v2.db")
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        
        try:
            # Create user if not exists
            user = db.query(User).filter_by(username=self.test_username).first()
            if not user:
                user = User(
                    id=self.test_user_id,
                    username=self.test_username,
                    email="uitest@example.com"
                )
                db.add(user)
            
            # Create credentials
            cred = db.query(UserCredential).filter_by(
                user_id=self.test_user_id,
                service_name="workfossa"
            ).first()
            
            if not cred:
                cred = UserCredential(
                    user_id=self.test_user_id,
                    service_name="workfossa",
                    username=self.test_username,
                    password=self.test_password
                )
                db.add(cred)
            
            db.commit()
            print(f"✅ Test user '{self.test_username}' ready")
            
        finally:
            db.close()
        
        await wait_for_user()
    
    async def navigate_to_app(self):
        """Navigate to the application"""
        print("\n🔗 Step 3: Navigating to application...")
        print(f"URL: {self.base_url}")
        
        await self.page.goto(self.base_url)
        await self.page.wait_for_load_state('networkidle')
        
        print("✅ Application loaded")
        await wait_for_user()
    
    async def login(self):
        """Log in to the application"""
        print("\n🔐 Step 4: Logging in...")
        
        # Mock WorkFossa login for testing
        print("ℹ️  Note: This assumes mock authentication is set up")
        
        # Click login button if present
        try:
            await self.page.click('button:has-text("Login")', timeout=5000)
            print("✅ Clicked login button")
        except:
            print("ℹ️  No login button found, may already be logged in")
        
        await wait_for_user()
    
    async def navigate_to_schedules(self):
        """Navigate to schedules page"""
        print("\n📅 Step 5: Navigating to schedules...")
        
        # Look for schedules link/button
        await self.page.click('text=Schedules')
        await self.page.wait_for_load_state('networkidle')
        
        print("✅ On schedules page")
        
        # Take screenshot
        await self.page.screenshot(path='schedule_page.png')
        print("📸 Screenshot saved: schedule_page.png")
        
        await wait_for_user()
    
    async def create_schedule(self):
        """Create a new schedule through UI"""
        print("\n➕ Step 6: Creating new schedule...")
        
        # Check if schedule already exists
        if await self.page.locator('text=Work Order Scraping Schedule').is_visible():
            print("ℹ️  Schedule already exists, will update instead")
            return
        
        print("📝 Setting schedule parameters:")
        print("  - Interval: 1 hour")
        print("  - Active hours: 6:00 - 22:00")
        
        # Set interval
        await self.page.fill('input#interval', '1')
        
        # Enable active hours
        checkbox = self.page.locator('input#useActiveHours')
        if not await checkbox.is_checked():
            await checkbox.click()
        
        # Set active hours
        await self.page.fill('input#startHour', '6')
        await self.page.fill('input#endHour', '22')
        
        # Click create button
        await self.page.click('button:has-text("Create Schedule")')
        
        # Wait for success message
        await self.page.wait_for_selector('text=Schedule created successfully', timeout=10000)
        
        print("✅ Schedule created")
        
        # Take screenshot
        await self.page.screenshot(path='schedule_created.png')
        print("📸 Screenshot saved: schedule_created.png")
        
        await wait_for_user()
    
    async def update_schedule(self):
        """Update existing schedule"""
        print("\n✏️  Step 7: Updating schedule...")
        
        # Change interval to 2 hours
        await self.page.fill('input#interval', '2')
        
        # Disable active hours
        checkbox = self.page.locator('input#useActiveHours')
        if await checkbox.is_checked():
            await checkbox.click()
        
        # Update schedule (pause and re-enable to apply changes)
        await self.page.click('button:has-text("Pause Schedule")')
        await self.page.wait_for_selector('text=Schedule paused', timeout=5000)
        
        await self.page.click('button:has-text("Enable Schedule")')
        await self.page.wait_for_selector('text=Schedule enabled', timeout=5000)
        
        print("✅ Schedule updated")
        print("  - New interval: 2 hours")
        print("  - Active hours: Disabled")
        
        await wait_for_user()
    
    async def trigger_manual_run(self):
        """Trigger manual run through UI"""
        print("\n▶️  Step 8: Triggering manual run...")
        
        # Click Run Now button
        await self.page.click('button:has-text("Run Now")')
        
        # Wait for confirmation
        await self.page.wait_for_selector('text=will run within the next minute', timeout=10000)
        
        print("✅ Manual run triggered")
        print("ℹ️  The scheduler daemon should pick this up within 60 seconds")
        
        # Take screenshot
        await self.page.screenshot(path='manual_run_triggered.png')
        print("📸 Screenshot saved: manual_run_triggered.png")
        
        await wait_for_user()
    
    async def check_execution_history(self):
        """Check execution history"""
        print("\n📊 Step 9: Checking execution history...")
        
        # Wait a bit for history to update
        print("⏳ Waiting 5 seconds for history to update...")
        await asyncio.sleep(5)
        
        # Refresh page
        await self.page.reload()
        await self.page.wait_for_load_state('networkidle')
        
        # Check if history is visible
        if await self.page.locator('text=Recent Execution History').is_visible():
            print("✅ Execution history found")
            
            # Count history items
            history_items = await self.page.locator('div:has(> div > svg)').count()
            print(f"📈 Found {history_items} history entries")
            
            # Take screenshot
            await self.page.screenshot(path='execution_history.png')
            print("📸 Screenshot saved: execution_history.png")
        else:
            print("ℹ️  No execution history yet")
        
        await wait_for_user()
    
    async def test_schedule_controls(self):
        """Test various schedule controls"""
        print("\n🎛️  Step 10: Testing schedule controls...")
        
        # Test pause/resume
        print("\n⏸️  Testing pause/resume...")
        current_button = await self.page.locator('button:has-text("Pause Schedule"), button:has-text("Enable Schedule")').first
        button_text = await current_button.inner_text() if current_button else None
        
        if button_text == "Pause Schedule":
            await self.page.click('button:has-text("Pause Schedule")')
            await self.page.wait_for_selector('text=Schedule paused')
            print("✅ Schedule paused")
            
            await self.page.click('button:has-text("Enable Schedule")')
            await self.page.wait_for_selector('text=Schedule enabled')
            print("✅ Schedule re-enabled")
        
        await wait_for_user()
    
    async def check_daemon_status(self):
        """Check daemon status display"""
        print("\n🔍 Step 11: Checking daemon status...")
        
        if await self.page.locator('text=Scheduler Status').is_visible():
            print("✅ Daemon status visible")
            
            # Get status info
            status_text = await self.page.locator('text=Daemon Status:').locator('..').inner_text()
            print(f"📊 {status_text}")
            
            schedules_text = await self.page.locator('text=Total Schedules:').locator('..').inner_text()
            print(f"📊 {schedules_text}")
        else:
            print("❌ Daemon status not visible")
        
        await wait_for_user()
    
    async def test_error_scenarios(self):
        """Test error handling"""
        print("\n❌ Step 12: Testing error scenarios...")
        
        # Test invalid interval
        print("\n📝 Testing invalid interval...")
        await self.page.fill('input#interval', '0.1')  # Too small
        
        # Try to update
        if await self.page.locator('button:has-text("Pause Schedule")').is_visible():
            await self.page.click('button:has-text("Pause Schedule")')
            
            # Check for error
            await asyncio.sleep(1)
            if await self.page.locator('text=Failed').is_visible():
                print("✅ Error handled correctly for invalid interval")
            
            # Reset to valid value
            await self.page.fill('input#interval', '1')
        
        await wait_for_user()
    
    async def cleanup(self):
        """Clean up after testing"""
        print("\n🧹 Cleaning up...")
        
        if self.browser:
            await self.browser.close()
        
        if self.playwright:
            await self.playwright.stop()
        
        print("✅ Browser closed")
        
        # Optionally delete test schedule
        response = input("\nDelete test schedule from database? (y/n): ")
        if response.lower() == 'y':
            # Would need API call or direct DB access to delete
            print("ℹ️  Schedule deletion would be implemented here")
    
    async def run_all_tests(self):
        """Run all interactive UI tests"""
        print("=" * 60)
        print("🧪 Interactive UI Schedule Testing")
        print("=" * 60)
        print("This script will test the scheduling UI interactively")
        print("\n⚠️  Prerequisites:")
        print("  1. Frontend dev server running (npm run dev)")
        print("  2. Backend server running (uvicorn app.main:app)")
        print("  3. Scheduler daemon running (optional)")
        
        input("\nPress Enter when ready to start...")
        
        try:
            await self.setup_browser()
            await self.setup_test_user()
            await self.navigate_to_app()
            await self.login()
            await self.navigate_to_schedules()
            await self.create_schedule()
            await self.update_schedule()
            await self.trigger_manual_run()
            await self.check_execution_history()
            await self.test_schedule_controls()
            await self.check_daemon_status()
            await self.test_error_scenarios()
            
        except KeyboardInterrupt:
            print("\n\n⚠️  Test interrupted by user")
        except Exception as e:
            print(f"\n\n❌ Error during testing: {e}")
            import traceback
            traceback.print_exc()
            
            # Take error screenshot
            if self.page:
                await self.page.screenshot(path='error_screenshot.png')
                print("📸 Error screenshot saved: error_screenshot.png")
        finally:
            await self.cleanup()
        
        print("\n✅ Interactive UI testing complete!")
        print("\n📁 Screenshots saved in current directory:")
        print("  - schedule_page.png")
        print("  - schedule_created.png")
        print("  - manual_run_triggered.png")
        print("  - execution_history.png")


async def main():
    """Main entry point"""
    tester = InteractiveUIScheduleTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
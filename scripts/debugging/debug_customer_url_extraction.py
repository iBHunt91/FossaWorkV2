#!/usr/bin/env python3
from pathlib import Path
"""
Debug script to understand why customer URLs aren't being extracted
"""
import asyncio
import logging
import sys
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.workfossa_scraper import workfossa_scraper
from app.services.credential_manager import CredentialManager

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def debug_customer_url_extraction():
    """Debug why customer URLs aren't being extracted"""
    
    print("\n🔍 Debugging Customer URL Extraction")
    print("="*60)
    
    # Use a known user ID
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Load credentials
    credential_manager = CredentialManager()
    credentials_obj = credential_manager.retrieve_credentials(user_id)
    
    if not credentials_obj or not credentials_obj.username or not credentials_obj.password:
        print("❌ No credentials found")
        return
    
    credentials = {
        "username": credentials_obj.username,
        "password": credentials_obj.password
    }
    
    session_id = f"debug_customer_url_{datetime.now().timestamp()}"
    automation_service = WorkFossaAutomationService()
    
    try:
        print("\n1️⃣ Creating browser session...")
        await automation_service.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        
        print("2️⃣ Logging in to WorkFossa...")
        login_success = await automation_service.login_to_workfossa(session_id)
        
        if not login_success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get the page from session
        session_data = automation_service.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            print("❌ No page found")
            return
        
        page = session_data['page']
        
        print("\n3️⃣ Navigating to work orders page...")
        await page.goto("https://app.workfossa.com/app/work", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Take a screenshot for debugging
        await page.screenshot(path="debug_work_orders_page.png")
        print("📸 Screenshot saved: debug_work_orders_page.png")
        
        print("\n4️⃣ Analyzing work order table structure...")
        
        # Get the first work order row and analyze its structure
        first_row_html = await page.evaluate("""
            () => {
                const table = document.querySelector('table tbody');
                if (!table) return 'No table found';
                
                const firstRow = table.querySelector('tr');
                if (!firstRow) return 'No rows found';
                
                const cells = firstRow.querySelectorAll('td');
                const cellInfo = [];
                
                cells.forEach((cell, index) => {
                    const links = cell.querySelectorAll('a');
                    const linkInfo = [];
                    
                    links.forEach(link => {
                        linkInfo.push({
                            href: link.href,
                            text: link.textContent.trim(),
                            className: link.className
                        });
                    });
                    
                    cellInfo.push({
                        index: index,
                        text: cell.textContent.trim().substring(0, 100),
                        hasLinks: links.length > 0,
                        links: linkInfo,
                        innerHTML: cell.innerHTML.substring(0, 200)
                    });
                });
                
                return {
                    cellCount: cells.length,
                    cells: cellInfo
                };
            }
        """)
        
        print("\n📊 First Work Order Row Analysis:")
        print(f"   Cell count: {first_row_html.get('cellCount', 0)}")
        
        for cell in first_row_html.get('cells', []):
            print(f"\n   Cell {cell['index']}:")
            print(f"   Text: {cell['text']}")
            print(f"   Has links: {cell['hasLinks']}")
            
            if cell['hasLinks']:
                print("   Links found:")
                for link in cell['links']:
                    print(f"     - Text: '{link['text']}'")
                    print(f"       Href: {link['href']}")
                    print(f"       Class: {link.get('className', 'none')}")
            
            # Show partial HTML for customer cell (usually cell 2)
            if cell['index'] == 2:
                print(f"   HTML preview: {cell['innerHTML']}...")
        
        print("\n5️⃣ Looking for store number patterns...")
        
        # Search for store number patterns in the page
        store_patterns = await page.evaluate("""
            () => {
                const elements = document.querySelectorAll('*');
                const patterns = [];
                
                elements.forEach(el => {
                    const text = el.textContent;
                    if (text && text.match(/#\\d{3,5}/)) {
                        // Found a store number pattern
                        const isLink = el.tagName === 'A';
                        const parent = el.parentElement;
                        
                        patterns.push({
                            text: text.trim().substring(0, 50),
                            tagName: el.tagName,
                            isLink: isLink,
                            href: isLink ? el.href : null,
                            parentTag: parent ? parent.tagName : null,
                            className: el.className
                        });
                    }
                });
                
                return patterns.slice(0, 10); // First 10 matches
            }
        """)
        
        print("\n🔍 Store number patterns found:")
        for pattern in store_patterns:
            print(f"   Text: '{pattern['text']}'")
            print(f"   Tag: {pattern['tagName']}, Is Link: {pattern['isLink']}")
            if pattern['isLink']:
                print(f"   Href: {pattern['href']}")
            print("   ---")
        
        print("\n✅ Debug analysis complete!")
        print("\n💡 Next steps:")
        print("   - Check if store numbers are actually clickable links")
        print("   - Verify the customer URL extraction is looking in the right place")
        print("   - Update the extraction logic based on actual page structure")
        
    except Exception as e:
        logger.error(f"Debug failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation_service.cleanup_session(session_id)

if __name__ == "__main__":
    asyncio.run(debug_customer_url_extraction())
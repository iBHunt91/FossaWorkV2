#!/usr/bin/env python3
"""
Save the work orders page HTML for manual inspection
"""

import asyncio
import logging
import sys
from pathlib import Path
from datetime import datetime

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def save_page_html():
    """Save the work orders page HTML after login"""
    
    from app.services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
    
    try:
        # Create automation service
        automation = WorkFossaAutomationService(headless=False)
        await automation.initialize_browser()
        
        # Create session
        session_id = "html_save"
        user_id = "test"
        
        # Use demo credentials
        cred_file = backend_dir / "data" / "credentials" / "demo.cred"
        if not cred_file.exists():
            logger.error("Demo credentials not found")
            return
            
        # For now, use placeholder credentials
        credentials = WorkFossaCredentials(
            email="placeholder@example.com",
            password="placeholder",
            user_id=user_id
        )
        
        logger.info("⚠️  Please log in manually when the browser opens")
        
        await automation.create_session(session_id, user_id, credentials)
        session = automation.sessions[session_id]
        page = session['page']
        
        # Navigate to login
        await page.goto("https://app.workfossa.com")
        
        # Wait for manual login
        logger.info("Please log in manually in the browser...")
        await asyncio.sleep(30)  # Give 30 seconds to log in
        
        # Navigate to work orders
        logger.info("Navigating to work orders...")
        await page.goto("https://app.workfossa.com/app/work/list", wait_until="networkidle")
        await page.wait_for_timeout(5000)
        
        # Save page content
        html_content = await page.content()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"work_orders_page_{timestamp}.html"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        logger.info(f"✅ Page HTML saved to: {filename}")
        
        # Also get dropdown info
        logger.info("Analyzing dropdowns on page...")
        
        dropdown_info = await page.evaluate("""
            () => {
                const results = {
                    selects: [],
                    customDropdowns: [],
                    elementsWithPageSize: []
                };
                
                // Find all select elements
                document.querySelectorAll('select').forEach((select, i) => {
                    results.selects.push({
                        index: i,
                        name: select.name || '',
                        id: select.id || '',
                        className: select.className || '',
                        value: select.value || '',
                        innerHTML: select.innerHTML.substring(0, 500),
                        options: Array.from(select.options).map(opt => ({
                            value: opt.value,
                            text: opt.textContent.trim()
                        }))
                    });
                });
                
                // Find elements that might be custom dropdowns
                ['button', 'div', 'span'].forEach(tag => {
                    document.querySelectorAll(tag).forEach(el => {
                        const text = el.textContent || '';
                        if (text.includes('25') || text.includes('per page') || text.includes('show')) {
                            results.customDropdowns.push({
                                tag: el.tagName.toLowerCase(),
                                id: el.id || '',
                                className: el.className || '',
                                text: text.trim().substring(0, 100),
                                innerHTML: el.innerHTML.substring(0, 200)
                            });
                        }
                    });
                });
                
                // Find any element mentioning page size
                document.querySelectorAll('*').forEach(el => {
                    const text = el.textContent || '';
                    if (text.match(/page\s*size|per\s*page|show\s*\d+/i)) {
                        results.elementsWithPageSize.push({
                            tag: el.tagName.toLowerCase(),
                            id: el.id || '',
                            className: el.className || '',
                            text: text.trim().substring(0, 100)
                        });
                    }
                });
                
                return results;
            }
        """)
        
        # Save dropdown analysis
        import json
        with open(f"dropdown_analysis_{timestamp}.json", 'w') as f:
            json.dump(dropdown_info, f, indent=2)
        
        logger.info(f"✅ Dropdown analysis saved to: dropdown_analysis_{timestamp}.json")
        logger.info(f"Found {len(dropdown_info['selects'])} select elements")
        logger.info(f"Found {len(dropdown_info['customDropdowns'])} potential custom dropdowns")
        
        # Print select details
        if dropdown_info['selects']:
            logger.info("\n📋 SELECT ELEMENTS FOUND:")
            for select in dropdown_info['selects']:
                logger.info(f"  - Select {select['index']+1}: name='{select['name']}', id='{select['id']}', class='{select['className']}'")
                logger.info(f"    Options: {[opt['value'] for opt in select['options']]}")
        
        await page.screenshot(path=f"work_orders_analyzed_{timestamp}.png", full_page=True)
        logger.info(f"📸 Screenshot saved: work_orders_analyzed_{timestamp}.png")
        
        # Keep browser open
        logger.info("Browser will stay open for inspection...")
        await asyncio.sleep(60)
        
        await automation.cleanup_session(session_id)
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(save_page_html())
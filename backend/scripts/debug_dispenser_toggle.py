#!/usr/bin/env python3
"""
Debug the dispenser toggle DOM structure
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager


async def debug_dispenser_toggle():
    """Debug the dispenser toggle structure"""
    print("🔍 Debugging Dispenser Toggle Structure")
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
    
    # Create service
    automation = WorkFossaAutomationService(headless=False)
    
    try:
        # Create session and login
        session_id = "debug_toggle"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Navigate to customer page
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        # Click Equipment tab
        print("\n🔧 Clicking Equipment tab...")
        await page.click('text="Equipment"')
        await page.wait_for_timeout(2000)
        
        # Close modal if present
        try:
            cancel = await page.query_selector('button:has-text("Cancel")')
            if cancel:
                print("📋 Closing modal...")
                await cancel.click()
                await page.wait_for_timeout(1000)
        except:
            pass
        
        # Debug the dispenser toggle
        print("\n🔍 Analyzing Dispenser Toggle...")
        
        toggle_info = await page.evaluate("""
            () => {
                const results = {
                    found: false,
                    elements: [],
                    nextSiblings: [],
                    parentStructure: []
                };
                
                // Find all elements that might be the dispenser toggle
                const allElements = document.querySelectorAll('*');
                
                for (const el of allElements) {
                    const text = el.textContent ? el.textContent.trim() : '';
                    
                    // Look for "Dispenser (8)" or similar
                    if (text.match(/^Dispenser\\s*\\(\\d+\\)$/)) {
                        results.found = true;
                        
                        const info = {
                            tagName: el.tagName,
                            text: text,
                            href: el.getAttribute('href'),
                            dataTarget: el.getAttribute('data-target'),
                            dataBsTarget: el.getAttribute('data-bs-target'),
                            dataToggle: el.getAttribute('data-toggle'),
                            dataBsToggle: el.getAttribute('data-bs-toggle'),
                            ariaExpanded: el.getAttribute('aria-expanded'),
                            ariaControls: el.getAttribute('aria-controls'),
                            classes: el.className,
                            id: el.id,
                            onclick: el.onclick ? 'has onclick handler' : null,
                            role: el.getAttribute('role')
                        };
                        
                        // Check next sibling
                        const nextSibling = el.nextElementSibling;
                        if (nextSibling) {
                            info.nextSibling = {
                                tagName: nextSibling.tagName,
                                classes: nextSibling.className,
                                id: nextSibling.id,
                                style: nextSibling.style.display,
                                childCount: nextSibling.children.length
                            };
                        }
                        
                        // Check parent structure
                        let parent = el.parentElement;
                        const parents = [];
                        for (let i = 0; i < 3 && parent; i++) {
                            parents.push({
                                tagName: parent.tagName,
                                classes: parent.className,
                                id: parent.id
                            });
                            parent = parent.parentElement;
                        }
                        info.parents = parents;
                        
                        results.elements.push(info);
                        
                        // Also check for any collapsible content nearby
                        const possibleTargets = el.parentElement.querySelectorAll('.collapse, .collapsible, [style*="display: none"]');
                        info.nearbyCollapsibles = Array.from(possibleTargets).map(t => ({
                            tagName: t.tagName,
                            classes: t.className,
                            id: t.id,
                            style: t.style.display
                        }));
                    }
                }
                
                return results;
            }
        """)
        
        if toggle_info['found']:
            print("✅ Found Dispenser toggle(s):")
            for i, element in enumerate(toggle_info['elements']):
                print(f"\n📋 Toggle {i+1}:")
                print(f"   Tag: {element['tagName']}")
                print(f"   Text: {element['text']}")
                print(f"   Classes: {element['classes']}")
                print(f"   ID: {element['id']}")
                print(f"   href: {element['href']}")
                print(f"   data-target: {element['dataTarget']}")
                print(f"   data-bs-target: {element['dataBsTarget']}")
                print(f"   data-toggle: {element['dataToggle']}")
                print(f"   data-bs-toggle: {element['dataBsToggle']}")
                print(f"   aria-expanded: {element['ariaExpanded']}")
                print(f"   aria-controls: {element['ariaControls']}")
                print(f"   onclick: {element['onclick']}")
                print(f"   role: {element['role']}")
                
                if element.get('nextSibling'):
                    print(f"\n   Next Sibling:")
                    print(f"      Tag: {element['nextSibling']['tagName']}")
                    print(f"      Classes: {element['nextSibling']['classes']}")
                    print(f"      ID: {element['nextSibling']['id']}")
                    print(f"      Display: {element['nextSibling']['style']}")
                    print(f"      Children: {element['nextSibling']['childCount']}")
                
                if element.get('nearbyCollapsibles'):
                    print(f"\n   Nearby Collapsibles: {len(element['nearbyCollapsibles'])}")
                    for col in element['nearbyCollapsibles']:
                        print(f"      - {col['tagName']} #{col['id']} .{col['classes']} (display: {col['style']})")
        else:
            print("❌ Dispenser toggle not found")
        
        # Try clicking with different methods
        print("\n🧪 Testing Click Methods...")
        
        # Method 1: Simple click
        print("\n1️⃣ Simple click on 'Dispenser (8)'...")
        try:
            await page.click('text=/Dispenser \\(\\d+\\)/')
            print("   ✅ Click successful")
            await page.wait_for_timeout(1000)
        except Exception as e:
            print(f"   ❌ Click failed: {e}")
        
        # Check if content appeared
        container_count = await page.locator('div.py-1\\.5').count()
        print(f"   Container count after click: {container_count}")
        
        # Check for dispenser content
        has_content = await page.evaluate("""
            () => {
                const body = document.body.textContent || '';
                return body.includes('S/N:') || body.includes('MAKE:') || body.includes('Gilbarco');
            }
        """)
        print(f"   Has dispenser content: {has_content}")
        
        print("\n⏸️  Browser remains open for manual inspection...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(debug_dispenser_toggle())
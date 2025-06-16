#!/usr/bin/env python3
"""
Find the actual mechanism that expands/collapses the dispenser section
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
from app.services.content_based_wait import ContentBasedWait


async def find_dispenser_mechanism():
    """Find how the dispenser section expands"""
    print("🔍 Finding Dispenser Expand/Collapse Mechanism")
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
        session_id = "find_mechanism"
        await automation.create_session(session_id, user_id, credentials)
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        page = session_data['page']
        
        # Navigate and setup
        customer_url = "https://app.workfossa.com/app/customers/locations/32951/"
        print(f"\n📍 Navigating to: {customer_url}")
        await page.goto(customer_url, wait_until="domcontentloaded")
        
        await ContentBasedWait.wait_for_equipment_tab(page)
        await page.click('text="Equipment"')
        await ContentBasedWait.wait_for_loader_to_disappear(page)
        await ContentBasedWait.wait_for_modal_and_close(page)
        
        print("\n🔍 Analyzing page structure around Dispenser...")
        
        # Look for collapsible/expandable content patterns
        structure_analysis = await page.evaluate("""
            () => {
                const results = {
                    dispenserElements: [],
                    collapsibleSections: [],
                    hiddenElements: [],
                    eventListeners: []
                };
                
                // Find all elements with Dispenser text
                const allElements = document.querySelectorAll('*');
                
                for (const el of allElements) {
                    const text = el.textContent ? el.textContent.trim() : '';
                    
                    if (text.includes('Dispenser') && text.includes('(')) {
                        // Look for nearby collapsible content
                        const parent = el.parentElement;
                        const grandparent = parent ? parent.parentElement : null;
                        
                        // Check siblings
                        const nextSibling = el.nextElementSibling;
                        const parentNextSibling = parent ? parent.nextElementSibling : null;
                        
                        results.dispenserElements.push({
                            text: text.substring(0, 50),
                            tag: el.tagName,
                            classes: el.className,
                            hasNextSibling: !!nextSibling,
                            nextSiblingTag: nextSibling ? nextSibling.tagName : null,
                            nextSiblingClasses: nextSibling ? nextSibling.className : null,
                            nextSiblingDisplay: nextSibling ? window.getComputedStyle(nextSibling).display : null,
                            parentTag: parent ? parent.tagName : null,
                            parentClasses: parent ? parent.className : null,
                            parentNextSibling: parentNextSibling ? {
                                tag: parentNextSibling.tagName,
                                classes: parentNextSibling.className,
                                display: window.getComputedStyle(parentNextSibling).display,
                                children: parentNextSibling.children.length
                            } : null
                        });
                    }
                }
                
                // Find all collapsed/hidden elements
                document.querySelectorAll('.collapse, .collapsed, [style*="display: none"], [style*="display:none"]').forEach(el => {
                    results.collapsibleSections.push({
                        tag: el.tagName,
                        classes: el.className,
                        id: el.id,
                        display: window.getComputedStyle(el).display,
                        parentClasses: el.parentElement ? el.parentElement.className : null
                    });
                });
                
                // Find elements with expand/collapse attributes
                document.querySelectorAll('[data-toggle], [data-bs-toggle], [aria-expanded], [aria-controls]').forEach(el => {
                    const text = el.textContent ? el.textContent.trim() : '';
                    if (text.includes('Dispenser')) {
                        results.eventListeners.push({
                            tag: el.tagName,
                            text: text.substring(0, 50),
                            dataToggle: el.getAttribute('data-toggle'),
                            dataBsToggle: el.getAttribute('data-bs-toggle'),
                            ariaExpanded: el.getAttribute('aria-expanded'),
                            ariaControls: el.getAttribute('aria-controls'),
                            href: el.getAttribute('href'),
                            onclick: el.onclick ? 'has onclick' : null
                        });
                    }
                });
                
                return results;
            }
        """)
        
        print("\n📊 Structure Analysis Results:")
        print(f"\nDispenser Elements: {len(structure_analysis['dispenserElements'])}")
        for elem in structure_analysis['dispenserElements']:
            print(f"\n   Element: {elem['tag']} - {elem['text']}")
            print(f"   Classes: {elem['classes']}")
            if elem['parentNextSibling']:
                print(f"   Parent's next sibling: {elem['parentNextSibling']['tag']} "
                      f"(display: {elem['parentNextSibling']['display']}, "
                      f"children: {elem['parentNextSibling']['children']})")
        
        print(f"\nCollapsible Sections: {len(structure_analysis['collapsibleSections'])}")
        for section in structure_analysis['collapsibleSections'][:5]:  # First 5
            print(f"   {section['tag']}#{section['id']} .{section['classes']} (display: {section['display']})")
        
        print(f"\nEvent Listeners on Dispenser: {len(structure_analysis['eventListeners'])}")
        for listener in structure_analysis['eventListeners']:
            print(f"   {listener['tag']}: {listener['text']}")
            print(f"      data-toggle: {listener['dataToggle']}")
            print(f"      aria-expanded: {listener['ariaExpanded']}")
            print(f"      href: {listener['href']}")
        
        # Try a different approach - look for the pattern in our manual test
        print("\n🧪 Testing manual expansion approach...")
        
        # Simulate what happens when clicking manually
        expansion_result = await page.evaluate("""
            () => {
                // Find the dispenser link
                const dispenserLink = Array.from(document.querySelectorAll('a')).find(a => 
                    a.textContent && a.textContent.trim().match(/^Dispenser\\s*\\(\\d+\\)$/)
                );
                
                if (!dispenserLink) {
                    return { error: 'Dispenser link not found' };
                }
                
                // Check what happens on manual click
                const results = {
                    linkInfo: {
                        tag: dispenserLink.tagName,
                        href: dispenserLink.getAttribute('href'),
                        classes: dispenserLink.className,
                        parent: dispenserLink.parentElement ? dispenserLink.parentElement.className : null
                    },
                    beforeClick: {},
                    afterClick: {}
                };
                
                // Get state before click
                const parent = dispenserLink.parentElement;
                const grandparent = parent ? parent.parentElement : null;
                
                // Look for the container that will expand
                let expandTarget = null;
                
                // Common patterns:
                // 1. Next sibling of parent
                if (parent && parent.nextElementSibling) {
                    expandTarget = parent.nextElementSibling;
                }
                // 2. Next sibling of grandparent
                else if (grandparent && grandparent.nextElementSibling) {
                    expandTarget = grandparent.nextElementSibling;
                }
                
                if (expandTarget) {
                    results.beforeClick = {
                        tag: expandTarget.tagName,
                        classes: expandTarget.className,
                        display: window.getComputedStyle(expandTarget).display,
                        height: expandTarget.offsetHeight,
                        childCount: expandTarget.children.length
                    };
                    
                    // Try to expand it directly
                    expandTarget.style.display = 'block';
                    expandTarget.classList.remove('collapse', 'collapsed');
                    expandTarget.classList.add('show', 'expanded');
                    
                    // Wait a bit
                    setTimeout(() => {
                        results.afterClick = {
                            display: window.getComputedStyle(expandTarget).display,
                            height: expandTarget.offsetHeight,
                            childCount: expandTarget.children.length
                        };
                    }, 100);
                }
                
                return results;
            }
        """)
        
        print(f"\nExpansion test result: {expansion_result}")
        
        # Wait and check final state
        await asyncio.sleep(2)
        
        container_count = await page.locator('div.py-1\\.5').count()
        print(f"\nFinal container count: {container_count}")
        
        # Check if dispenser content is now visible
        has_content = await page.evaluate("""
            () => {
                const text = document.body.textContent || '';
                return {
                    hasSerialNumbers: text.includes('S/N:') || text.includes('Serial'),
                    hasMake: text.includes('MAKE:') || text.includes('Gilbarco'),
                    hasModel: text.includes('MODEL:'),
                    visibleContainers: document.querySelectorAll('div.py-1\\\\.5:not([style*="display: none"])').length
                };
            }
        """)
        
        print(f"\nContent visibility check: {has_content}")
        
        print("\n⏸️  Browser remains open for manual inspection...")
        print("   Try clicking Dispenser manually and observe what happens")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await automation.cleanup_session(session_id)
        print("\n✅ Done")


if __name__ == "__main__":
    asyncio.run(find_dispenser_mechanism())
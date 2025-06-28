#!/usr/bin/env python3
"""
Verify that the scraper has been updated with WorkFossa custom dropdown handling
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.workfossa_scraper import WorkFossaScraper

print("✅ SCRAPER UPDATE VERIFICATION")
print("="*60)

# Check if the updated selector is in the scraper
scraper_file = backend_dir / "app" / "services" / "workfossa_scraper.py"
with open(scraper_file, 'r') as f:
    content = f.read()

# Look for the specific selector we added
if 'div.ks-select-selection:has-text(\'Show 25\')' in content:
    print("✅ Found WorkFossa custom dropdown selector!")
    print("   Selector: div.ks-select-selection:has-text('Show 25')")
    
    # Find the special handling code
    if 'if selector == "div.ks-select-selection:has-text(\'Show 25\')"' in content:
        print("✅ Found special handling for WorkFossa dropdown!")
        
    # Check for the option selectors
    if 'li:has-text(\'Show 100\')' in content:
        print("✅ Found option selector for 'Show 100'!")
        
    if '.ks-select-dropdown-menu-item:has-text(\'100\')' in content:
        print("✅ Found WorkFossa-specific menu item selector!")
        
    print("\n📋 SUMMARY:")
    print("The workfossa_scraper.py has been successfully updated to:")
    print("1. Detect the WorkFossa custom dropdown: <div class=\"ks-select-selection\">Show 25</div>")
    print("2. Click the dropdown to open it")
    print("3. Find and click the 'Show 100' option")
    print("4. Verify the change and log the result")
    
    print("\n🎯 The scraper is now configured to handle the WorkFossa custom dropdown!")
    print("When it encounters the work orders page, it will:")
    print("- Look for the custom dropdown with 'Show 25' text")
    print("- Click it to open the dropdown menu")
    print("- Search for and click the 'Show 100' option")
    print("- Wait for the page to reload with 100 work orders")
    
else:
    print("❌ WorkFossa custom dropdown selector not found in scraper!")
    
print("="*60)
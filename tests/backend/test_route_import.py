#!/usr/bin/env python3
"""
Test if the routes can be imported without errors
"""

import os
import sys
import traceback

# Change to backend directory
os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')
sys.path.insert(0, '/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

print("=== Route Import Test ===")

try:
    print("1. Testing auth route import...")
    from app.routes import auth
    print("✓ Auth route imported successfully")
    
    print("2. Testing scraping schedules route import...")
    from app.routes import scraping_schedules
    print("✓ Scraping schedules route imported successfully")
    
    print("3. Testing main app import...")
    from app.main import app
    print("✓ Main app imported successfully")
    
    print("4. Testing specific route functions...")
    print(f"  - Auth functions: {[name for name in dir(auth) if not name.startswith('_')]}")
    print(f"  - Scraping functions: {[name for name in dir(scraping_schedules) if not name.startswith('_')]}")
    
except Exception as e:
    print(f"❌ Import error: {e}")
    traceback.print_exc()

print("\n=== Import Test Complete ===")
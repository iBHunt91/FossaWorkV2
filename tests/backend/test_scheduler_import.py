#!/usr/bin/env python3
"""
Test scheduler service import issues
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

def test_scheduler_import():
    print("=== Testing Scheduler Service Import ===")
    
    try:
        print("1. Testing direct import...")
        
        # Try to import scheduler service
        try:
            from app.services.scheduler_service import scheduler_service
            print(f"✓ Scheduler service imported: {type(scheduler_service)}")
            print(f"  - Has is_initialized: {hasattr(scheduler_service, 'is_initialized')}")
            print(f"  - Is initialized: {getattr(scheduler_service, 'is_initialized', 'N/A')}")
        except ImportError as e:
            print(f"❌ Scheduler service import failed: {e}")
            scheduler_service = None
        
        print("\n2. Testing scraping models import...")
        
        try:
            from app.models.scraping_models import ScrapingSchedule
            print("✓ ScrapingSchedule model imported successfully")
        except ImportError as e:
            print(f"❌ ScrapingSchedule import failed: {e}")
            traceback.print_exc()
        
        print("\n3. Testing route function import...")
        
        try:
            from app.routes.scraping_schedules import get_schedules
            print("✓ get_schedules function imported successfully")
        except ImportError as e:
            print(f"❌ get_schedules import failed: {e}")
            traceback.print_exc()
        
        print("\n4. Testing all dependencies...")
        
        try:
            from app.database import get_db
            from app.auth.dependencies import get_current_user
            from app.models.user_models import User
            from app.services.logging_service import get_logger
            print("✓ All dependencies imported successfully")
        except ImportError as e:
            print(f"❌ Dependency import failed: {e}")
            traceback.print_exc()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Full traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    test_scheduler_import()
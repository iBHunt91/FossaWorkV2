#!/usr/bin/env python3
"""
Test scheduler job execution with fixed credentials
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import the scheduler function
from app.services.scheduler_service import execute_work_order_scraping

async def test_scheduler_execution():
    """Test the scheduler job execution directly"""
    print("=== Testing Scheduler Job Execution ===\n")
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Bruce's user ID
    
    print(f"🚀 Testing work order scraping for user: {user_id}")
    print("This will test the actual scheduler job function...\n")
    
    try:
        # Call the scheduler function directly
        await execute_work_order_scraping(user_id, trigger_type="manual_test")
        print("\n✅ Scheduler job completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Scheduler job failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scheduler_execution())
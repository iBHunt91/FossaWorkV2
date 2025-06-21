#!/usr/bin/env python3
"""
Test the actual job execution function
"""

import sys
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.scheduler_service import execute_work_order_scraping

async def test_job_execution():
    print("🔍 Testing Job Execution")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    print(f"Testing scheduled job for user: {user_id}")
    print("\nThis will attempt to:")
    print("1. Retrieve credentials")
    print("2. Create browser session") 
    print("3. Login to WorkFossa")
    print("4. Scrape work orders")
    print("5. Save to database")
    print()
    
    try:
        print("Starting job execution...")
        await execute_work_order_scraping(user_id)
        print("\n✅ Job executed successfully!")
        
    except Exception as e:
        print(f"\n❌ Job failed with error: {e}")
        import traceback
        traceback.print_exc()
        
        print("\n" + "=" * 50)
        print("DIAGNOSIS:")
        
        if "credential" in str(e).lower():
            print("- Credential issue detected")
            print("- Make sure user has valid WorkFossa credentials stored")
            
        elif "browser" in str(e).lower():
            print("- Browser automation issue")
            print("- Check if Playwright browsers are installed")
            
        elif "login" in str(e).lower():
            print("- Login failed")
            print("- Credentials might be incorrect or WorkFossa might be down")
            
        else:
            print("- Unknown error")
            print("- Check the full traceback above")

if __name__ == "__main__":
    asyncio.run(test_job_execution())
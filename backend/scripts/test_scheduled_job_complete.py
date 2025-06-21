#!/usr/bin/env python3
"""
Complete test of scheduled job execution with the new credential retrieval
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.scheduler_service import execute_work_order_scraping
from app.database import SessionLocal
from app.models import UserCredential

async def test_complete_job_execution():
    print("🔍 Testing Complete Scheduled Job Execution")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # First check if credentials exist in database
    print("\n1. Checking database credentials...")
    db = SessionLocal()
    try:
        creds = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa",
            UserCredential.is_active == True
        ).first()
        
        if creds:
            print("✅ Found credentials in database")
            print(f"   Username stored: Yes")
            print(f"   Password stored: Yes")
            print(f"   Created: {creds.created_at}")
            print(f"   Updated: {creds.updated_at}")
        else:
            print("❌ No credentials found in database")
            print("   The scheduled job will fail without credentials")
            return
    finally:
        db.close()
    
    # Now test the actual job execution
    print("\n2. Testing job execution with new credential retrieval...")
    print("\nThis will:")
    print("- Retrieve credentials from database (no FOSSAWORK_MASTER_KEY needed)")
    print("- Create browser session")
    print("- Login to WorkFossa") 
    print("- Scrape work orders")
    print("- Save to database")
    print()
    
    try:
        print("Starting job execution...")
        print("-" * 30)
        
        # Run the actual job
        await execute_work_order_scraping(user_id)
        
        print("-" * 30)
        print("\n✅ JOB EXECUTED SUCCESSFULLY!")
        print("\nThe scheduled scrape at 9:30 AM should work correctly.")
        
    except Exception as e:
        print(f"\n❌ Job failed with error: {e}")
        import traceback
        traceback.print_exc()
        
        print("\n" + "=" * 50)
        print("DIAGNOSIS:")
        
        error_str = str(e).lower()
        if "credential" in error_str:
            print("- Credential issue detected")
            print("- Check if user has valid WorkFossa credentials in database")
        elif "browser" in error_str:
            print("- Browser automation issue")
            print("- Check if Playwright browsers are installed")
        elif "login" in error_str:
            print("- Login failed")
            print("- Credentials might be incorrect or WorkFossa might be down")
        else:
            print("- Check the full traceback above")

if __name__ == "__main__":
    asyncio.run(test_complete_job_execution())
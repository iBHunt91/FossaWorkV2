#!/usr/bin/env python3
"""
Test script to verify sync progress tracking
"""
import asyncio
import sys
from pathlib import Path

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.routes.work_orders import scraping_progress

async def test_sync_progress():
    """Test sync progress tracking"""
    user_id = "test_user"
    
    print("=== Testing Sync Progress Tracking ===")
    print(f"1. Initial state - Progress for user {user_id}:", scraping_progress.get(user_id))
    
    # Simulate progress updates
    print("\n2. Adding in_progress status...")
    scraping_progress[user_id] = {
        "status": "in_progress",
        "phase": "scraping",
        "percentage": 45,
        "message": "Scraping work orders...",
        "work_orders_found": 5
    }
    print(f"   Progress: {scraping_progress[user_id]}")
    
    # Wait a bit
    await asyncio.sleep(2)
    
    # Update progress
    print("\n3. Updating progress...")
    scraping_progress[user_id]["percentage"] = 75
    scraping_progress[user_id]["message"] = "Saving to database..."
    print(f"   Progress: {scraping_progress[user_id]}")
    
    # Complete
    await asyncio.sleep(2)
    print("\n4. Marking as completed...")
    scraping_progress[user_id]["status"] = "completed"
    scraping_progress[user_id]["percentage"] = 100
    scraping_progress[user_id]["message"] = "Sync completed successfully"
    print(f"   Progress: {scraping_progress[user_id]}")
    
    # Check if cleanup happens
    print("\n5. Waiting for cleanup (should happen after 10 seconds)...")
    for i in range(15):
        await asyncio.sleep(1)
        if user_id not in scraping_progress:
            print(f"   Progress cleaned up after {i+1} seconds")
            break
        if i == 14:
            print(f"   Progress still exists after 15 seconds: {scraping_progress.get(user_id)}")
    
    print("\n6. Final state:", scraping_progress.get(user_id))
    print("\nTest complete!")

if __name__ == "__main__":
    asyncio.run(test_sync_progress())
#!/usr/bin/env python3
"""
Test manual trigger with progress tracking
"""

import sys
import asyncio
from pathlib import Path
import time

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set environment variables before imports
import os
os.environ['SECRET_KEY'] = 'test_secret_key_for_testing'

from app.services.scheduler_service import execute_work_order_scraping

async def test_manual_trigger_with_progress():
    print("🔍 Testing Manual Trigger with Progress Tracking")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    print(f"\n1. Starting manual trigger for user: {user_id}")
    
    # Start the scraping in the background
    task = asyncio.create_task(execute_work_order_scraping(user_id))
    
    print("\n2. Monitoring progress...")
    print("(This simulates what the frontend sees)\n")
    
    last_percentage = -1
    start_time = time.time()
    
    # Import progress after starting the task
    from app.routes.work_orders import scraping_progress
    
    while True:
        # Check progress
        if user_id in scraping_progress:
            progress = scraping_progress[user_id]
            current_percentage = progress.get("percentage", 0)
            
            # Only print when percentage changes
            if current_percentage != last_percentage:
                print(f"[{time.time() - start_time:.1f}s] "
                      f"{progress.get('phase', 'unknown')} - "
                      f"{current_percentage:.0f}% - "
                      f"{progress.get('message', 'No message')}")
                last_percentage = current_percentage
            
            # Check if completed
            if progress.get("status") in ["completed", "failed"]:
                print(f"\n✅ Scraping {progress.get('status')}!")
                if progress.get("error"):
                    print(f"Error: {progress.get('error')}")
                break
        
        # Wait a bit
        await asyncio.sleep(0.5)
        
        # Timeout after 2 minutes
        if time.time() - start_time > 120:
            print("\n❌ Timeout waiting for completion")
            break
    
    # Wait for task to complete
    try:
        await asyncio.wait_for(task, timeout=5)
    except asyncio.TimeoutError:
        print("Task still running...")
    
    print("\n3. Final progress state:")
    if user_id in scraping_progress:
        progress = scraping_progress[user_id]
        print(f"   Status: {progress.get('status')}")
        print(f"   Phase: {progress.get('phase')}")
        print(f"   Percentage: {progress.get('percentage')}%")
        print(f"   Message: {progress.get('message')}")
        print(f"   Work orders found: {progress.get('work_orders_found', 0)}")
    else:
        print("   No progress data found")

if __name__ == "__main__":
    asyncio.run(test_manual_trigger_with_progress())
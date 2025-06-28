#!/usr/bin/env python3
"""
Manually trigger work order scraping now
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.scheduler_service import execute_work_order_scraping

async def trigger_scrape():
    print("🚀 Manually Triggering Work Order Scraping")
    print("=" * 50)
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    print(f"User ID: {user_id}")
    print("\nStarting scrape...")
    
    try:
        await execute_work_order_scraping(user_id)
        print("\n✅ Scraping completed!")
    except Exception as e:
        print(f"\n❌ Error during scraping: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(trigger_scrape())
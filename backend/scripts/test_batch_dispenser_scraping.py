#!/usr/bin/env python3
"""
Test script for batch dispenser scraping endpoint
"""

import asyncio
import httpx
import time
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# API base URL
BASE_URL = "http://localhost:8000/api/v1"

# Test user ID - replace with actual user ID after login
USER_ID = None


async def test_batch_dispenser_scraping():
    """Test the batch dispenser scraping functionality"""
    global USER_ID
    
    print("🧪 Testing Batch Dispenser Scraping")
    print("=" * 60)
    
    async with httpx.AsyncClient() as client:
        # First, get test user ID (using the first user found)
        try:
            response = await client.get(f"{BASE_URL}/setup/status")
            if response.status_code == 200:
                data = response.json()
                if data.get("has_users") and data.get("test_user_id"):
                    USER_ID = data["test_user_id"]
                    print(f"✅ Using test user ID: {USER_ID}")
                else:
                    print("❌ No test user found. Please log in first.")
                    return
        except Exception as e:
            print(f"❌ Failed to get test user: {e}")
            return
        
        # 1. Trigger batch dispenser scraping
        print("\n📋 Starting batch dispenser scraping...")
        try:
            response = await client.post(
                f"{BASE_URL}/work-orders/scrape-dispensers-batch",
                params={"user_id": USER_ID}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Batch scraping initiated: {data['message']}")
                print(f"   Work orders to process: {data.get('work_order_count', 0)}")
                
                if data['status'] == 'no_work_orders':
                    print("⚠️  No work orders with dispenser service codes found.")
                    print("   Make sure you have work orders with service codes: 2861, 2862, 3146, or 3002")
                    return
            else:
                print(f"❌ Failed to start batch scraping: {response.status_code}")
                print(f"   Error: {response.text}")
                return
                
        except Exception as e:
            print(f"❌ Error starting batch scraping: {e}")
            return
        
        # 2. Monitor progress
        print("\n📊 Monitoring scraping progress...")
        start_time = time.time()
        max_wait_time = 300  # 5 minutes max
        
        while True:
            try:
                response = await client.get(
                    f"{BASE_URL}/work-orders/scrape-dispensers/progress/{USER_ID}"
                )
                
                if response.status_code == 200:
                    progress = response.json()
                    
                    # Display progress
                    status = progress.get('status', 'unknown')
                    phase = progress.get('phase', 'unknown')
                    percentage = progress.get('percentage', 0)
                    message = progress.get('message', '')
                    total = progress.get('total_work_orders', 0)
                    processed = progress.get('processed', 0)
                    successful = progress.get('successful', 0)
                    failed = progress.get('failed', 0)
                    
                    print(f"\r[{phase}] {percentage:.0f}% - {message}", end='')
                    
                    if total > 0:
                        print(f" ({processed}/{total} processed, {successful} ✅, {failed} ❌)", end='')
                    
                    # Check if completed or failed
                    if status in ['completed', 'failed']:
                        print()  # New line
                        if status == 'completed':
                            print(f"\n✅ Batch scraping completed!")
                            print(f"   Total work orders: {total}")
                            print(f"   Successful: {successful}")
                            print(f"   Failed: {failed}")
                            print(f"   Time taken: {time.time() - start_time:.1f} seconds")
                        else:
                            print(f"\n❌ Batch scraping failed!")
                            print(f"   Error: {progress.get('error', 'Unknown error')}")
                        break
                    
                    # Check timeout
                    if time.time() - start_time > max_wait_time:
                        print(f"\n⏱️  Timeout after {max_wait_time} seconds")
                        break
                    
                else:
                    print(f"\n❌ Failed to get progress: {response.status_code}")
                    break
                    
            except Exception as e:
                print(f"\n❌ Error monitoring progress: {e}")
                break
            
            # Wait before next check
            await asyncio.sleep(1)
        
        # 3. Fetch work orders to see updated dispenser data
        print("\n📋 Fetching work orders to verify dispenser data...")
        try:
            response = await client.get(
                f"{BASE_URL}/work-orders/",
                params={"user_id": USER_ID}
            )
            
            if response.status_code == 200:
                work_orders = response.json()
                
                # Filter work orders with dispenser service codes
                dispenser_work_orders = [
                    wo for wo in work_orders 
                    if wo.get('service_code') in ['2861', '2862', '3146', '3002']
                ]
                
                print(f"\n✅ Found {len(dispenser_work_orders)} work orders with dispenser service codes:")
                
                for wo in dispenser_work_orders[:5]:  # Show first 5
                    print(f"\n   Work Order: {wo['external_id']}")
                    print(f"   Site: {wo['site_name']}")
                    print(f"   Service: {wo.get('service_code', 'N/A')} - {wo.get('service_description', 'N/A')}")
                    
                    # Check dispensers
                    dispensers = wo.get('dispensers', [])
                    if dispensers:
                        print(f"   Dispensers: {len(dispensers)}")
                        for disp in dispensers[:2]:  # Show first 2 dispensers
                            print(f"     - Dispenser {disp.get('dispenser_number', 'N/A')}: {disp.get('dispenser_type', 'Unknown')}")
                            if disp.get('fuel_grades'):
                                print(f"       Fuel grades: {', '.join(disp['fuel_grades'].keys())}")
                    else:
                        print("   Dispensers: None found")
                    
                    # Check scraped data
                    scraped_data = wo.get('scraped_data', {})
                    if scraped_data.get('dispenser_scrape_date'):
                        print(f"   Last scraped: {scraped_data['dispenser_scrape_date']}")
                
                if len(dispenser_work_orders) > 5:
                    print(f"\n   ... and {len(dispenser_work_orders) - 5} more work orders")
                    
            else:
                print(f"❌ Failed to fetch work orders: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error fetching work orders: {e}")
    
    print("\n✅ Batch dispenser scraping test completed!")


if __name__ == "__main__":
    asyncio.run(test_batch_dispenser_scraping())
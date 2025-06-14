#!/usr/bin/env python3
"""
Test the complete dispenser scraping workflow with fixes
"""
import requests
import json
import time
import sys

# API configuration
BASE_URL = "http://localhost:8000/api/v1"

def test_complete_workflow():
    """Test the complete workflow: scrape work orders, then dispensers"""
    
    print("🧪 Testing Complete Dispenser Scraping Workflow")
    print("="*60)
    
    # Use a known user ID
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    print("\n📋 Test Plan:")
    print("   1. Clear existing work orders")
    print("   2. Scrape fresh work orders (with fixed customer URL extraction)")
    print("   3. Verify customer URLs were extracted")
    print("   4. Run dispenser scraping")
    print("   5. Verify dispensers were scraped")
    
    try:
        # Step 1: Clear existing work orders
        print("\n1️⃣ Clearing existing work orders...")
        clear_response = requests.delete(f"{BASE_URL}/work-orders/clear-all?user_id={user_id}")
        if clear_response.status_code == 200:
            result = clear_response.json()
            print(f"   ✅ Cleared {result.get('deleted_work_orders', 0)} work orders")
        else:
            print(f"   ⚠️  Failed to clear: {clear_response.status_code}")
        
        # Step 2: Scrape fresh work orders
        print("\n2️⃣ Scraping fresh work orders...")
        scrape_response = requests.post(f"{BASE_URL}/work-orders/scrape?user_id={user_id}")
        
        if scrape_response.status_code == 200:
            print("   ✅ Work order scraping initiated")
            
            # Monitor progress
            print("   ⏳ Monitoring progress...")
            max_wait = 60  # Wait up to 60 seconds
            start_time = time.time()
            
            while time.time() - start_time < max_wait:
                progress_response = requests.get(f"{BASE_URL}/work-orders/scrape/progress/{user_id}")
                if progress_response.status_code == 200:
                    progress = progress_response.json()
                    print(f"\r   Progress: {progress['percentage']:.0f}% - {progress['message']}", end="")
                    
                    if progress['status'] in ['completed', 'failed']:
                        print()  # New line
                        if progress['status'] == 'completed':
                            print(f"   ✅ Scraping completed: {progress.get('work_orders_found', 0)} work orders found")
                        else:
                            print(f"   ❌ Scraping failed: {progress.get('error', 'Unknown error')}")
                            return
                        break
                
                time.sleep(2)
            else:
                print("\n   ⚠️  Scraping timed out")
                return
        else:
            print(f"   ❌ Failed to start scraping: {scrape_response.status_code}")
            return
        
        # Wait a moment for data to settle
        time.sleep(2)
        
        # Step 3: Verify customer URLs
        print("\n3️⃣ Verifying customer URLs...")
        wo_response = requests.get(f"{BASE_URL}/work-orders/?user_id={user_id}")
        
        if wo_response.status_code == 200:
            work_orders = wo_response.json()
            print(f"   Found {len(work_orders)} work orders")
            
            # Check first few for customer URLs
            customer_url_count = 0
            dispenser_service_count = 0
            
            for i, wo in enumerate(work_orders[:10]):  # Check first 10
                has_customer_url = False
                if wo.get('scraped_data') and wo['scraped_data'].get('customer_url'):
                    has_customer_url = True
                    customer_url_count += 1
                
                # Check if it's a dispenser service
                if wo.get('service_code') in ['2861', '2862', '3146', '3002']:
                    dispenser_service_count += 1
                
                if i < 3:  # Show details for first 3
                    print(f"\n   Work Order: {wo['external_id']}")
                    print(f"   Site: {wo['site_name']}")
                    print(f"   Service: {wo.get('service_code', 'N/A')} - {wo.get('service_description', 'N/A')}")
                    print(f"   Customer URL: {'✅ Yes' if has_customer_url else '❌ No'}")
                    if has_customer_url:
                        print(f"   URL: {wo['scraped_data']['customer_url']}")
                    
                    # Check address
                    if wo.get('scraped_data') and wo['scraped_data'].get('address_components'):
                        addr = wo['scraped_data']['address_components']
                        print(f"   Address: {addr.get('street', 'N/A')}")
                        if 'Meter' in str(addr.get('street', '')):
                            print("   ⚠️  Address incorrectly includes 'Meter'")
            
            print(f"\n   Summary:")
            print(f"   - Work orders with customer URLs: {customer_url_count}/{len(work_orders[:10])}")
            print(f"   - Work orders with dispenser services: {dispenser_service_count}")
            
            if customer_url_count == 0:
                print("\n   ❌ No customer URLs found - dispenser scraping will fail")
                print("   💡 The WorkFossa page structure may have changed")
                return
        else:
            print(f"   ❌ Failed to fetch work orders: {wo_response.status_code}")
            return
        
        # Step 4: Run dispenser scraping
        print("\n4️⃣ Running batch dispenser scraping...")
        disp_response = requests.post(f"{BASE_URL}/work-orders/scrape-dispensers-batch?user_id={user_id}")
        
        if disp_response.status_code == 200:
            result = disp_response.json()
            if result['status'] == 'no_work_orders':
                print(f"   ❌ {result['message']}")
                return
            
            print(f"   ✅ Dispenser scraping initiated for {result.get('work_order_count', 0)} work orders")
            
            # Monitor progress
            print("   ⏳ Monitoring dispenser scraping progress...")
            max_wait = 120  # Wait up to 2 minutes
            start_time = time.time()
            
            while time.time() - start_time < max_wait:
                progress_response = requests.get(f"{BASE_URL}/work-orders/scrape-dispensers/progress/{user_id}")
                if progress_response.status_code == 200:
                    progress = progress_response.json()
                    msg = f"\r   Progress: {progress['percentage']:.0f}% - {progress['message']}"
                    if progress.get('successful', 0) > 0 or progress.get('failed', 0) > 0:
                        msg += f" (✅ {progress['successful']} / ❌ {progress['failed']})"
                    print(msg, end="")
                    
                    if progress['status'] in ['completed', 'failed']:
                        print()  # New line
                        if progress['status'] == 'completed':
                            print(f"\n   ✅ Dispenser scraping completed:")
                            print(f"      - Successful: {progress.get('successful', 0)}")
                            print(f"      - Failed: {progress.get('failed', 0)}")
                        else:
                            print(f"\n   ❌ Dispenser scraping failed: {progress.get('error', 'Unknown error')}")
                        break
                
                time.sleep(2)
            else:
                print("\n   ⚠️  Dispenser scraping timed out")
        else:
            print(f"   ❌ Failed to start dispenser scraping: {disp_response.status_code}")
            print(f"   Response: {disp_response.text}")
            return
        
        # Step 5: Verify results
        print("\n5️⃣ Verifying dispenser data...")
        wo_response = requests.get(f"{BASE_URL}/work-orders/?user_id={user_id}")
        
        if wo_response.status_code == 200:
            work_orders = wo_response.json()
            
            # Check first few work orders for dispenser data
            dispensers_found = 0
            for i, wo in enumerate(work_orders[:5]):
                if wo.get('dispensers') and len(wo['dispensers']) > 0:
                    dispensers_found += 1
                    
                    if i < 2:  # Show details for first 2
                        print(f"\n   Work Order: {wo['external_id']}")
                        print(f"   Dispensers: {len(wo['dispensers'])}")
                        for d in wo['dispensers'][:2]:  # Show first 2 dispensers
                            print(f"     - #{d['dispenser_number']}: {d['dispenser_type']}")
                            if d['dispenser_type'] != 'Wayne 300':  # Not default
                                print("       ✅ Real dispenser data (not default)")
                            else:
                                print("       ⚠️  Default dispenser data")
            
            print(f"\n   Summary: {dispensers_found}/{min(5, len(work_orders))} work orders have dispensers")
        
        print("\n" + "="*60)
        print("✅ Workflow test completed!")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Cannot connect to backend. Is the server running?")
        print("💡 Start the backend with: python3 start_backend.py")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_complete_workflow()
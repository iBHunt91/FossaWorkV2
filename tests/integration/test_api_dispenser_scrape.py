#!/usr/bin/env python3
"""
Test dispenser scraping through the API
"""
import requests
import json
import time

# API configuration
BASE_URL = "http://localhost:8000/api/v1"

def test_api_dispenser_scraping():
    """Test dispenser scraping through the API endpoints"""
    
    print("🧪 Testing Dispenser Scraping via API")
    print("="*50)
    
    # First, we need a user ID - let's check if we have any work orders
    print("\n1️⃣ Checking for existing work orders...")
    
    # Try with a known user ID (from the credential files)
    user_id = "7bea3bdb7e8e303eacaba442bd824004"  # Most recent credential file
    
    try:
        # Get work orders
        response = requests.get(f"{BASE_URL}/work-orders/", params={"user_id": user_id})
        
        if response.status_code == 200:
            work_orders = response.json()
            print(f"✅ Found {len(work_orders)} work orders")
            
            # Find work orders with dispenser service codes
            dispenser_codes = ["2861", "2862", "3146", "3002"]
            dispenser_work_orders = [
                wo for wo in work_orders 
                if wo.get("service_code") in dispenser_codes
            ]
            
            print(f"📋 Work orders with dispenser services: {len(dispenser_work_orders)}")
            
            if dispenser_work_orders:
                # Show first few
                for wo in dispenser_work_orders[:3]:
                    print(f"   - {wo['external_id']}: {wo['site_name']} ({wo['service_code']})")
                    if wo.get('scraped_data') and wo['scraped_data'].get('customer_url'):
                        print(f"     ✅ Has customer URL: {wo['scraped_data']['customer_url']}")
                    else:
                        print(f"     ❌ No customer URL")
        else:
            print(f"❌ Failed to get work orders: {response.status_code}")
            print(f"   Response: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is the server running?")
        print("💡 Start the backend with: python3 start_backend.py")
        return
    
    # Test batch dispenser scraping endpoint
    print("\n2️⃣ Testing batch dispenser scraping endpoint...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/work-orders/scrape-dispensers-batch",
            params={"user_id": user_id}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Batch scraping initiated:")
            print(f"   - Status: {result['status']}")
            print(f"   - Message: {result['message']}")
            print(f"   - Work orders: {result.get('work_order_count', 0)}")
            
            # Check progress
            if result['status'] == 'scraping_started':
                print("\n3️⃣ Monitoring scraping progress...")
                
                for i in range(30):  # Check for 30 seconds
                    time.sleep(2)
                    
                    progress_response = requests.get(
                        f"{BASE_URL}/work-orders/scrape-dispensers/progress/{user_id}"
                    )
                    
                    if progress_response.status_code == 200:
                        progress = progress_response.json()
                        print(f"\r   Progress: {progress['percentage']:.1f}% - {progress['message']}", end="")
                        
                        if progress['status'] in ['completed', 'failed']:
                            print(f"\n   Final status: {progress['status']}")
                            if progress['status'] == 'completed':
                                print(f"   ✅ Successfully processed: {progress.get('successful', 0)}")
                                print(f"   ❌ Failed: {progress.get('failed', 0)}")
                            break
                    else:
                        print(f"\n   ❌ Failed to get progress: {progress_response.status_code}")
                        break
        else:
            print(f"❌ Failed to start batch scraping: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "="*50)
    print("✅ API test completed")

if __name__ == "__main__":
    test_api_dispenser_scraping()
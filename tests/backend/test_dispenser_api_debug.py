#!/usr/bin/env python3
"""
Test the dispenser scraping API to debug current issues
"""
import asyncio
import aiohttp
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from test_credentials_access import get_workfossa_credentials

async def test_dispenser_api():
    """Test the dispenser scraping API endpoint"""
    
    print("🔍 TESTING DISPENSER SCRAPING API")
    print("=" * 50)
    
    # Get credentials to find a valid user_id
    creds = get_workfossa_credentials()
    if not creds:
        print("❌ No credentials found!")
        return
    
    user_id = creds['user_id']
    print(f"🔑 Using user ID: {user_id}")
    
    # Test the API endpoint
    api_url = "http://localhost:8000"
    
    try:
        async with aiohttp.ClientSession() as session:
            # First check health
            print("\n🔧 Testing backend health...")
            async with session.get(f"{api_url}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    print(f"✅ Backend healthy: {health_data['counts']}")
                else:
                    print(f"❌ Backend health check failed: {response.status}")
                    return
            
            # Test batch dispenser scraping endpoint
            print(f"\n🔧 Testing batch dispenser scraping for user {user_id}...")
            
            endpoint = f"{api_url}/api/v1/work-orders/scrape-dispensers-batch?user_id={user_id}"
            print(f"📍 Calling: {endpoint}")
            
            async with session.post(endpoint) as response:
                print(f"📊 Response status: {response.status}")
                
                if response.status == 200:
                    result = await response.json()
                    print("✅ API call successful!")
                    print(f"📋 Response: {json.dumps(result, indent=2)}")
                    
                    # If scraping started, check progress
                    if "message" in result and "started" in result.get("message", "").lower():
                        print("\n🔧 Checking progress...")
                        
                        # Wait a bit and check progress
                        await asyncio.sleep(5)
                        
                        progress_endpoint = f"{api_url}/api/v1/work-orders/scrape-dispensers/progress/{user_id}"
                        async with session.get(progress_endpoint) as progress_response:
                            if progress_response.status == 200:
                                progress_data = await progress_response.json()
                                print(f"📈 Progress: {json.dumps(progress_data, indent=2)}")
                            else:
                                print(f"❌ Progress check failed: {progress_response.status}")
                
                else:
                    error_text = await response.text()
                    print(f"❌ API call failed!")
                    print(f"📋 Error response: {error_text}")
                    
                    # Try to parse as JSON
                    try:
                        error_data = json.loads(error_text)
                        print(f"📋 Error details: {json.dumps(error_data, indent=2)}")
                    except:
                        print(f"📋 Raw error: {error_text}")
            
            # Also test individual work order scraping
            print(f"\n🔧 Testing individual work order dispenser scraping...")
            
            # Get a work order ID
            from app.database import SessionLocal
            from app.models import WorkOrder
            
            db = SessionLocal()
            try:
                wo = db.query(WorkOrder).filter(
                    WorkOrder.user_id == user_id,
                    WorkOrder.service_code.in_(["2861", "2862", "3146", "3002"])
                ).first()
                
                if wo:
                    individual_endpoint = f"{api_url}/api/v1/work-orders/{wo.external_id}/scrape-dispensers"
                    print(f"📍 Testing individual scraping for work order: {wo.external_id}")
                    
                    async with session.post(individual_endpoint) as response:
                        print(f"📊 Individual scrape status: {response.status}")
                        
                        if response.status == 200:
                            result = await response.json()
                            print(f"✅ Individual scrape result: {json.dumps(result, indent=2)}")
                        else:
                            error_text = await response.text()
                            print(f"❌ Individual scrape failed: {error_text}")
                
                else:
                    print("❌ No dispenser work orders found for testing")
                    
            finally:
                db.close()
                
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dispenser_api())
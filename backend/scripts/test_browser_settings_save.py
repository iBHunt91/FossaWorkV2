#!/usr/bin/env python3
"""
Test browser settings save functionality
"""

import sys
from pathlib import Path
import json
import asyncio
import httpx

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

async def test_browser_settings():
    """Test browser settings save and retrieval"""
    
    # User ID for testing
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # API base URL
    base_url = "http://localhost:8000"
    
    # Login first to get token
    print("1. Logging in...")
    async with httpx.AsyncClient() as client:
        login_response = await client.post(
            f"{base_url}/api/auth/login",
            json={
                "username": "ibhunt",
                "password": "Jared123Jared"
            }
        )
        
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            return
            
        login_data = login_response.json()
        token = login_data["access_token"]
        user_id = login_data["user_id"]  # Use the actual logged-in user's ID
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"✅ Login successful - User ID: {user_id}")
        
        # Get current browser settings
        print("\n2. Getting current browser settings...")
        get_response = await client.get(
            f"{base_url}/api/settings/browser/{user_id}",
            headers=headers
        )
        
        if get_response.status_code == 200:
            current_settings = get_response.json()["settings"]
            print(f"Current settings: {json.dumps(current_settings, indent=2)}")
        else:
            print(f"Failed to get settings: {get_response.text}")
            
        # Update browser settings with show_browser_during_sync
        print("\n3. Updating browser settings to show browser...")
        new_settings = current_settings.copy() if 'current_settings' in locals() else {}
        new_settings["headless"] = False
        new_settings["show_browser_during_sync"] = True
        
        update_response = await client.post(
            f"{base_url}/api/settings/browser/{user_id}",
            json=new_settings,
            headers=headers
        )
        
        if update_response.status_code == 200:
            print("✅ Browser settings updated successfully")
        else:
            print(f"Failed to update settings: {update_response.text}")
            
        # Verify settings were saved
        print("\n4. Verifying settings were saved...")
        verify_response = await client.get(
            f"{base_url}/api/settings/browser/{user_id}",
            headers=headers
        )
        
        if verify_response.status_code == 200:
            saved_settings = verify_response.json()["settings"]
            print(f"Saved settings: {json.dumps(saved_settings, indent=2)}")
            
            if saved_settings.get("show_browser_during_sync") == True:
                print("✅ show_browser_during_sync is correctly set to True")
            else:
                print("❌ show_browser_during_sync is not set correctly")
        
        # Check the JSON file directly
        print("\n5. Checking JSON file directly...")
        settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
        if settings_path.exists():
            with open(settings_path, 'r') as f:
                file_settings = json.load(f)
                print(f"File contents: {json.dumps(file_settings, indent=2)}")
                
                if file_settings.get("show_browser_during_sync") == True:
                    print("✅ JSON file contains show_browser_during_sync = True")
                else:
                    print("❌ JSON file does not contain show_browser_during_sync = True")
        else:
            print(f"❌ Settings file not found at {settings_path}")

if __name__ == "__main__":
    asyncio.run(test_browser_settings())
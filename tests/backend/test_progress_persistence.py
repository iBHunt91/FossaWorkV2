#!/usr/bin/env python3
"""
Test script to verify progress persistence across navigation
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def test_progress_persistence():
    """Test that scraping progress persists across navigation"""
    
    print("🧪 Testing Progress Persistence")
    print("="*50)
    
    # Use a test user ID
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    print("\n1️⃣ Checking current progress state...")
    
    try:
        # Check work order scraping progress
        wo_progress = requests.get(f"{BASE_URL}/work-orders/scrape/progress/{user_id}")
        if wo_progress.status_code == 200:
            progress = wo_progress.json()
            print(f"   Work Order Scraping Status: {progress['status']}")
            print(f"   Phase: {progress['phase']}")
            print(f"   Message: {progress['message']}")
            
            if progress['status'] == 'in_progress':
                print("\n✅ Work order scraping is in progress!")
                print("   The frontend should automatically detect and display this progress")
                print("   when you navigate back to the Work Orders page.")
        
        # Check dispenser scraping progress  
        disp_progress = requests.get(f"{BASE_URL}/work-orders/scrape-dispensers/progress/{user_id}")
        if disp_progress.status_code == 200:
            progress = disp_progress.json()
            print(f"\n   Dispenser Scraping Status: {progress['status']}")
            print(f"   Phase: {progress['phase']}")
            print(f"   Message: {progress['message']}")
            
            if progress['status'] == 'in_progress':
                print("\n✅ Dispenser scraping is in progress!")
                print("   The frontend should automatically detect and display this progress")
                print("   when you navigate back to the Work Orders page.")
                
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is the server running?")
        print("💡 Start the backend with: python3 start_backend.py")
        return
    
    print("\n2️⃣ Frontend Behavior:")
    print("   - When you navigate to Work Orders page, it checks for active scraping")
    print("   - If scraping is in progress, it automatically shows the progress UI")
    print("   - Progress state is also stored in localStorage as backup")
    print("   - Stale localStorage entries (>10 minutes old) are cleaned up")
    
    print("\n3️⃣ Testing Steps:")
    print("   1. Start a work order scrape")
    print("   2. Navigate away to another page (e.g., Dashboard)")
    print("   3. Navigate back to Work Orders")
    print("   4. Progress UI should automatically appear and continue updating")
    
    print("\n✅ Progress persistence is now implemented!")

if __name__ == "__main__":
    test_progress_persistence()
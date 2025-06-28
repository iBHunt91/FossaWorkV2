#!/usr/bin/env python3
"""
Live User Test - Real-time verification of timezone fix
Tests the actual running system with real API calls and real data.
"""

import httpx
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "jcrenshaw@fossaltd.com"
PASSWORD = "J78r2@6pL"

# ANSI color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text):
    print(f"\n{BOLD}{BLUE}{'='*70}{RESET}")
    print(f"{BOLD}{BLUE}{text.center(70)}{RESET}")
    print(f"{BOLD}{BLUE}{'='*70}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_info(label, value):
    print(f"   {YELLOW}{label}:{RESET} {value}")

def calculate_hours_difference(iso_timestamp):
    """Calculate hours between timestamp and now (like frontend does)"""
    if iso_timestamp.endswith('Z'):
        # Proper UTC parsing
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
    else:
        # This would be the bug - treating as local time
        dt = datetime.fromisoformat(iso_timestamp)
    
    # Use UTC for both times to match what JavaScript does
    now_utc = datetime.utcnow()
    
    # Convert both to naive datetime for comparison (like JavaScript does)
    dt_naive = dt.replace(tzinfo=None) if dt.tzinfo else dt
    
    diff_seconds = (dt_naive - now_utc).total_seconds()
    return diff_seconds / 3600

def format_relative_time(hours_diff):
    """Format like the frontend would"""
    if abs(hours_diff) < 0.02:  # ~1 minute
        return "due now"
    elif hours_diff > 0:
        if hours_diff < 2:
            return f"in about {round(hours_diff)} hour{'s' if round(hours_diff) != 1 else ''}"
        else:
            return f"in about {round(hours_diff)} hours"
    else:
        return f"about {round(abs(hours_diff))} hours ago"

def main():
    print_header("🔴 LIVE USER TEST - Real System Verification")
    print("Testing the actual running system with real API calls...")
    
    try:
        with httpx.Client(timeout=10.0) as client:
            # Step 1: Login
            print("\n🔐 Step 1: User Login")
            login_data = {"username": USERNAME, "password": PASSWORD}
            
            resp = client.post(f"{BASE_URL}/api/auth/login", json=login_data)
            if resp.status_code != 200:
                print_error(f"Login failed: {resp.text}")
                return False
            
            token = resp.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            print_success("User logged in successfully")
            
            # Step 2: Get current schedule
            print("\n📅 Step 2: Check Current Schedule")
            resp = client.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
            if resp.status_code != 200:
                print_error(f"Cannot get schedules: {resp.text}")
                return False
            
            schedules = resp.json()
            if not schedules:
                print_error("No schedules found. Please create one in the UI first.")
                return False
            
            schedule = schedules[0]
            print_success("Found user's schedule")
            print_info("Current Interval", f"{schedule['interval_hours']} hours")
            print_info("Current Status", "Enabled" if schedule['enabled'] else "Disabled")
            print_info("Last Run", schedule['last_run'] or "Never")
            print_info("Next Run", schedule['next_run'] or "Not scheduled")
            
            # Step 3: Update to 1 hour interval (the critical test)
            print("\n⏰ Step 3: Set 1-Hour Interval (Critical Test)")
            current_time = datetime.now().strftime("%H:%M:%S")
            print(f"   Current local time: {current_time}")
            
            update_data = {
                "interval_hours": 1.0,
                "enabled": True
            }
            
            resp = client.put(f"{BASE_URL}/api/scraping-schedules/{schedule['id']}", 
                             headers=headers, json=update_data)
            if resp.status_code != 200:
                print_error(f"Schedule update failed: {resp.text}")
                return False
            
            updated = resp.json()
            print_success("Schedule updated to 1-hour interval")
            
            # Step 4: Analyze the response (critical test)
            print("\n🔍 Step 4: Analyze API Response")
            next_run = updated.get('next_run')
            print_info("API Response - next_run", next_run)
            
            # Check for proper timezone formatting
            if next_run and next_run.endswith('Z'):
                print_success("✅ BACKEND FIX WORKING: Timestamp includes 'Z' suffix")
            else:
                print_error("❌ BACKEND ISSUE: Missing 'Z' suffix")
                return False
            
            # Step 5: Calculate what user would see
            print("\n👁️  Step 5: What User Sees in UI")
            if next_run:
                hours_diff = calculate_hours_difference(next_run)
                user_display = format_relative_time(hours_diff)
                
                print_info("Hours until next run", f"{hours_diff:.2f}")
                print_info("User sees in sidebar", f"Active • {user_display}")
                
                # The critical test - should show "in about 1 hour"
                if "in about 1 hour" in user_display:
                    print_success("🎉 CRITICAL TEST PASSED!")
                    print_success("✅ User correctly sees '1 hour' for 1-hour interval")
                    print_success("✅ Timezone fix is working perfectly!")
                    return True
                elif 0.8 <= hours_diff <= 1.2:  # Allow some tolerance
                    print_success("🎉 TEST PASSED (within tolerance)")
                    print_success(f"✅ Shows '{user_display}' which is correct for {hours_diff:.2f}h difference")
                    return True
                else:
                    print_error(f"❌ CRITICAL TEST FAILED!")
                    print_error(f"Expected: 'in about 1 hour'")
                    print_error(f"User sees: '{user_display}'")
                    print_error(f"Actual difference: {hours_diff:.2f} hours")
                    
                    # Debug info
                    print(f"\n{BOLD}🔧 DEBUG INFO:{RESET}")
                    print_info("Backend timestamp", next_run)
                    print_info("Parsed as UTC", datetime.fromisoformat(next_run.replace('Z', '+00:00')))
                    print_info("Current local time", datetime.now())
                    return False
            else:
                print_error("No next_run timestamp provided")
                return False
                
    except Exception as e:
        print_error(f"Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing timezone fix with LIVE system...")
    print("Make sure backend is running on port 8000")
    
    success = main()
    
    if success:
        print_header("🎉 LIVE TEST RESULT: PASSED ✅")
        print(f"{GREEN}{BOLD}The timezone fix is working correctly!{RESET}")
        print("Users will see accurate '1 hour' displays for 1-hour intervals.")
        print("\nNext steps:")
        print("✅ Test in the actual UI to confirm")
        print("✅ Check different browsers/devices")
        print("✅ Monitor for any edge cases")
    else:
        print_header("❌ LIVE TEST RESULT: FAILED")
        print(f"{RED}{BOLD}The timezone fix needs additional work.{RESET}")
        print("\nNext steps:")
        print("🔧 Check backend response formatting")
        print("🔧 Verify frontend date parsing")
        print("🔧 Test with different timezone settings")
    
    print(f"\n{BOLD}To test manually:{RESET}")
    print("1. Open the app in your browser")
    print("2. Go to Schedule page")
    print("3. Set interval to 1 hour")
    print("4. Check sidebar - should show 'Active • in about 1 hour'")
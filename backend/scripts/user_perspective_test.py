#!/usr/bin/env python3
"""
User Perspective Test - Verify Timezone Fix
Tests the schedule display from exactly how a user would experience it.
"""

import httpx
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "jcrenshaw@fossaltd.com"  # Test user
PASSWORD = "J78r2@6pL"  # Test password

# ANSI color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text.center(60)}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")

def print_user_scenario(scenario):
    print(f"{BOLD}{YELLOW}👤 USER SCENARIO: {scenario}{RESET}")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_info(label, value):
    print(f"   {label}: {value}")

def simulate_frontend_date_calculation(backend_timestamp):
    """Simulate how frontend calculates relative time"""
    # This simulates what JavaScript does: new Date(timestamp)
    if backend_timestamp.endswith('Z'):
        # Proper UTC timestamp
        dt = datetime.fromisoformat(backend_timestamp.replace('Z', '+00:00'))
    else:
        # Problematic timestamp - JavaScript would treat as local time
        dt = datetime.fromisoformat(backend_timestamp)
        # Simulate JavaScript interpreting as local time
        local_offset = datetime.now().astimezone().utcoffset()
        dt = dt.replace(tzinfo=local_offset.normalize() if hasattr(local_offset, 'normalize') else None)
    
    now = datetime.now()
    diff_hours = (dt.replace(tzinfo=None) - now).total_seconds() / 3600
    
    if abs(diff_hours) < 0.1:
        return "due now"
    elif diff_hours > 0:
        if diff_hours < 2:
            return f"in about {int(round(diff_hours))} hour{'s' if int(round(diff_hours)) != 1 else ''}"
        else:
            return f"in about {int(round(diff_hours))} hours"
    else:
        return f"about {int(round(abs(diff_hours)))} hours ago"

def main():
    print_header("USER PERSPECTIVE TEST - Timezone Fix Verification")
    print("This test simulates exactly what a user would see when using the schedule feature.")
    
    with httpx.Client() as client:
        # Step 1: Login (as user would)
        print_user_scenario("User logs into the application")
        login_data = {"username": USERNAME, "password": PASSWORD}
        
        try:
            resp = client.post(f"{BASE_URL}/api/auth/login", json=login_data)
            if resp.status_code != 200:
                print_error(f"Login failed - user cannot access the system")
                return False
            
            token = resp.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            print_success("User successfully logged in")
        except Exception as e:
            print_error(f"User cannot connect to the application: {e}")
            return False
        
        # Step 2: User views current schedule
        print_user_scenario("User navigates to the Schedule page")
        resp = client.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers)
        if resp.status_code != 200:
            print_error("User cannot view schedules")
            return False
        
        schedules = resp.json()
        if not schedules:
            print_error("No schedules found - user needs to create one first")
            return False
        
        schedule = schedules[0]
        print_success("User can see their current schedule")
        print_info("Current Interval", f"{schedule['interval_hours']} hours")
        print_info("Schedule Status", "Enabled" if schedule['enabled'] else "Disabled")
        
        # Step 3: User changes interval to 1 hour (the critical test case)
        print_user_scenario("User changes scraping interval to 1 hour and clicks Save")
        
        update_data = {
            "interval_hours": 1.0,
            "enabled": True
        }
        
        resp = client.put(f"{BASE_URL}/api/scraping-schedules/{schedule['id']}", 
                         headers=headers, json=update_data)
        if resp.status_code != 200:
            print_error("User's schedule update failed")
            return False
        
        updated_schedule = resp.json()
        print_success("User successfully saved 1-hour interval schedule")
        
        # Step 4: Verify the backend response includes proper timezone info
        print_user_scenario("System processes the schedule update")
        next_run = updated_schedule.get('next_run')
        
        if not next_run:
            print_error("No next run time provided to user")
            return False
        
        print_info("Backend Response - Next Run", next_run)
        
        # Critical Test: Does it have proper timezone indicator?
        if next_run.endswith('Z'):
            print_success("✅ TIMEZONE FIX WORKING: Backend includes proper UTC indicator")
        else:
            print_error("❌ TIMEZONE ISSUE: Backend missing UTC indicator")
            return False
        
        # Step 5: Simulate what user sees in the UI
        print_user_scenario("User looks at the sidebar to see when next scraping will occur")
        
        # Simulate the frontend calculation
        user_display = simulate_frontend_date_calculation(next_run)
        print_info("What User Sees in Sidebar", f"Active • {user_display}")
        
        # Step 6: Verify this is correct (the critical test)
        expected_display = "in about 1 hour"
        
        if user_display == expected_display:
            print_success(f"🎉 CRITICAL TEST PASSED: User correctly sees '{expected_display}'")
            print_success("✅ The timezone fix is working perfectly from user's perspective!")
            return True
        else:
            print_error(f"❌ CRITICAL TEST FAILED: User sees '{user_display}' instead of '{expected_display}'")
            
            # Debug information
            print(f"\n{BOLD}DEBUG INFO:{RESET}")
            next_run_dt = datetime.fromisoformat(next_run.replace('Z', '+00:00'))
            current_time = datetime.now()
            actual_diff = (next_run_dt.replace(tzinfo=None) - current_time).total_seconds() / 3600
            print_info("Actual time difference", f"{actual_diff:.2f} hours")
            print_info("Expected time difference", "~1.0 hours")
            
            return False

def run_quick_verification():
    """Quick verification that can be run anytime"""
    print_header("QUICK TIMEZONE VERIFICATION")
    
    # Test the date parsing logic directly
    test_cases = [
        ("2025-06-26T20:30:00Z", "Proper UTC timestamp"),
        ("2025-06-26T20:30:00", "Legacy timestamp without Z"),
    ]
    
    for timestamp, description in test_cases:
        print(f"\nTesting: {description}")
        print_info("Input", timestamp)
        result = simulate_frontend_date_calculation(timestamp)
        print_info("User would see", result)
        
        # For a timestamp 1 hour in the future, user should see "in about 1 hour"
        if "1 hour" in result and "in about" in result:
            print_success("✅ Correct display for 1-hour interval")
        else:
            print_error("❌ Incorrect display")

if __name__ == "__main__":
    print("🧪 Testing timezone fix from user's perspective...\n")
    
    # Run the full user workflow test
    success = main()
    
    if success:
        print_header("USER EXPERIENCE TEST: PASSED ✅")
        print("The timezone fix is working correctly!")
        print("Users will now see accurate schedule timing.")
    else:
        print_header("USER EXPERIENCE TEST: FAILED ❌")
        print("There are still issues with the timezone fix.")
        print("Running quick verification to diagnose...")
        run_quick_verification()
    
    print(f"\n{BOLD}Next Steps:{RESET}")
    if success:
        print("✅ The fix is ready for production")
        print("✅ Users will see correct schedule timing")
        print("✅ Monitor user feedback to confirm no edge cases")
    else:
        print("❌ Additional fixes needed")
        print("❌ Check backend API response formatting")
        print("❌ Verify frontend date parsing logic")
#!/usr/bin/env python3
"""
Test script to verify schedule update logging and behavior.
Tests the fix for the "1 hour shows as 5 hours" issue.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
import time

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "jcrenshaw@fossaltd.com"  # Replace with your test username
PASSWORD = "J78r2@6pL"  # Replace with your test password

# ANSI color codes for better output visibility
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

def print_step(step_num, text):
    print(f"{BOLD}{GREEN}Step {step_num}:{RESET} {text}")

def print_info(label, value):
    print(f"  {YELLOW}{label}:{RESET} {value}")

def print_error(text):
    print(f"{RED}ERROR: {text}{RESET}")

def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")

def format_time_diff(dt1, dt2):
    """Calculate time difference in hours"""
    diff = (dt1 - dt2).total_seconds() / 3600
    return f"{diff:.2f} hours"

async def login(session):
    """Login and get JWT token"""
    print_step(1, "Logging in to get authentication token")
    
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as resp:
        if resp.status != 200:
            print_error(f"Login failed: {await resp.text()}")
            return None
        
        data = await resp.json()
        token = data.get("access_token")
        print_success(f"Login successful! Token: {token[:20]}...")
        return token

async def get_schedule(session, headers):
    """Get current schedule"""
    print_step(2, "Fetching current schedule")
    
    async with session.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers) as resp:
        if resp.status != 200:
            print_error(f"Failed to get schedules: {await resp.text()}")
            return None
        
        schedules = await resp.json()
        if not schedules:
            print_info("Status", "No schedules found")
            return None
        
        schedule = schedules[0]
        print_success("Schedule found!")
        print_info("Schedule ID", schedule["id"])
        print_info("Enabled", schedule["enabled"])
        print_info("Interval", f"{schedule['interval_hours']} hours")
        print_info("Last Run", schedule["last_run"] or "Never")
        print_info("Next Run", schedule["next_run"] or "Not scheduled")
        
        # Calculate time until next run
        if schedule["next_run"]:
            next_run_dt = datetime.fromisoformat(schedule["next_run"].replace('Z', '+00:00'))
            current_utc = datetime.utcnow()
            print_info("Current UTC Time", current_utc.isoformat())
            print_info("Time until next run", format_time_diff(next_run_dt, current_utc))
        
        return schedule

async def update_schedule(session, headers, schedule_id, interval_hours, enabled=True):
    """Update schedule with new interval"""
    print_step(3, f"Updating schedule - interval: {interval_hours}h, enabled: {enabled}")
    
    update_data = {
        "interval_hours": interval_hours,
        "enabled": enabled
    }
    
    print_info("Request Data", json.dumps(update_data, indent=2))
    
    async with session.put(
        f"{BASE_URL}/api/scraping-schedules/{schedule_id}", 
        headers=headers,
        json=update_data
    ) as resp:
        if resp.status != 200:
            print_error(f"Failed to update schedule: {await resp.text()}")
            return None
        
        updated = await resp.json()
        print_success("Schedule updated successfully!")
        print_info("New Interval", f"{updated['interval_hours']} hours")
        print_info("Enabled", updated['enabled'])
        print_info("Next Run", updated["next_run"] or "Not scheduled")
        
        # Calculate time until next run
        if updated["next_run"]:
            next_run_dt = datetime.fromisoformat(updated["next_run"].replace('Z', '+00:00'))
            current_utc = datetime.utcnow()
            time_diff = format_time_diff(next_run_dt, current_utc)
            print_info("Current UTC Time", current_utc.isoformat())
            print_info("Time until next run", time_diff)
            
            # Verify the time difference matches the interval
            expected_diff = updated["interval_hours"]
            actual_diff = (next_run_dt - current_utc).total_seconds() / 3600
            
            if abs(actual_diff - expected_diff) < 0.1:  # Allow 6 minutes tolerance
                print_success(f"✓ Next run correctly set to {expected_diff} hours from now")
            else:
                print_error(f"✗ Next run is {actual_diff:.2f} hours away, expected {expected_diff} hours")
        
        return updated

async def test_schedule_updates():
    """Main test function"""
    print_header("Schedule Update Logging Test")
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Login
        token = await login(session)
        if not token:
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get current schedule
        schedule = await get_schedule(session, headers)
        if not schedule:
            print_error("No schedule to test. Please create a schedule first.")
            return
        
        schedule_id = schedule["id"]
        
        # Step 3: Test different intervals
        print_header("Testing Schedule Updates")
        
        test_cases = [
            (1.0, True, "Testing 1 hour interval"),
            (2.0, True, "Testing 2 hour interval"),
            (0.5, True, "Testing 30 minute interval"),
            (1.0, False, "Testing disabled schedule"),
            (1.0, True, "Testing re-enable with 1 hour"),
        ]
        
        for interval, enabled, description in test_cases:
            print(f"\n{BOLD}{description}{RESET}")
            await update_schedule(session, headers, schedule_id, interval, enabled)
            await asyncio.sleep(2)  # Wait between updates
        
        # Step 4: Check logs
        print_header("Test Complete")
        print("\nCheck the backend logs for detailed logging output.")
        print("Look for entries with '=== UPDATE SCHEDULE ===' and '=== NEXT RUN RECALCULATED ==='")
        print("\nLog file location: backend/logs/backend-general-{date}.jsonl")
        
        # Final verification
        print_header("Final Schedule State")
        final_schedule = await get_schedule(session, headers)
        
        if final_schedule and final_schedule["enabled"] and final_schedule["next_run"]:
            next_run_dt = datetime.fromisoformat(final_schedule["next_run"].replace('Z', '+00:00'))
            current_utc = datetime.utcnow()
            actual_hours = (next_run_dt - current_utc).total_seconds() / 3600
            expected_hours = final_schedule["interval_hours"]
            
            if abs(actual_hours - expected_hours) < 0.1:
                print_success(f"✓ Schedule is working correctly! Next run in {actual_hours:.2f} hours as expected.")
            else:
                print_error(f"✗ Schedule issue detected. Next run in {actual_hours:.2f} hours, expected {expected_hours} hours.")

if __name__ == "__main__":
    asyncio.run(test_schedule_updates())
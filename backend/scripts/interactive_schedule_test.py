#!/usr/bin/env python3
"""
Interactive test script for schedule updates.
This script allows manual testing of the schedule update functionality
with clear visual feedback and logging verification.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000"

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

def print_info(label, value):
    print(f"  {YELLOW}{label}:{RESET} {value}")

def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    print(f"{RED}✗ {text}{RESET}")

async def wait_for_user():
    print(f"\n{YELLOW}Press Enter to continue...{RESET}")
    await asyncio.get_event_loop().run_in_executor(None, input)

async def main():
    print_header("Interactive Schedule Test")
    
    print("This test will help verify the schedule update functionality.")
    print("Make sure the backend is running on port 8000.")
    
    await wait_for_user()
    
    # Get credentials
    print("\nPlease enter your login credentials:")
    username = input("Username: ")
    password = input("Password: ")
    
    async with aiohttp.ClientSession() as session:
        # Login
        print_header("Step 1: Login")
        login_data = {"username": username, "password": password}
        
        try:
            async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as resp:
                if resp.status != 200:
                    print_error(f"Login failed: {await resp.text()}")
                    return
                
                data = await resp.json()
                token = data.get("access_token")
                print_success("Login successful!")
                headers = {"Authorization": f"Bearer {token}"}
        except Exception as e:
            print_error(f"Connection error: {e}")
            return
        
        # Get current schedule
        print_header("Step 2: Current Schedule")
        async with session.get(f"{BASE_URL}/api/scraping-schedules/", headers=headers) as resp:
            if resp.status != 200:
                print_error("Failed to get schedules")
                return
            
            schedules = await resp.json()
            if not schedules:
                print_error("No schedules found. Please create one in the UI first.")
                return
            
            schedule = schedules[0]
            schedule_id = schedule["id"]
            
            print_info("Schedule ID", schedule["id"])
            print_info("Current Interval", f"{schedule['interval_hours']} hours")
            print_info("Enabled", schedule["enabled"])
            print_info("Last Run", schedule["last_run"] or "Never")
            print_info("Next Run", schedule["next_run"] or "Not scheduled")
            
            if schedule["next_run"]:
                next_run_dt = datetime.fromisoformat(schedule["next_run"].replace('Z', '+00:00'))
                current_utc = datetime.utcnow()
                hours_until = (next_run_dt - current_utc).total_seconds() / 3600
                print_info("Hours until next run", f"{hours_until:.2f}")
        
        await wait_for_user()
        
        # Test update
        print_header("Step 3: Update Schedule to 1 Hour")
        print("Setting interval to 1 hour and enabling schedule...")
        
        update_data = {
            "interval_hours": 1.0,
            "enabled": True
        }
        
        async with session.put(
            f"{BASE_URL}/api/scraping-schedules/{schedule_id}", 
            headers=headers,
            json=update_data
        ) as resp:
            if resp.status != 200:
                print_error("Failed to update schedule")
                return
            
            updated = await resp.json()
            print_success("Schedule updated!")
            
            print_info("New Interval", f"{updated['interval_hours']} hours")
            print_info("Enabled", updated['enabled'])
            print_info("Next Run", updated["next_run"])
            
            if updated["next_run"]:
                next_run_dt = datetime.fromisoformat(updated["next_run"].replace('Z', '+00:00'))
                current_utc = datetime.utcnow()
                hours_until = (next_run_dt - current_utc).total_seconds() / 3600
                
                print_info("Current UTC Time", current_utc.isoformat())
                print_info("Next Run UTC Time", next_run_dt.isoformat())
                print_info("Hours until next run", f"{hours_until:.2f}")
                
                # Verify
                if abs(hours_until - 1.0) < 0.1:  # 6 minute tolerance
                    print_success("Next run is correctly set to ~1 hour from now!")
                else:
                    print_error(f"Next run is {hours_until:.2f} hours away, expected ~1 hour")
        
        print_header("Test Complete")
        print("\n" + BOLD + "What to check:" + RESET)
        print("1. In the UI, the sidebar should show 'Active • in about 1 hour'")
        print("2. The Schedule page should show the next run time as 1 hour from now")
        print("3. Check backend logs for detailed logging:")
        print("   - Look for '=== UPDATE SCHEDULE ===' entries")
        print("   - Look for '=== NEXT RUN RECALCULATED ===' entries")
        print("4. Check browser console for frontend logging")
        
        print(f"\n{YELLOW}Logs location:{RESET}")
        print("Backend: backend/logs/backend-general-{date}.jsonl")
        print("Frontend: Browser Developer Console (F12)")

if __name__ == "__main__":
    asyncio.run(main())
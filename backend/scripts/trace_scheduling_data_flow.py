#!/usr/bin/env python3
"""
Trace Data Flow in Scheduling System

This script traces exactly how scheduling data flows from backend calculation
to frontend display, identifying where the timezone confusion occurs.
"""

from datetime import datetime, timedelta
import json

def trace_scheduling_data_flow():
    """Trace the complete data flow to identify the exact failure point"""
    
    print("=" * 70)
    print("SCHEDULING SYSTEM DATA FLOW ANALYSIS")
    print("=" * 70)
    
    # STEP 1: Backend Schedule Update (simple_scheduler_service.py)
    print("\n🔧 STEP 1: Backend Schedule Update")
    print("-" * 40)
    
    print("Location: backend/app/services/simple_scheduler_service.py")
    print("Method: update_schedule() lines 108-119")
    print()
    
    # Simulate the exact backend calculation
    current_utc = datetime.utcnow()
    interval_hours = 1.0
    next_run_utc = current_utc + timedelta(hours=interval_hours)
    
    print(f"current_time = datetime.utcnow()  # {current_utc}")
    print(f"interval_hours = {interval_hours}")
    print(f"schedule.next_run = current_time + timedelta(hours={interval_hours})")
    print(f"# Result: {next_run_utc}")
    print(f"# ISO format for API: {next_run_utc.isoformat()}")
    
    # STEP 2: API Response (scraping_schedules.py) 
    print("\n📡 STEP 2: API Response Formation")
    print("-" * 35)
    
    print("Location: backend/app/routes/scraping_schedules.py")
    print("Method: _format_schedule_response() lines 324-325")
    print()
    
    api_next_run = next_run_utc.isoformat()
    print(f"next_run=schedule.next_run.isoformat()  # {api_next_run}")
    print("# This sends UTC time as ISO string to frontend")
    
    # STEP 3: Frontend API Call (ScrapingStatus.tsx)
    print("\n🌐 STEP 3: Frontend API Call & Data Reception")
    print("-" * 45)
    
    print("Location: frontend/src/components/ScrapingStatus.tsx")
    print("Method: fetchStatus() lines 57-59")
    print()
    
    print("setStatus({")
    print("  enabled: schedule.enabled,")
    print(f"  next_run: '{api_next_run}',  # Raw string from API")
    print("  // ... other fields")
    print("})")
    
    # STEP 4: Frontend Time Display (ScrapingStatus.tsx)
    print("\n🕐 STEP 4: Frontend Time Display")
    print("-" * 30)
    
    print("Location: frontend/src/components/ScrapingStatus.tsx")
    print("Method: formatNextRun() line 158-159")
    print()
    
    print(f"const formatNextRun = () => {{")
    print(f"  if (!status.next_run || !status.enabled) return null;")
    print(f"  return getRelativeTime(status.next_run);  # Calls utility")
    print(f"}}")
    
    # STEP 5: Relative Time Calculation (dateFormat.ts)
    print("\n⏰ STEP 5: getRelativeTime() Calculation")
    print("-" * 40)
    
    print("Location: frontend/src/utils/dateFormat.ts")
    print("Method: getRelativeTime() lines 55-57")
    print()
    
    # Simulate exact frontend calculation
    frontend_now = datetime.now()  # This is LOCAL time
    received_utc_string = api_next_run
    
    print(f"const date = new Date('{received_utc_string}');")
    print(f"const now = new Date();  # LOCAL time: {frontend_now}")
    print(f"const diffMs = date.getTime() - now.getTime();")
    
    # The critical issue: JavaScript Date parsing
    print("\n❗ CRITICAL ISSUE ANALYSIS:")
    print("-" * 25)
    
    print("JavaScript Date Parsing Behavior:")
    print(f"1. Backend sends: '{received_utc_string}' (UTC time)")
    print("2. Frontend receives this string")
    print("3. JavaScript new Date(string) without 'Z' suffix treats it as LOCAL time")
    print("4. But the string contains UTC values!")
    print()
    
    # Show the actual calculation that happens
    print("What Actually Happens:")
    print(f"- API sends UTC time: {next_run_utc}")
    print(f"- Frontend parses as local: {received_utc_string} (assumes local timezone)")
    print(f"- Frontend calculates: {received_utc_string} - {frontend_now}")
    
    # Calculate the difference as frontend sees it
    # Simulate JavaScript parsing the UTC time as local time
    parsed_as_local = datetime.fromisoformat(received_utc_string)
    diff_seconds = (parsed_as_local - frontend_now).total_seconds()
    diff_hours = diff_seconds / 3600
    
    print(f"- Result: {diff_seconds} seconds = {diff_hours:.1f} hours")
    print(f"- Display: 'in {int(diff_hours)} hours'")
    
    # STEP 6: Root Cause Summary
    print("\n🎯 ROOT CAUSE IDENTIFIED")
    print("-" * 25)
    
    print("Issue: TIMEZONE INTERPRETATION MISMATCH")
    print()
    print("Backend Calculation:")
    print(f"  UTC now: {current_utc.strftime('%H:%M:%S')}")
    print(f"  UTC next: {next_run_utc.strftime('%H:%M:%S')} (+1 hour)")
    print(f"  Sends: '{received_utc_string}'")
    print()
    print("Frontend Calculation:")
    print(f"  Receives: '{received_utc_string}'")
    print(f"  Parses as: LOCAL time (not UTC)")
    print(f"  Local now: {frontend_now.strftime('%H:%M:%S')}")
    print(f"  Calculates: {diff_hours:.1f} hour difference")
    print()
    print("The Mismatch:")
    print(f"  Backend: 1-hour interval in UTC")
    print(f"  Frontend: Sees {diff_hours:.1f}-hour interval due to timezone confusion")
    
    # STEP 7: Verification with Real Timezone
    print("\n✅ VERIFICATION")
    print("-" * 15)
    
    system_offset = (datetime.now() - datetime.utcnow()).total_seconds() / 3600
    expected_confusion = 1 + abs(system_offset)
    
    print(f"System timezone offset: {system_offset:.1f} hours")
    print(f"Expected confusion result: 1h + {abs(system_offset):.1f}h = {expected_confusion:.1f}h")
    print(f"Actual calculated result: {diff_hours:.1f}h")
    print(f"Match: {'✅ YES' if abs(diff_hours - expected_confusion) < 0.1 else '❌ NO'}")
    
    # STEP 8: Fix Recommendations
    print("\n🔧 IMMEDIATE FIXES REQUIRED")
    print("-" * 30)
    
    print("1. Backend: Send proper UTC timestamps")
    print("   - Add 'Z' suffix to ISO strings")
    print("   - Change: next_run.isoformat() → next_run.isoformat() + 'Z'")
    print()
    print("2. Frontend: Handle timezone-aware parsing")
    print("   - Ensure Date constructor recognizes UTC")
    print("   - Add validation for timezone handling")
    print()
    print("3. Add debugging")
    print("   - Log timezone info in both backend and frontend")
    print("   - Add time calculation validation")

if __name__ == "__main__":
    trace_scheduling_data_flow()
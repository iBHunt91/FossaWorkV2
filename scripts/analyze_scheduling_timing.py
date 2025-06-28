#!/usr/bin/env python3
"""
Comprehensive Analysis of Scheduling Time Calculation Issues

This script analyzes all potential failure points in the scheduling system
that could cause "5 hours instead of 1 hour" display issues.
"""

from datetime import datetime, timedelta
import json
import time

def analyze_time_calculations():
    """Analyze potential timing issues between backend and frontend"""
    
    print("=" * 60)
    print("COMPREHENSIVE SCHEDULING SYSTEM ANALYSIS")
    print("=" * 60)
    
    # 1. BACKEND TIME CALCULATION (Python)
    print("\n1. BACKEND TIME CALCULATION")
    print("-" * 30)
    
    current_utc = datetime.utcnow()
    interval_hours = 1.0
    next_run_utc = current_utc + timedelta(hours=interval_hours)
    
    print(f"Current UTC: {current_utc}")
    print(f"Interval: {interval_hours} hours")
    print(f"Next Run UTC: {next_run_utc}")
    print(f"ISO Format: {next_run_utc.isoformat()}")
    
    # Simulate what gets sent to frontend
    api_response = {
        "next_run": next_run_utc.isoformat(),
        "interval_hours": interval_hours,
        "enabled": True
    }
    print(f"API Response: {json.dumps(api_response, indent=2)}")
    
    # 2. FRONTEND TIME CALCULATION (JavaScript simulation)
    print("\n2. FRONTEND TIME CALCULATION SIMULATION")
    print("-" * 40)
    
    # Simulate JavaScript Date parsing
    next_run_iso = next_run_utc.isoformat()
    print(f"Received ISO string: {next_run_iso}")
    
    # Parse as if JavaScript Date constructor
    next_run_parsed = datetime.fromisoformat(next_run_iso)
    current_local = datetime.now()
    
    print(f"Parsed date: {next_run_parsed}")
    print(f"Current local time: {current_local}")
    
    # Calculate difference as frontend would
    diff_seconds = (next_run_parsed - current_local).total_seconds()
    diff_hours = diff_seconds / 3600
    diff_minutes = abs(diff_seconds) / 60
    
    print(f"Time difference: {diff_seconds} seconds")
    print(f"Time difference: {diff_hours:.2f} hours")
    print(f"Time difference: {diff_minutes:.1f} minutes")
    
    # 3. TIMEZONE ANALYSIS
    print("\n3. TIMEZONE ANALYSIS")
    print("-" * 20)
    
    # Get system timezone info
    local_now = datetime.now()
    utc_now = datetime.utcnow()
    timezone_offset_seconds = (local_now - utc_now).total_seconds()
    timezone_offset_hours = timezone_offset_seconds / 3600
    
    print(f"Local time: {local_now}")
    print(f"UTC time: {utc_now}")
    print(f"Timezone offset: {timezone_offset_hours:.1f} hours")
    print(f"System is: {'ahead of' if timezone_offset_hours > 0 else 'behind'} UTC")
    
    # 4. EDGE CASE SCENARIOS
    print("\n4. EDGE CASE SCENARIOS")
    print("-" * 25)
    
    # Scenario A: Backend stores UTC, frontend assumes local
    print("\nScenario A: UTC/Local Time Confusion")
    backend_utc = datetime.utcnow() + timedelta(hours=1)
    frontend_local_now = datetime.now()
    
    # If frontend treats UTC time as local time
    confused_diff = (backend_utc - frontend_local_now).total_seconds() / 3600
    print(f"Backend next_run (UTC): {backend_utc}")
    print(f"Frontend current (local): {frontend_local_now}")
    print(f"Confused calculation: {confused_diff:.2f} hours")
    
    # Scenario B: Double timezone application
    print("\nScenario B: Double Timezone Application")
    # If backend accidentally applies local timezone to UTC calculation
    local_offset = timezone_offset_hours
    double_offset_next_run = current_utc + timedelta(hours=1) + timedelta(hours=local_offset)
    double_diff = (double_offset_next_run - current_utc).total_seconds() / 3600
    print(f"Double-offset next_run: {double_offset_next_run}")
    print(f"Double-offset difference: {double_diff:.2f} hours")
    
    # Scenario C: Stale calculation from previous update
    print("\nScenario C: Stale Calculation")
    # If next_run wasn't updated properly and still contains old value
    old_calculation = current_utc + timedelta(hours=5)  # Old 5-hour interval
    stale_diff = (old_calculation - current_utc).total_seconds() / 3600
    print(f"Stale next_run (5h old): {old_calculation}")
    print(f"Stale difference: {stale_diff:.2f} hours")
    
    # 5. ACTUAL FRONTEND getRelativeTime SIMULATION
    print("\n5. FRONTEND getRelativeTime() SIMULATION")
    print("-" * 40)
    
    def simulate_getRelativeTime(dateString):
        """Simulate the frontend getRelativeTime function"""
        try:
            # Simulate JavaScript Date parsing
            date = datetime.fromisoformat(dateString.replace('Z', '+00:00') if dateString.endswith('Z') else dateString)
            now = datetime.now()
            
            diff_ms = (date - now).total_seconds() * 1000
            diff_minutes = abs(diff_ms) / (1000 * 60)
            
            if diff_ms < 0:
                # Past
                if diff_minutes < 1:
                    return 'just now'
                elif diff_minutes < 60:
                    return f'{int(diff_minutes)} minutes ago'
                elif diff_minutes < 1440:
                    return f'{int(diff_minutes / 60)} hours ago'
                else:
                    return f'{int(diff_minutes / 1440)} days ago'
            else:
                # Future
                if diff_minutes < 1:
                    return 'due now'
                elif diff_minutes < 60:
                    return f'in {int(diff_minutes)} minutes'
                elif diff_minutes < 1440:
                    return f'in {int(diff_minutes / 60)} hours'
                else:
                    return f'in {int(diff_minutes / 1440)} days'
        except Exception as e:
            return f'Error: {e}'
    
    # Test with correct 1-hour calculation
    correct_next_run = (datetime.now() + timedelta(hours=1)).isoformat()
    print(f"Correct 1h future: {simulate_getRelativeTime(correct_next_run)}")
    
    # Test with 5-hour calculation (the problem case)
    problem_next_run = (datetime.now() + timedelta(hours=5)).isoformat()
    print(f"Problem 5h future: {simulate_getRelativeTime(problem_next_run)}")
    
    # Test with UTC vs Local confusion
    utc_next_run = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    print(f"UTC 1h vs local now: {simulate_getRelativeTime(utc_next_run)}")
    
    # 6. RACE CONDITION ANALYSIS
    print("\n6. RACE CONDITION SCENARIOS")
    print("-" * 30)
    
    print("Potential race conditions:")
    print("- Multiple rapid schedule updates")
    print("- Schedule update during component re-render")
    print("- API response arriving after component unmount")
    print("- Event listener not cleaning up properly")
    print("- Browser timezone change during session")
    
    # 7. RECOMMENDATIONS
    print("\n7. ANALYSIS RESULTS & RECOMMENDATIONS")
    print("-" * 40)
    
    print("\nLikely Root Causes:")
    print("1. UTC/Local timezone confusion in calculations")
    print("2. Stale next_run values not being recalculated properly")
    print("3. Frontend using stale data during rapid updates")
    print("4. Race conditions between API calls and UI updates")
    
    print(f"\nTimezone Context:")
    print(f"- System timezone offset: {timezone_offset_hours:.1f} hours from UTC")
    print(f"- 1-hour interval + {abs(timezone_offset_hours):.1f}h offset = {1 + abs(timezone_offset_hours):.1f} hours")
    print(f"- This could explain '5 hours' if timezone offset is ~4 hours")
    
    print("\nCritical Issues Found:")
    if abs(timezone_offset_hours) >= 4:
        print(f"⚠️  CRITICAL: Timezone offset ({timezone_offset_hours:.1f}h) could cause confusion")
        print(f"    1h interval + {abs(timezone_offset_hours):.1f}h offset ≈ {1 + abs(timezone_offset_hours):.1f}h")
    
    print("\nRecommended Fixes:")
    print("1. Ensure consistent UTC usage in backend calculations")
    print("2. Add timezone validation in frontend date parsing") 
    print("3. Add logging to track next_run calculation steps")
    print("4. Implement proper event cleanup in React components")
    print("5. Add timezone display for debugging")

if __name__ == "__main__":
    analyze_time_calculations()
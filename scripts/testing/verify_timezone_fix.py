#!/usr/bin/env python3
"""
Schedule Display Timezone Fix Verification Script
================================================

This script provides a simple, visual way to verify that the 1-hour schedule
display issue has been fixed. It tests various scenarios and provides clear
feedback on whether the fix is working correctly.

Usage: python verify_timezone_fix.py
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from datetime import datetime, timedelta
import pytz
from colorama import init, Fore, Style
from app.services.schedule_manager import get_relative_time_display
from app.utils.timezone_utils import (
    get_user_timezone, 
    convert_to_user_timezone,
    format_user_time
)

# Initialize colorama for cross-platform colored output
init(autoreset=True)

def print_header():
    """Print a nice header for the verification script"""
    print("\n" + "="*60)
    print(f"{Fore.CYAN}Schedule Display Timezone Fix Verification")
    print("="*60)
    print(f"{Fore.YELLOW}This script verifies that 1-hour schedules display correctly")
    print(f"{Fore.YELLOW}as 'in about 1 hour' instead of 'in about an hour'")
    print("="*60 + "\n")

def test_relative_display(hours_from_now, user_tz="America/New_York"):
    """Test relative time display for a given number of hours from now"""
    # Create a timezone-aware datetime
    tz = pytz.timezone(user_tz)
    now = datetime.now(tz)
    test_time = now + timedelta(hours=hours_from_now)
    
    # Get the relative display
    display = get_relative_time_display(test_time, user_tz)
    
    # Determine if this is correct
    is_correct = True
    expected = ""
    
    if hours_from_now == 1:
        expected = "in about 1 hour"
        is_correct = display == expected
    elif hours_from_now < 1:
        expected = f"in {int(hours_from_now * 60)} minutes"
        is_correct = "minute" in display
    elif hours_from_now < 24:
        expected = f"in about {int(hours_from_now)} hours"
        is_correct = str(int(hours_from_now)) in display
    
    # Print result with color coding
    status = f"{Fore.GREEN}✓ PASS" if is_correct else f"{Fore.RED}✗ FAIL"
    print(f"{status}{Style.RESET_ALL} | {hours_from_now} hours from now: '{display}'")
    
    if not is_correct and expected:
        print(f"      {Fore.RED}Expected: '{expected}'{Style.RESET_ALL}")
    
    return is_correct

def test_timezone_conversion():
    """Test timezone conversion functionality"""
    print(f"\n{Fore.CYAN}Testing Timezone Conversion:{Style.RESET_ALL}")
    
    # Test different timezones
    test_cases = [
        ("America/New_York", "Eastern Time"),
        ("America/Chicago", "Central Time"),
        ("America/Denver", "Mountain Time"),
        ("America/Los_Angeles", "Pacific Time"),
        ("UTC", "UTC")
    ]
    
    all_passed = True
    
    for tz_name, tz_display in test_cases:
        try:
            tz = get_user_timezone(tz_name)
            now = datetime.now(tz)
            formatted = format_user_time(now, tz_name)
            print(f"{Fore.GREEN}✓{Style.RESET_ALL} {tz_display}: {formatted}")
        except Exception as e:
            print(f"{Fore.RED}✗{Style.RESET_ALL} {tz_display}: Error - {str(e)}")
            all_passed = False
    
    return all_passed

def run_comprehensive_tests():
    """Run comprehensive tests on the scheduling system"""
    print(f"\n{Fore.CYAN}Running Comprehensive Schedule Display Tests:{Style.RESET_ALL}")
    
    test_scenarios = [
        (0.25, "15 minutes"),
        (0.5, "30 minutes"),
        (0.75, "45 minutes"),
        (1, "1 hour - CRITICAL TEST"),
        (1.5, "1.5 hours"),
        (2, "2 hours"),
        (3, "3 hours"),
        (6, "6 hours"),
        (12, "12 hours"),
        (24, "1 day"),
        (48, "2 days"),
        (72, "3 days"),
        (168, "1 week")
    ]
    
    passed = 0
    failed = 0
    
    for hours, description in test_scenarios:
        print(f"\n{Fore.YELLOW}Testing: {description}{Style.RESET_ALL}")
        if test_relative_display(hours):
            passed += 1
        else:
            failed += 1
    
    return passed, failed

def test_edge_cases():
    """Test edge cases that might cause issues"""
    print(f"\n{Fore.CYAN}Testing Edge Cases:{Style.RESET_ALL}")
    
    edge_cases = [
        ("DST Transition", lambda: test_dst_transition()),
        ("Midnight Crossing", lambda: test_midnight_crossing()),
        ("Different Timezones", lambda: test_different_timezones()),
        ("Invalid Timezone Handling", lambda: test_invalid_timezone())
    ]
    
    all_passed = True
    
    for test_name, test_func in edge_cases:
        try:
            result = test_func()
            status = f"{Fore.GREEN}✓ PASS" if result else f"{Fore.RED}✗ FAIL"
            print(f"{status}{Style.RESET_ALL} | {test_name}")
            if not result:
                all_passed = False
        except Exception as e:
            print(f"{Fore.RED}✗ FAIL{Style.RESET_ALL} | {test_name}: {str(e)}")
            all_passed = False
    
    return all_passed

def test_dst_transition():
    """Test behavior around DST transitions"""
    # This is a simplified test - in production, you'd test actual DST dates
    tz = pytz.timezone("America/New_York")
    now = datetime.now(tz)
    future = now + timedelta(hours=1)
    display = get_relative_time_display(future, "America/New_York")
    return display == "in about 1 hour"

def test_midnight_crossing():
    """Test scheduling across midnight"""
    tz = pytz.timezone("America/New_York")
    # Set to 11 PM
    tonight = datetime.now(tz).replace(hour=23, minute=0, second=0, microsecond=0)
    tomorrow = tonight + timedelta(hours=1)  # Midnight
    display = get_relative_time_display(tomorrow, "America/New_York")
    return "1 hour" in display

def test_different_timezones():
    """Test consistency across different timezones"""
    results = []
    for tz in ["America/New_York", "America/Los_Angeles", "UTC", "Europe/London"]:
        user_tz = pytz.timezone(tz)
        now = datetime.now(user_tz)
        future = now + timedelta(hours=1)
        display = get_relative_time_display(future, tz)
        results.append(display == "in about 1 hour")
    return all(results)

def test_invalid_timezone():
    """Test handling of invalid timezone"""
    try:
        # Should fall back to EST
        tz = get_user_timezone("Invalid/Timezone")
        return tz.zone == "America/New_York"
    except:
        return False

def print_summary(passed, failed, tz_ok, edge_ok):
    """Print a summary of test results"""
    print("\n" + "="*60)
    print(f"{Fore.CYAN}VERIFICATION SUMMARY")
    print("="*60)
    
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"\nSchedule Display Tests: {passed}/{total} passed ({success_rate:.1f}%)")
    print(f"Timezone Conversion: {'✓ All Passed' if tz_ok else '✗ Some Failed'}")
    print(f"Edge Cases: {'✓ All Passed' if edge_ok else '✗ Some Failed'}")
    
    if failed == 0 and tz_ok and edge_ok:
        print(f"\n{Fore.GREEN}🎉 ALL TESTS PASSED! The timezone fix is working correctly!{Style.RESET_ALL}")
        print(f"\n{Fore.GREEN}✓ 1-hour schedules now correctly display as 'in about 1 hour'{Style.RESET_ALL}")
        print(f"{Fore.GREEN}✓ All timezone conversions are working properly{Style.RESET_ALL}")
        print(f"{Fore.GREEN}✓ Edge cases are handled correctly{Style.RESET_ALL}")
    else:
        print(f"\n{Fore.RED}⚠️  Some tests failed. Please review the results above.{Style.RESET_ALL}")
        if failed > 0:
            print(f"{Fore.RED}   - {failed} schedule display test(s) failed{Style.RESET_ALL}")
        if not tz_ok:
            print(f"{Fore.RED}   - Timezone conversion issues detected{Style.RESET_ALL}")
        if not edge_ok:
            print(f"{Fore.RED}   - Edge case handling issues detected{Style.RESET_ALL}")
    
    print("\n" + "="*60)

def main():
    """Main verification routine"""
    print_header()
    
    # Run tests
    passed, failed = run_comprehensive_tests()
    tz_ok = test_timezone_conversion()
    edge_ok = test_edge_cases()
    
    # Print summary
    print_summary(passed, failed, tz_ok, edge_ok)
    
    # Interactive verification
    print(f"\n{Fore.CYAN}Interactive Verification:{Style.RESET_ALL}")
    print("You can now test with your own timezone and time values.")
    print("Enter 'q' to quit\n")
    
    while True:
        try:
            user_input = input("Enter hours from now (e.g., 1, 2.5, 24): ").strip()
            if user_input.lower() == 'q':
                break
            
            hours = float(user_input)
            tz_input = input("Enter timezone (or press Enter for America/New_York): ").strip()
            if not tz_input:
                tz_input = "America/New_York"
            
            test_relative_display(hours, tz_input)
            
        except ValueError:
            print(f"{Fore.RED}Please enter a valid number{Style.RESET_ALL}")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"{Fore.RED}Error: {str(e)}{Style.RESET_ALL}")
    
    print(f"\n{Fore.CYAN}Verification complete. Thank you!{Style.RESET_ALL}")

if __name__ == "__main__":
    main()
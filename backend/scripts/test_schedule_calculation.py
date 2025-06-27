#!/usr/bin/env python3
"""
Test the schedule next run time calculation with and without active hours
"""

from datetime import datetime, timedelta
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

def test_cron_trigger_calculation():
    """Test how CronTrigger calculates next run times"""
    print("🧪 Testing CronTrigger Next Run Calculation")
    print("=" * 60)
    
    # Test 1: Every hour at :30
    print("\nTest 1: Every hour at :30")
    trigger = CronTrigger(minute=30, timezone='UTC')
    
    # Test at different times
    test_times = [
        datetime(2025, 1, 13, 10, 15, 0),  # 10:15 - should be 10:30
        datetime(2025, 1, 13, 10, 45, 0),  # 10:45 - should be 11:30
        datetime(2025, 1, 13, 23, 45, 0),  # 23:45 - should be 00:30 next day
    ]
    
    for test_time in test_times:
        next_run = trigger.get_next_fire_time(None, test_time)
        print(f"  Current time: {test_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"  Next run:     {next_run.strftime('%Y-%m-%d %H:%M')}")
        print()
    
    # Test 2: With active hours (6 AM to 10 PM)
    print("\nTest 2: Active hours 6:00-22:00, every hour at :30")
    trigger = CronTrigger(hour='6-21', minute=30, timezone='UTC')
    
    test_times = [
        datetime(2025, 1, 13, 5, 15, 0),   # 5:15 - should be 6:30
        datetime(2025, 1, 13, 10, 15, 0),  # 10:15 - should be 10:30
        datetime(2025, 1, 13, 21, 45, 0),  # 21:45 - should be 6:30 next day
        datetime(2025, 1, 13, 22, 15, 0),  # 22:15 - should be 6:30 next day
    ]
    
    for test_time in test_times:
        next_run = trigger.get_next_fire_time(None, test_time)
        print(f"  Current time: {test_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"  Next run:     {next_run.strftime('%Y-%m-%d %H:%M')}")
        print()
    
    # Test 3: Every 2 hours at :30
    print("\nTest 3: Every 2 hours at :30 (0:30, 2:30, 4:30, etc)")
    trigger = CronTrigger(hour='0,2,4,6,8,10,12,14,16,18,20,22', minute=30, timezone='UTC')
    
    test_times = [
        datetime(2025, 1, 13, 1, 15, 0),   # 1:15 - should be 2:30
        datetime(2025, 1, 13, 2, 45, 0),   # 2:45 - should be 4:30
        datetime(2025, 1, 13, 23, 15, 0),  # 23:15 - should be 0:30 next day
    ]
    
    for test_time in test_times:
        next_run = trigger.get_next_fire_time(None, test_time)
        print(f"  Current time: {test_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"  Next run:     {next_run.strftime('%Y-%m-%d %H:%M')}")
        print()

def test_interval_vs_cron():
    """Compare IntervalTrigger vs CronTrigger behavior"""
    print("\n🆚 Comparing IntervalTrigger vs CronTrigger")
    print("=" * 60)
    
    start_time = datetime(2025, 1, 13, 10, 15, 0)
    
    # IntervalTrigger - runs every hour from start time
    print("\nIntervalTrigger (1 hour interval):")
    interval_trigger = IntervalTrigger(hours=1, timezone='UTC', start_date=start_time)
    current = start_time
    for i in range(5):
        next_run = interval_trigger.get_next_fire_time(current, current)
        print(f"  Run {i+1}: {next_run.strftime('%Y-%m-%d %H:%M')}")
        current = next_run
    
    # CronTrigger - runs at fixed times
    print("\nCronTrigger (every hour at :30):")
    cron_trigger = CronTrigger(minute=30, timezone='UTC')
    current = start_time
    for i in range(5):
        next_run = cron_trigger.get_next_fire_time(None, current)
        print(f"  Run {i+1}: {next_run.strftime('%Y-%m-%d %H:%M')}")
        current = next_run

def simulate_schedule_behavior(interval_hours: float, active_hours: dict = None):
    """Simulate how the schedule should behave"""
    print(f"\n📅 Simulating Schedule Behavior")
    print(f"   Interval: {interval_hours} hours")
    print(f"   Active Hours: {active_hours}")
    print("=" * 60)
    
    # Create appropriate trigger
    if active_hours is None:
        print("   Using CronTrigger for consistent timing")
        if interval_hours == 1:
            trigger = CronTrigger(minute=30, timezone='UTC')
        else:
            hours = []
            hour = 0
            while hour < 24:
                hours.append(str(hour))
                hour += int(interval_hours)
            trigger = CronTrigger(hour=','.join(hours), minute=30, timezone='UTC')
    else:
        print(f"   Using CronTrigger with active hours {active_hours['start']}-{active_hours['end']}")
        trigger = CronTrigger(
            hour=f"{active_hours['start']}-{active_hours['end']-1}",
            minute=30,
            timezone='UTC'
        )
    
    # Test various current times
    test_scenarios = [
        ("Early morning", datetime(2025, 1, 13, 5, 15, 0)),
        ("Mid-morning", datetime(2025, 1, 13, 10, 15, 0)),
        ("After lunch", datetime(2025, 1, 13, 14, 45, 0)),
        ("Evening", datetime(2025, 1, 13, 21, 15, 0)),
        ("Late night", datetime(2025, 1, 13, 23, 45, 0)),
    ]
    
    for scenario, current_time in test_scenarios:
        next_run = trigger.get_next_fire_time(None, current_time)
        print(f"\n   {scenario}:")
        print(f"   Current: {current_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Next:    {next_run.strftime('%Y-%m-%d %H:%M')}")
        
        # Calculate time until next run
        time_diff = next_run - current_time
        hours = time_diff.total_seconds() / 3600
        print(f"   Wait:    {hours:.1f} hours")

if __name__ == "__main__":
    # Run all tests
    test_cron_trigger_calculation()
    test_interval_vs_cron()
    
    # Test our specific scenarios
    print("\n" + "=" * 60)
    print("🎯 Testing Specific Scenarios")
    print("=" * 60)
    
    # Scenario 1: No active hours restriction
    simulate_schedule_behavior(interval_hours=1.0, active_hours=None)
    
    # Scenario 2: With active hours (6 AM to 10 PM)
    simulate_schedule_behavior(interval_hours=1.0, active_hours={'start': 6, 'end': 22})
    
    # Scenario 3: Every 2 hours, no restriction
    simulate_schedule_behavior(interval_hours=2.0, active_hours=None)
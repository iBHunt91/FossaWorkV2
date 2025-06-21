#!/usr/bin/env python3
"""Check current scheduler status and last runs"""

import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory

print("\n" + "="*80)
print("🔍 SCHEDULER STATUS CHECK")
print("="*80)
print(f"Current Time: {datetime.now()}")
print(f"UTC Time: {datetime.now(timezone.utc)}")
print("="*80)

db = SessionLocal()

# Check schedules
print("\n📅 CURRENT SCHEDULES:")
print("-"*40)
schedules = db.query(ScrapingSchedule).all()
for schedule in schedules:
    print(f"\nUser: {schedule.user_id[:8]}...")
    print(f"  Enabled: {schedule.enabled}")
    print(f"  Interval: {schedule.interval_hours} hours")
    print(f"  Next Run: {schedule.next_run}")
    print(f"  Last Run: {schedule.last_run}")
    
    # Check if overdue
    if schedule.next_run:
        if schedule.next_run.tzinfo is None:
            next_run_utc = schedule.next_run.replace(tzinfo=timezone.utc)
        else:
            next_run_utc = schedule.next_run
        
        time_diff = (datetime.now(timezone.utc) - next_run_utc).total_seconds()
        if time_diff > 0:
            print(f"  ⚠️  OVERDUE by {time_diff/60:.1f} minutes!")

# Check recent history
print("\n📜 RECENT SCRAPING HISTORY:")
print("-"*40)
history = db.query(ScrapingHistory).order_by(
    ScrapingHistory.started_at.desc()
).limit(5).all()

for h in history:
    print(f"\nRun at: {h.started_at}")
    print(f"  User: {h.user_id[:8]}...")
    print(f"  Success: {'✅' if h.success else '❌'}")
    print(f"  Items: {h.items_processed}")
    print(f"  Duration: {(h.completed_at - h.started_at).total_seconds():.1f}s")
    
    # Time since run
    time_since = (datetime.now(timezone.utc) - h.started_at.replace(tzinfo=timezone.utc)).total_seconds()
    hours_ago = time_since / 3600
    if hours_ago < 1:
        print(f"  Time ago: {time_since/60:.0f} minutes ago")
    else:
        print(f"  Time ago: {hours_ago:.1f} hours ago")

# Check scheduler service type
print("\n⚙️  SCHEDULER SERVICE TYPE:")
print("-"*40)
try:
    from app.services.scheduler_service import scheduler_service
    print("Scheduler service imported successfully")
    
    if hasattr(scheduler_service, 'scheduler') and scheduler_service.scheduler:
        print("✅ FULL APScheduler service detected")
        print(f"   - Is initialized: {scheduler_service.is_initialized}")
        print(f"   - Is running: {scheduler_service.scheduler.running if scheduler_service.scheduler else 'N/A'}")
        
        if scheduler_service.scheduler:
            jobs = scheduler_service.scheduler.get_jobs()
            print(f"   - Active jobs: {len(jobs)}")
            for job in jobs:
                print(f"     • {job.id}: Next run at {job.next_run_time}")
    else:
        print("❌ SIMPLE scheduler service (database-only)")
        print("   - No automatic execution")
        print("   - Manual triggering required")
        print("   - next_run must be updated manually")
except Exception as e:
    print(f"❌ Error checking scheduler: {e}")

# Check FastAPI logs
print("\n📋 CHECKING LOGS:")
print("-"*40)
import glob
log_files = glob.glob("logs/backend/*backend-general*.jsonl")
if log_files:
    latest_log = max(log_files, key=lambda x: Path(x).stat().st_mtime)
    print(f"Latest log: {latest_log}")
    
    # Check for scheduler entries
    scheduler_entries = 0
    with open(latest_log, 'r') as f:
        for line in f:
            if 'scheduler' in line.lower() or 'SCHEDULER' in line:
                scheduler_entries += 1
    print(f"Scheduler log entries found: {scheduler_entries}")

db.close()

print("\n" + "="*80)
print("✅ Status check complete")
#!/usr/bin/env python3
"""
Diagnose scheduler state and history records
Identifies why scheduler is stuck and why history isn't being tracked
"""

import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.logging_service import get_logger

logger = get_logger("scheduler.diagnostic")

async def diagnose_issues():
    """Comprehensive diagnostic of scheduler and history issues"""
    print("\n" + "="*80)
    print("🔍 SCHEDULER & HISTORY DIAGNOSTIC")
    print("="*80)
    print(f"Current Time: {datetime.now()}")
    print(f"UTC Time: {datetime.now(timezone.utc)}")
    print("="*80)
    
    db = SessionLocal()
    issues = []
    
    try:
        # 1. Check schedules
        print("\n📅 CHECKING SCHEDULES:")
        print("-"*40)
        schedules = db.query(ScrapingSchedule).all()
        print(f"Total schedules: {len(schedules)}")
        
        for schedule in schedules:
            print(f"\n  User: {schedule.user_id}")
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
                    overdue_hours = time_diff / 3600
                    print(f"  ⚠️  OVERDUE by {overdue_hours:.1f} hours!")
                    issues.append(f"Schedule for {schedule.user_id} is overdue by {overdue_hours:.1f} hours")
        
        # 2. Check history records
        print("\n📜 CHECKING HISTORY RECORDS:")
        print("-"*40)
        history_count = db.query(ScrapingHistory).count()
        print(f"Total history records: {history_count}")
        
        if history_count == 0:
            print("❌ NO HISTORY RECORDS FOUND!")
            issues.append("No scraping history records exist")
        else:
            # Show recent history
            recent = db.query(ScrapingHistory).order_by(
                ScrapingHistory.started_at.desc()
            ).limit(5).all()
            
            print("\nRecent history:")
            for h in recent:
                print(f"  - {h.started_at}: {'✅' if h.success else '❌'} {h.items_processed or 0} items")
        
        # 3. Check if scheduler is running
        print("\n⚙️  CHECKING SCHEDULER SERVICE:")
        print("-"*40)
        
        try:
            # Check if we can import the scheduler
            from app.services.scheduler_service import scheduler_service
            print(f"Scheduler imported: ✅")
            print(f"Is initialized: {scheduler_service.is_initialized}")
            
            if scheduler_service.scheduler:
                print(f"Scheduler exists: ✅")
                print(f"Is running: {scheduler_service.scheduler.running}")
                
                # Check jobs
                jobs = scheduler_service.scheduler.get_jobs()
                print(f"Active jobs: {len(jobs)}")
                
                for job in jobs:
                    print(f"\n  Job: {job.id}")
                    print(f"  Next run: {job.next_run_time}")
                    
                    # Check if paused
                    if hasattr(job, 'next_run_time') and not job.next_run_time:
                        print(f"  ⚠️  Job appears to be paused!")
                        issues.append(f"Job {job.id} is paused")
            else:
                print("❌ Scheduler instance is None!")
                issues.append("Scheduler not initialized")
                
        except Exception as e:
            print(f"❌ Error checking scheduler: {e}")
            issues.append(f"Scheduler error: {str(e)}")
        
        # 4. Check last_run vs actual execution
        print("\n🔍 CHECKING EXECUTION TRACKING:")
        print("-"*40)
        
        # Look for evidence of execution in logs
        log_path = Path("logs/backend")
        if log_path.exists():
            today_logs = list(log_path.glob(f"*{datetime.now().strftime('%Y-%m-%d')}*.jsonl"))
            if today_logs:
                print(f"Found {len(today_logs)} log files from today")
                print("Checking for execution evidence...")
                
                # Quick scan for scheduled job entries
                execution_count = 0
                for log_file in today_logs:
                    try:
                        with open(log_file, 'r') as f:
                            for line in f:
                                if "SCHEDULED JOB STARTING" in line:
                                    execution_count += 1
                    except:
                        pass
                
                print(f"Found {execution_count} scheduled job executions in logs today")
                
                if execution_count > 0 and history_count == 0:
                    print("⚠️  Jobs are executing but NOT creating history records!")
                    issues.append("Jobs execute but don't create history records")
        
        # 5. Check why history might not be created
        print("\n🐛 ANALYZING HISTORY CREATION:")
        print("-"*40)
        
        # Read the execute_work_order_scraping function
        scheduler_file = Path(__file__).parent.parent / "app" / "services" / "scheduler_service.py"
        if scheduler_file.exists():
            with open(scheduler_file, 'r') as f:
                content = f.read()
                
            # Check if ScrapingHistory is created
            if "ScrapingHistory(" in content and "db.add(history)" in content:
                print("✅ Code appears to create history records")
            else:
                print("❌ Code does NOT create ScrapingHistory records!")
                issues.append("execute_work_order_scraping doesn't save history")
                
                # Check what it does instead
                if "schedule.last_run" in content:
                    print("   - Updates schedule.last_run only")
                if "logger.info" in content:
                    print("   - Logs execution info")
        
    finally:
        db.close()
    
    # Summary
    print("\n" + "="*80)
    print("📊 DIAGNOSTIC SUMMARY:")
    print("="*80)
    
    if issues:
        print("\n⚠️  ISSUES FOUND:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
    else:
        print("\n✅ No obvious issues found")
    
    print("\n💡 RECOMMENDATIONS:")
    print("  1. If history records are missing, run: fix_missing_history_records.py")
    print("  2. If scheduler is stuck, run: diagnose_and_fix_scheduler.py")
    print("  3. Check FastAPI logs for scheduler initialization errors")
    print("  4. Ensure SECRET_KEY is set in environment when running scripts")
    
    return issues

if __name__ == "__main__":
    asyncio.run(diagnose_issues())
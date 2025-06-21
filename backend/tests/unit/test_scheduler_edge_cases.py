#!/usr/bin/env python3
"""
Comprehensive scheduler test covering edge cases
Tests initialization, job execution, timezone handling, and recovery
"""

import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytz

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule, ScrapingHistory
from app.services.scheduler_service import scheduler_service, execute_work_order_scraping
from app.services.logging_service import get_logger
from apscheduler.triggers.cron import CronTrigger

logger = get_logger("scheduler.test")

class SchedulerTester:
    """Comprehensive scheduler testing with edge case handling"""
    
    def __init__(self):
        self.test_results = []
        self.db = SessionLocal()
    
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now()
        }
        self.test_results.append(result)
        
        icon = "✅" if passed else "❌"
        print(f"\n{icon} {test_name}")
        if details:
            print(f"   {details}")
    
    async def test_scheduler_initialization(self):
        """Test 1: Scheduler Initialization"""
        print("\n" + "="*60)
        print("TEST 1: SCHEDULER INITIALIZATION")
        print("="*60)
        
        try:
            # Check if already initialized
            if scheduler_service.is_initialized:
                self.log_test("Scheduler already initialized", True, 
                            f"Running: {scheduler_service.scheduler.running}")
            else:
                # Initialize
                db_url = "sqlite:///./fossawork_v2.db"
                await scheduler_service.initialize(db_url)
                self.log_test("Scheduler initialization", True, 
                            "Successfully initialized")
        except Exception as e:
            self.log_test("Scheduler initialization", False, str(e))
            return False
        
        return True
    
    async def test_timezone_handling(self):
        """Test 2: Timezone Handling"""
        print("\n" + "="*60)
        print("TEST 2: TIMEZONE HANDLING")
        print("="*60)
        
        # Test different timezone scenarios
        now_utc = datetime.now(timezone.utc)
        now_local = datetime.now()
        now_eastern = datetime.now(pytz.timezone('US/Eastern'))
        
        print(f"UTC Time: {now_utc}")
        print(f"Local Time: {now_local}")
        print(f"Eastern Time: {now_eastern}")
        
        # Check database timestamps
        try:
            schedules = self.db.query(ScrapingSchedule).all()
            for schedule in schedules:
                if schedule.next_run:
                    is_aware = schedule.next_run.tzinfo is not None
                    self.log_test(f"Schedule {schedule.user_id} timezone aware", 
                                is_aware, 
                                f"Next run: {schedule.next_run}")
        except Exception as e:
            self.log_test("Timezone check", False, str(e))
    
    async def test_job_registration(self):
        """Test 3: Job Registration and Persistence"""
        print("\n" + "="*60)
        print("TEST 3: JOB REGISTRATION")
        print("="*60)
        
        try:
            # Get all jobs
            jobs = scheduler_service.scheduler.get_jobs()
            self.log_test("Job retrieval", True, f"Found {len(jobs)} jobs")
            
            # Check each job
            for job in jobs:
                # Check job properties
                has_trigger = job.trigger is not None
                has_next_run = job.next_run_time is not None
                is_pending = job.pending
                
                self.log_test(f"Job {job.id} properties", 
                            has_trigger and has_next_run,
                            f"Trigger: {type(job.trigger).__name__}, "
                            f"Next: {job.next_run_time}, Pending: {is_pending}")
                
                # Check if job function is accessible
                try:
                    func = job.func
                    self.log_test(f"Job {job.id} function", True, 
                                f"Function: {func.__name__}")
                except Exception as e:
                    self.log_test(f"Job {job.id} function", False, str(e))
        
        except Exception as e:
            self.log_test("Job registration test", False, str(e))
    
    async def test_misfire_handling(self):
        """Test 4: Misfire Grace Time and Recovery"""
        print("\n" + "="*60)
        print("TEST 4: MISFIRE HANDLING")
        print("="*60)
        
        try:
            # Check for overdue jobs
            jobs = scheduler_service.scheduler.get_jobs()
            now = datetime.now(timezone.utc)
            
            for job in jobs:
                if job.next_run_time:
                    time_diff = (now - job.next_run_time).total_seconds()
                    
                    if time_diff > 0:
                        # Job is overdue
                        within_grace = time_diff < 3600  # 60 minutes grace
                        self.log_test(f"Job {job.id} misfire grace", 
                                    within_grace,
                                    f"Overdue by {time_diff/60:.1f} minutes")
                        
                        if not within_grace:
                            print(f"   ⚠️  Job exceeds grace period - may need manual intervention")
        
        except Exception as e:
            self.log_test("Misfire handling test", False, str(e))
    
    async def test_job_execution(self):
        """Test 5: Direct Job Execution"""
        print("\n" + "="*60)
        print("TEST 5: JOB EXECUTION")
        print("="*60)
        
        # Get a test user
        schedule = self.db.query(ScrapingSchedule).filter(
            ScrapingSchedule.enabled == True
        ).first()
        
        if not schedule:
            self.log_test("Job execution test", False, "No enabled schedules found")
            return
        
        user_id = schedule.user_id
        print(f"\nTesting execution for user: {user_id}")
        
        # Count history before
        history_before = self.db.query(ScrapingHistory).filter(
            ScrapingHistory.user_id == user_id
        ).count()
        
        try:
            # Create a task for execution
            print("Starting job execution...")
            task = asyncio.create_task(execute_work_order_scraping(user_id))
            
            # Wait for up to 60 seconds
            await asyncio.wait_for(task, timeout=60.0)
            
            # Check if history was created
            await asyncio.sleep(2)  # Give time for DB write
            history_after = self.db.query(ScrapingHistory).filter(
                ScrapingHistory.user_id == user_id
            ).count()
            
            new_records = history_after - history_before
            self.log_test("Job execution", new_records > 0, 
                        f"New history records: {new_records}")
            
        except asyncio.TimeoutError:
            self.log_test("Job execution", False, "Execution timed out after 60 seconds")
        except Exception as e:
            self.log_test("Job execution", False, str(e))
    
    async def test_scheduler_persistence(self):
        """Test 6: Scheduler Persistence After Restart"""
        print("\n" + "="*60)
        print("TEST 6: SCHEDULER PERSISTENCE")
        print("="*60)
        
        try:
            # Get current jobs
            jobs_before = len(scheduler_service.scheduler.get_jobs())
            
            # Simulate restart by shutting down and reinitializing
            print("Simulating scheduler restart...")
            await scheduler_service.shutdown()
            
            # Wait a bit
            await asyncio.sleep(2)
            
            # Reinitialize
            db_url = "sqlite:///./fossawork_v2.db"
            await scheduler_service.initialize(db_url)
            
            # Check jobs after restart
            jobs_after = len(scheduler_service.scheduler.get_jobs())
            
            self.log_test("Scheduler persistence", jobs_after == jobs_before,
                        f"Jobs before: {jobs_before}, after: {jobs_after}")
            
        except Exception as e:
            self.log_test("Scheduler persistence test", False, str(e))
    
    async def test_concurrent_execution_prevention(self):
        """Test 7: Concurrent Execution Prevention"""
        print("\n" + "="*60)
        print("TEST 7: CONCURRENT EXECUTION PREVENTION")
        print("="*60)
        
        # This tests that max_instances=1 prevents multiple executions
        try:
            jobs = scheduler_service.scheduler.get_jobs()
            for job in jobs:
                max_instances = job.max_instances
                self.log_test(f"Job {job.id} max instances", 
                            max_instances == 1,
                            f"Max instances: {max_instances}")
        except Exception as e:
            self.log_test("Concurrent execution test", False, str(e))
    
    async def test_schedule_updates(self):
        """Test 8: Dynamic Schedule Updates"""
        print("\n" + "="*60)
        print("TEST 8: DYNAMIC SCHEDULE UPDATES")
        print("="*60)
        
        try:
            # Get a schedule
            schedule = self.db.query(ScrapingSchedule).first()
            if not schedule:
                self.log_test("Schedule update test", False, "No schedules found")
                return
            
            job_id = f"work_order_scrape_{schedule.user_id}"
            
            # Update the schedule
            success = await scheduler_service.update_schedule(
                job_id=job_id,
                interval_hours=2.0  # Change to 2 hours
            )
            
            self.log_test("Schedule update", success, 
                        "Successfully updated interval to 2 hours")
            
            # Verify the change
            job = scheduler_service.scheduler.get_job(job_id)
            if job:
                print(f"   New trigger: {job.trigger}")
                print(f"   Next run: {job.next_run_time}")
            
        except Exception as e:
            self.log_test("Schedule update test", False, str(e))
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["passed"])
        failed_tests = total_tests - passed_tests
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        if failed_tests > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n" + "="*80)
        
    async def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*80)
        print("🧪 COMPREHENSIVE SCHEDULER TEST SUITE")
        print("="*80)
        print(f"Started: {datetime.now()}")
        print("="*80)
        
        # Run tests in order
        if await self.test_scheduler_initialization():
            await self.test_timezone_handling()
            await self.test_job_registration()
            await self.test_misfire_handling()
            await self.test_job_execution()
            await self.test_scheduler_persistence()
            await self.test_concurrent_execution_prevention()
            await self.test_schedule_updates()
        
        self.print_summary()

async def main():
    """Main test runner"""
    tester = SchedulerTester()
    
    try:
        await tester.run_all_tests()
    finally:
        tester.db.close()
    
    print("\n💡 RECOMMENDATIONS:")
    print("1. Ensure FastAPI app is running for scheduler to work properly")
    print("2. Check /logs/backend/ for detailed scheduler logs")
    print("3. Monitor for EVENT_JOB_MISSED events in logs")
    print("4. Consider implementing health checks for scheduler")
    print("5. Set up alerts for failed/missed jobs")

if __name__ == "__main__":
    asyncio.run(main())
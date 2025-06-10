#!/usr/bin/env python3
"""
Simple Schedule Detection Test

Test the core comparison algorithm without database dependencies.
"""

import asyncio
import json
from datetime import datetime

# Mock minimal service class for testing
class MockScheduleDetectionService:
    """Simplified version for testing core logic"""
    
    def _get_job_id(self, job):
        return job.get("id", job.get("jobId", "unknown"))
    
    def _get_visit_date(self, job):
        if "visits" in job and "nextVisit" in job["visits"]:
            return job["visits"]["nextVisit"].get("date", "")
        return job.get("date", "")
    
    def _get_store_number(self, job):
        if "customer" in job:
            return job["customer"].get("storeNumber", "")
        return job.get("store", "")
    
    def _get_store_name(self, job):
        if "customer" in job:
            return job["customer"].get("name", "")
        return job.get("storeName", "")
    
    def _get_dispenser_count(self, job):
        if "services" in job:
            for service in job["services"]:
                if "meter" in service.get("type", "").lower():
                    return service.get("quantity", 0)
        return 0
    
    def _should_include_job(self, job, user_preferences):
        if not user_preferences or not user_preferences.get("notifications"):
            return True
        
        filters = user_preferences["notifications"].get("filters", {})
        
        # Check store filter
        stores_filter = filters.get("stores", [])
        if stores_filter:
            store_number = self._get_store_number(job)
            if store_number not in stores_filter:
                return False
        
        return True
    
    async def compare_schedules_simple(self, current_schedule, previous_schedule, user_preferences=None):
        """Simplified comparison for testing"""
        changes = {
            "allChanges": [],
            "summary": {"removed": 0, "added": 0, "modified": 0, "swapped": 0}
        }
        
        current_work_orders = current_schedule.get("workOrders", [])
        previous_work_orders = previous_schedule.get("workOrders", [])
        
        # Create maps
        current_jobs = {self._get_job_id(job): job for job in current_work_orders}
        previous_jobs = {self._get_job_id(job): job for job in previous_work_orders}
        
        processed_jobs = set()
        date_changes = []
        
        # Step 1: Find date changes
        for job_id, current_job in current_jobs.items():
            if job_id in processed_jobs:
                continue
            
            previous_job = previous_jobs.get(job_id)
            if previous_job:
                current_date = self._get_visit_date(current_job)
                previous_date = self._get_visit_date(previous_job)
                
                if current_date != previous_date:
                    if not self._should_include_job(current_job, user_preferences):
                        continue
                    
                    date_changes.append({
                        "jobId": job_id,
                        "oldDate": previous_date,
                        "newDate": current_date,
                        "job": current_job
                    })
                    processed_jobs.add(job_id)
                else:
                    processed_jobs.add(job_id)
        
        # Step 2: Find removed jobs
        for job_id, previous_job in previous_jobs.items():
            if job_id not in current_jobs and job_id not in processed_jobs:
                if self._should_include_job(previous_job, user_preferences):
                    changes["allChanges"].append({
                        "type": "removed",
                        "jobId": job_id,
                        "store": self._get_store_number(previous_job),
                        "date": self._get_visit_date(previous_job)
                    })
                    changes["summary"]["removed"] += 1
                processed_jobs.add(job_id)
        
        # Step 3: Find added jobs
        for job_id, current_job in current_jobs.items():
            if job_id not in previous_jobs and job_id not in processed_jobs:
                if self._should_include_job(current_job, user_preferences):
                    changes["allChanges"].append({
                        "type": "added",
                        "jobId": job_id,
                        "store": self._get_store_number(current_job),
                        "date": self._get_visit_date(current_job)
                    })
                    changes["summary"]["added"] += 1
                processed_jobs.add(job_id)
        
        # Step 4: Check for swaps
        processed_swaps = set()
        for change in date_changes:
            job_id = change["jobId"]
            old_date = change["oldDate"]
            new_date = change["newDate"]
            
            if job_id in processed_swaps:
                continue
            
            # Look for reciprocal swap
            potential_swap = None
            for other_change in date_changes:
                if (other_change["jobId"] != job_id and
                    other_change["oldDate"] == new_date and
                    other_change["newDate"] == old_date and
                    other_change["jobId"] not in processed_swaps):
                    potential_swap = other_change
                    break
            
            if potential_swap:
                changes["allChanges"].append({
                    "type": "swap",
                    "job1Id": job_id,
                    "job2Id": potential_swap["jobId"],
                    "job1Store": self._get_store_number(change["job"]),
                    "job2Store": self._get_store_number(potential_swap["job"]),
                    "oldDate1": old_date,
                    "newDate1": new_date,
                    "oldDate2": potential_swap["oldDate"],
                    "newDate2": potential_swap["newDate"]
                })
                changes["summary"]["swapped"] += 1
                processed_swaps.add(job_id)
                processed_swaps.add(potential_swap["jobId"])
            else:
                changes["allChanges"].append({
                    "type": "date_changed",
                    "jobId": job_id,
                    "store": self._get_store_number(change["job"]),
                    "oldDate": old_date,
                    "newDate": new_date
                })
                changes["summary"]["modified"] += 1
        
        return changes

# Test data
PREVIOUS = {
    "workOrders": [
        {
            "id": "W-123456",
            "customer": {"storeNumber": "7001", "name": "Wawa #001"},
            "visits": {"nextVisit": {"date": "2025-01-10"}},
            "services": [{"type": "Meter Calibration", "quantity": 4}]
        },
        {
            "id": "W-123457",
            "customer": {"storeNumber": "7002", "name": "Wawa #002"},
            "visits": {"nextVisit": {"date": "2025-01-11"}},
            "services": [{"type": "Meter Calibration", "quantity": 6}]
        },
        {
            "id": "W-123458",
            "customer": {"storeNumber": "7003", "name": "Circle K #003"},
            "visits": {"nextVisit": {"date": "2025-01-12"}},
            "services": [{"type": "Meter Calibration", "quantity": 8}]
        }
    ]
}

CURRENT = {
    "workOrders": [
        {
            "id": "W-123456",
            "customer": {"storeNumber": "7001", "name": "Wawa #001"},
            "visits": {"nextVisit": {"date": "2025-01-13"}},  # Date changed
            "services": [{"type": "Meter Calibration", "quantity": 4}]
        },
        {
            "id": "W-123457",
            "customer": {"storeNumber": "7002", "name": "Wawa #002"},
            "visits": {"nextVisit": {"date": "2025-01-12"}},  # Swapped with W-123458
            "services": [{"type": "Meter Calibration", "quantity": 6}]
        },
        {
            "id": "W-123458",
            "customer": {"storeNumber": "7003", "name": "Circle K #003"},
            "visits": {"nextVisit": {"date": "2025-01-11"}},  # Swapped with W-123457
            "services": [{"type": "Meter Calibration", "quantity": 8}]
        },
        {
            "id": "W-123459",
            "customer": {"storeNumber": "7004", "name": "Speedway #004"},
            "visits": {"nextVisit": {"date": "2025-01-14"}},  # New job
            "services": [{"type": "Meter Calibration", "quantity": 3}]
        }
    ]
}

async def test_simple():
    """Test the core algorithm"""
    print("🧪 Testing Schedule Detection Core Algorithm")
    print("=" * 50)
    
    service = MockScheduleDetectionService()
    
    try:
        changes = await service.compare_schedules_simple(CURRENT, PREVIOUS)
        
        print("📊 Detected Changes:")
        print(f"  Added: {changes['summary']['added']}")
        print(f"  Removed: {changes['summary']['removed']}")
        print(f"  Modified: {changes['summary']['modified']}")
        print(f"  Swapped: {changes['summary']['swapped']}")
        print(f"  Total: {len(changes['allChanges'])}")
        
        print("\n📝 Change Details:")
        for i, change in enumerate(changes['allChanges'], 1):
            change_type = change['type']
            print(f"  {i}. {change_type.upper()}: ", end="")
            
            if change_type == 'swap':
                print(f"Jobs {change['job1Id']} ↔ {change['job2Id']} swapped dates")
            elif change_type == 'date_changed':
                print(f"Job {change['jobId']} date: {change['oldDate']} → {change['newDate']}")
            elif change_type == 'added':
                print(f"Job {change['jobId']} added on {change['date']}")
            elif change_type == 'removed':
                print(f"Job {change['jobId']} removed from {change['date']}")
        
        # Verify expectations
        print("\n✅ Verification:")
        
        # Should detect 1 swap (W-123457 ↔ W-123458)
        swaps = [c for c in changes['allChanges'] if c['type'] == 'swap']
        expected_swaps = 1
        print(f"  Swaps: {len(swaps)}/{expected_swaps} {'✓' if len(swaps) == expected_swaps else '✗'}")
        
        # Should detect 1 date change (W-123456)
        date_changes = [c for c in changes['allChanges'] if c['type'] == 'date_changed']
        expected_date_changes = 1
        print(f"  Date Changes: {len(date_changes)}/{expected_date_changes} {'✓' if len(date_changes) == expected_date_changes else '✗'}")
        
        # Should detect 1 addition (W-123459)
        additions = [c for c in changes['allChanges'] if c['type'] == 'added']
        expected_additions = 1
        print(f"  Additions: {len(additions)}/{expected_additions} {'✓' if len(additions) == expected_additions else '✗'}")
        
        # Should detect 0 removals
        removals = [c for c in changes['allChanges'] if c['type'] == 'removed']
        expected_removals = 0
        print(f"  Removals: {len(removals)}/{expected_removals} {'✓' if len(removals) == expected_removals else '✗'}")
        
        all_correct = (len(swaps) == expected_swaps and 
                      len(date_changes) == expected_date_changes and
                      len(additions) == expected_additions and
                      len(removals) == expected_removals)
        
        print(f"\n🎯 Overall Result: {'✅ SUCCESS' if all_correct else '❌ FAILED'}")
        return all_correct
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_filtering():
    """Test user preference filtering"""
    print("\n🎯 Testing User Preference Filtering")
    print("=" * 50)
    
    # Only include Wawa stores (7001, 7002)
    user_preferences = {
        "notifications": {
            "filters": {
                "stores": ["7001", "7002"]
            }
        }
    }
    
    service = MockScheduleDetectionService()
    
    try:
        changes = await service.compare_schedules_simple(CURRENT, PREVIOUS, user_preferences)
        
        print(f"📊 Filtered Results (Wawa stores only):")
        print(f"  Total Changes: {len(changes['allChanges'])}")
        
        # Should only see changes for stores 7001 and 7002
        wawa_only = True
        for change in changes['allChanges']:
            store = change.get('store', '')
            job1_store = change.get('job1Store', '')
            job2_store = change.get('job2Store', '')
            
            if store and store not in ["7001", "7002"]:
                wawa_only = False
                print(f"  ❌ Found non-Wawa change: {change['type']} for store {store}")
            elif job1_store and (job1_store not in ["7001", "7002"] or job2_store not in ["7001", "7002"]):
                wawa_only = False
                print(f"  ❌ Found non-Wawa swap: {job1_store} ↔ {job2_store}")
            else:
                print(f"  ✓ {change['type']}: Store {store or f'{job1_store} ↔ {job2_store}'}")
        
        print(f"\n🎯 Filtering Result: {'✅ SUCCESS' if wawa_only else '❌ FAILED'}")
        return wawa_only
        
    except Exception as e:
        print(f"❌ Filtering test failed: {str(e)}")
        return False

if __name__ == "__main__":
    async def main():
        print("🚀 Starting Simple Schedule Detection Tests\n")
        
        test1 = await test_simple()
        test2 = await test_filtering()
        
        print("\n" + "=" * 50)
        print("📈 Final Results:")
        print(f"  Core Algorithm: {'✅ PASS' if test1 else '❌ FAIL'}")
        print(f"  User Filtering: {'✅ PASS' if test2 else '❌ FAIL'}")
        
        if test1 and test2:
            print("\n🎉 All tests passed! Schedule detection logic is working correctly.")
            print("✅ Ready to implement full V2 schedule detection service!")
        else:
            print("\n⚠️  Some tests failed. The schedule detection needs fixes.")
    
    asyncio.run(main())
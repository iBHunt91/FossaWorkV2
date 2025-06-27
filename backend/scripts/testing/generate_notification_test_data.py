#!/usr/bin/env python3
"""
Generate notification test data for testing dashboard.

This script creates realistic test data for all notification scenarios including:
- Automation events (started, completed, failed)
- Schedule changes
- Daily digest reports
- Error alerts
- System maintenance notifications
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to Python path
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.services.notification_manager import NotificationTrigger, NotificationChannel


def generate_automation_test_data():
    """Generate test data for automation notifications"""
    base_time = datetime.utcnow()
    
    return {
        "automation_started": {
            "station_name": "Shell Station #4567",
            "job_id": "AUTO-TEST-001",
            "work_order_id": "W-456789",
            "started_time": base_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "service_type": "AccuMeasure",
            "dispenser_count": 6,
            "estimated_duration": "8 minutes",
            "service_code": "2861"
        },
        "automation_completed": {
            "station_name": "Shell Station #4567",
            "job_id": "AUTO-TEST-001",
            "work_order_id": "W-456789",
            "started_time": (base_time - timedelta(minutes=8)).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "completed_time": base_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "service_type": "AccuMeasure",
            "dispenser_count": 6,
            "actual_duration": "7 minutes 32 seconds",
            "forms_completed": 6,
            "success_rate": "100%"
        },
        "automation_failed": {
            "station_name": "Shell Station #4567",
            "job_id": "AUTO-TEST-002",
            "work_order_id": "W-456790",
            "started_time": (base_time - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "failure_time": (base_time - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "service_type": "AccuMeasure",
            "dispenser_count": 4,
            "progress_percentage": 75,
            "error_message": "Form submission timeout after 30 seconds",
            "retry_available": True,
            "last_successful_step": "Filled dispenser information for dispenser 3"
        },
        "automation_progress": {
            "station_name": "Shell Station #4567",
            "job_id": "AUTO-TEST-003",
            "work_order_id": "W-456791",
            "progress_percentage": 60,
            "current_step": "Processing dispenser 4 of 6",
            "estimated_completion": "3 minutes",
            "dispensers_completed": 3,
            "total_dispensers": 6
        }
    }


def generate_schedule_test_data():
    """Generate test data for schedule change notifications"""
    return {
        "schedule_change": {
            "change_type": "New Work Order Added",
            "work_order_id": "W-456792",
            "station_name": "Speedway #1234",
            "scheduled_date": (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "service_type": "AccuMeasure",
            "urgency": "Standard",
            "change_reason": "Customer requested additional service",
            "notification_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        }
    }


def generate_digest_test_data():
    """Generate test data for daily/weekly digest notifications"""
    base_date = datetime.utcnow()
    yesterday = base_date - timedelta(days=1)
    
    return {
        "daily_digest": {
            "date": yesterday.strftime("%Y-%m-%d"),
            "total_jobs": 8,
            "successful_jobs": 7,
            "failed_jobs": 1,
            "dispensers_processed": 42,
            "total_duration": "1 hour 23 minutes",
            "average_duration": "10 minutes 22 seconds",
            "recent_jobs": [
                {
                    "station_name": "Shell Station #4567",
                    "status": "completed",
                    "time": "16:45",
                    "duration": "8 minutes"
                },
                {
                    "station_name": "Speedway #1234", 
                    "status": "completed",
                    "time": "15:20",
                    "duration": "12 minutes"
                },
                {
                    "station_name": "Marathon #5678",
                    "status": "failed",
                    "time": "14:15",
                    "error": "Connection timeout"
                },
                {
                    "station_name": "BP Station #9012",
                    "status": "completed", 
                    "time": "13:30",
                    "duration": "9 minutes"
                },
                {
                    "station_name": "Exxon #3456",
                    "status": "completed",
                    "time": "12:45",
                    "duration": "11 minutes"
                }
            ],
            "performance_summary": {
                "success_rate": "87.5%",
                "average_response_time": "2.3 seconds",
                "fastest_job": "6 minutes 15 seconds",
                "slowest_job": "15 minutes 42 seconds"
            }
        },
        "weekly_summary": {
            "week_start": (base_date - timedelta(days=7)).strftime("%Y-%m-%d"),
            "week_end": yesterday.strftime("%Y-%m-%d"),
            "total_jobs": 42,
            "successful_jobs": 38,
            "failed_jobs": 4,
            "dispensers_processed": 234,
            "stations_serviced": 28,
            "busiest_day": "Wednesday (8 jobs)",
            "success_rate": "90.5%",
            "weekly_trends": {
                "Monday": {"jobs": 6, "success": 5},
                "Tuesday": {"jobs": 8, "success": 7},
                "Wednesday": {"jobs": 8, "success": 8},
                "Thursday": {"jobs": 7, "success": 6},
                "Friday": {"jobs": 5, "success": 5},
                "Saturday": {"jobs": 4, "success": 4},
                "Sunday": {"jobs": 4, "success": 3}
            }
        }
    }


def generate_error_test_data():
    """Generate test data for error and system notifications"""
    return {
        "error_alert": {
            "error_type": "System Error",
            "severity": "High",
            "error_message": "Database connection pool exhausted",
            "affected_services": ["Form Automation", "Work Order Scraping"],
            "occurrence_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "error_count": 3,
            "last_occurrence": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "recovery_action": "Database connection pool reset automatically",
            "user_action_required": False
        },
        "system_maintenance": {
            "maintenance_type": "Scheduled Update",
            "start_time": (datetime.utcnow() + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "estimated_duration": "30 minutes",
            "affected_services": ["Web Interface", "API Endpoints"],
            "maintenance_reason": "Security updates and performance improvements",
            "backup_procedures": "All data will be backed up before maintenance",
            "contact_info": "support@fossawork.com"
        }
    }


def generate_comprehensive_test_data():
    """Generate all test data scenarios"""
    test_data = {
        "automation": generate_automation_test_data(),
        "schedule": generate_schedule_test_data(),
        "digest": generate_digest_test_data(),
        "alerts": generate_error_test_data(),
        "metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "test_scenarios": [
                "automation_started",
                "automation_completed", 
                "automation_failed",
                "automation_progress",
                "schedule_change",
                "daily_digest",
                "weekly_summary",
                "error_alert",
                "system_maintenance"
            ],
            "description": "Comprehensive test data for notification system testing"
        }
    }
    
    return test_data


async def main():
    """Generate and save test data"""
    print("🔧 Generating notification test data...")
    
    # Generate comprehensive test data
    test_data = generate_comprehensive_test_data()
    
    # Create output directory if it doesn't exist
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    
    # Save test data to file
    output_file = output_dir / "notification_test_data.json"
    with open(output_file, 'w') as f:
        json.dump(test_data, f, indent=2)
    
    print(f"✅ Test data generated successfully!")
    print(f"📄 Saved to: {output_file}")
    print(f"🔢 Generated {len(test_data['metadata']['test_scenarios'])} test scenarios")
    
    # Display summary
    print("\n📊 Test Scenarios Generated:")
    for category, data in test_data.items():
        if category != "metadata":
            print(f"   {category.title()}: {len(data)} scenarios")
    
    print(f"\n💡 Use this data to test notification templates and delivery mechanisms")
    print(f"📋 Scenarios include: {', '.join(test_data['metadata']['test_scenarios'])}")


if __name__ == "__main__":
    asyncio.run(main())
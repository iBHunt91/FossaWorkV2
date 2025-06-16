#!/usr/bin/env python3
"""
Test script for Settings API endpoints
"""

import asyncio
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000"
TEST_USER_ID = "demo"

# Test credentials (you'll need to login first to get a token)
AUTH_HEADERS = {
    "Authorization": "Bearer your-token-here"
}

async def test_smtp_settings():
    """Test SMTP settings endpoints"""
    print("\n=== Testing SMTP Settings ===")
    
    async with httpx.AsyncClient() as client:
        # Get current SMTP settings
        response = await client.get(
            f"{BASE_URL}/api/settings/smtp/{TEST_USER_ID}",
            headers=AUTH_HEADERS
        )
        print(f"GET SMTP Settings: {response.status_code}")
        if response.status_code == 200:
            print(f"Current settings: {response.json()}")
        
        # Update SMTP settings
        smtp_data = {
            "smtp_server": "smtp.gmail.com",
            "smtp_port": 587,
            "username": "test@example.com",
            "password": "test-password",
            "use_tls": True,
            "use_ssl": False,
            "from_email": "noreply@example.com",
            "from_name": "FossaWork Test",
            "timeout": 30
        }
        
        response = await client.post(
            f"{BASE_URL}/api/settings/smtp/{TEST_USER_ID}",
            json=smtp_data,
            headers=AUTH_HEADERS
        )
        print(f"POST SMTP Settings: {response.status_code}")
        
        # Test SMTP (this will fail without real credentials)
        # response = await client.post(
        #     f"{BASE_URL}/api/settings/smtp/{TEST_USER_ID}/test",
        #     params={"test_email": "test@example.com"},
        #     headers=AUTH_HEADERS
        # )
        # print(f"Test SMTP: {response.status_code}")


async def test_filter_settings():
    """Test work order filter settings"""
    print("\n=== Testing Filter Settings ===")
    
    async with httpx.AsyncClient() as client:
        # Get current filter settings
        response = await client.get(
            f"{BASE_URL}/api/settings/filters/{TEST_USER_ID}",
            headers=AUTH_HEADERS
        )
        print(f"GET Filter Settings: {response.status_code}")
        
        # Update filter settings
        filter_data = {
            "enabled": True,
            "filter_by_stores": ["001", "002", "003"],
            "filter_by_locations": ["Dallas", "Houston"],
            "filter_by_customers": ["7-Eleven", "Circle K"],
            "filter_by_service_codes": ["2861", "3002"],
            "exclude_stores": ["999"],
            "exclude_completed": True,
            "saved_filters": {}
        }
        
        response = await client.post(
            f"{BASE_URL}/api/settings/filters/{TEST_USER_ID}",
            json=filter_data,
            headers=AUTH_HEADERS
        )
        print(f"POST Filter Settings: {response.status_code}")


async def test_automation_delays():
    """Test automation delay settings"""
    print("\n=== Testing Automation Delays ===")
    
    async with httpx.AsyncClient() as client:
        # Get current delay settings
        response = await client.get(
            f"{BASE_URL}/api/settings/automation-delays/{TEST_USER_ID}",
            headers=AUTH_HEADERS
        )
        print(f"GET Automation Delays: {response.status_code}")
        
        # Update delay settings
        delay_data = {
            "form_field_delay": 500,
            "page_navigation_delay": 2000,
            "click_action_delay": 300,
            "dropdown_select_delay": 500,
            "overall_speed_multiplier": 1.0,
            "browser_timeout": 30000,
            "retry_delay": 3000,
            "max_retries": 3
        }
        
        response = await client.post(
            f"{BASE_URL}/api/settings/automation-delays/{TEST_USER_ID}",
            json=delay_data,
            headers=AUTH_HEADERS
        )
        print(f"POST Automation Delays: {response.status_code}")


async def test_display_settings():
    """Test notification display settings"""
    print("\n=== Testing Display Settings ===")
    
    async with httpx.AsyncClient() as client:
        # Get current display settings
        response = await client.get(
            f"{BASE_URL}/api/settings/notification-display/{TEST_USER_ID}",
            headers=AUTH_HEADERS
        )
        print(f"GET Display Settings: {response.status_code}")
        
        # Update display settings
        display_data = {
            "show_job_id": True,
            "show_store_number": True,
            "show_store_name": True,
            "show_location": True,
            "show_date": True,
            "show_time": True,
            "show_dispenser_count": True,
            "show_service_code": True,
            "show_duration": True,
            "date_format": "MM/DD/YYYY",
            "time_format": "12h",
            "timezone": "America/New_York"
        }
        
        response = await client.post(
            f"{BASE_URL}/api/settings/notification-display/{TEST_USER_ID}",
            json=display_data,
            headers=AUTH_HEADERS
        )
        print(f"POST Display Settings: {response.status_code}")


async def test_notification_preferences():
    """Test notification preferences"""
    print("\n=== Testing Notification Preferences ===")
    
    async with httpx.AsyncClient() as client:
        # Get current preferences
        response = await client.get(
            f"{BASE_URL}/api/notifications/preferences/{TEST_USER_ID}",
            headers=AUTH_HEADERS
        )
        print(f"GET Notification Preferences: {response.status_code}")
        if response.status_code == 200:
            print(f"Current preferences: {response.json()}")
        
        # Update preferences
        notification_data = {
            "email_enabled": True,
            "pushover_enabled": True,
            "automation_started": "email",
            "automation_completed": "both",
            "automation_failed": "both",
            "automation_progress": "pushover",
            "schedule_change": "both",
            "daily_digest": "email",
            "weekly_summary": "email",
            "error_alert": "both",
            "digest_time": "08:00",
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "07:00",
            "pushover_user_key": "test-key",
            "pushover_device": "",
            "pushover_sound": "pushover"
        }
        
        response = await client.put(
            f"{BASE_URL}/api/notifications/preferences/{TEST_USER_ID}",
            json=notification_data,
            headers=AUTH_HEADERS
        )
        print(f"PUT Notification Preferences: {response.status_code}")


async def main():
    """Run all tests"""
    print(f"Testing Settings API - {datetime.now()}")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_USER_ID}")
    
    # Note: You'll need to login first to get an auth token
    print("\nNOTE: These tests require authentication. Please login first and update AUTH_HEADERS with your token.")
    
    # Uncomment these after setting up auth headers
    # await test_smtp_settings()
    # await test_filter_settings()
    # await test_automation_delays()
    # await test_display_settings()
    # await test_notification_preferences()
    
    print("\n=== Testing Complete ===")


if __name__ == "__main__":
    asyncio.run(main())
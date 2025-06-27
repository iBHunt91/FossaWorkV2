#!/usr/bin/env python3
"""
Test email notification functionality
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.email_notification import EmailNotificationService, EmailSettings, NotificationType
from app.services.notification_manager import NotificationManager, NotificationTrigger
from app.services.pushover_notification import PushoverNotificationService, PushoverSettings
from sqlalchemy.orm import Session


async def test_smtp_connection():
    """Test SMTP connection and settings"""
    print("\n=== Testing SMTP Connection ===")
    
    # Load settings for user
    user_id = "demo"  # Change this to actual user ID if needed
    settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    
    if not settings_path.exists():
        print(f"❌ No SMTP settings found for user {user_id}")
        print(f"   Expected at: {settings_path}")
        return False
    
    with open(settings_path, 'r') as f:
        smtp_config = json.load(f)
    
    print(f"📧 SMTP Configuration:")
    print(f"   Server: {smtp_config.get('smtp_server')}:{smtp_config.get('smtp_port')}")
    print(f"   Username: {smtp_config.get('username')}")
    print(f"   Password: {'*' * 8 if smtp_config.get('password') else 'NOT SET'}")
    print(f"   TLS: {smtp_config.get('use_tls', True)}")
    print(f"   SSL: {smtp_config.get('use_ssl', False)}")
    print(f"   From: {smtp_config.get('from_email')} ({smtp_config.get('from_name')})")
    
    if not smtp_config.get('username') or not smtp_config.get('password'):
        print("❌ SMTP credentials not configured!")
        return False
    
    # Test connection
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        print("\n🔄 Attempting SMTP connection...")
        
        if smtp_config.get('use_ssl'):
            server = smtplib.SMTP_SSL(smtp_config['smtp_server'], smtp_config['smtp_port'])
        else:
            server = smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'])
            if smtp_config.get('use_tls'):
                server.starttls()
        
        print("✅ Connected to SMTP server")
        
        print("🔐 Attempting login...")
        server.login(smtp_config['username'], smtp_config['password'])
        print("✅ Login successful")
        
        server.quit()
        return True
        
    except Exception as e:
        print(f"❌ SMTP connection failed: {e}")
        return False


async def test_notification_preferences():
    """Test notification preferences loading"""
    print("\n=== Testing Notification Preferences ===")
    
    user_id = "demo"
    prefs_path = Path(f"data/users/{user_id}/preferences/notification_preferences.json")
    
    if not prefs_path.exists():
        print(f"❌ No notification preferences found for user {user_id}")
        print(f"   Expected at: {prefs_path}")
        return
    
    with open(prefs_path, 'r') as f:
        prefs = json.load(f)
    
    print(f"📋 Notification Preferences:")
    print(f"   Email Enabled: {prefs.get('email_enabled', True)}")
    print(f"   Pushover Enabled: {prefs.get('pushover_enabled', False)}")
    print(f"   Pushover Key: {'SET' if prefs.get('pushover_user_key') else 'NOT SET'}")
    print(f"   Pushover Device: {prefs.get('pushover_device', 'All devices')}")
    
    # Check which notifications are configured
    print("\n📬 Notification Channels:")
    for key in ['automation_started', 'automation_completed', 'automation_failed']:
        print(f"   {key}: {prefs.get(key, 'email')}")


async def send_test_email():
    """Send a test email using the notification service"""
    print("\n=== Sending Test Email ===")
    
    user_id = "demo"
    
    # Load SMTP settings
    settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    if not settings_path.exists():
        print("❌ No SMTP settings found!")
        return False
    
    with open(settings_path, 'r') as f:
        smtp_config = json.load(f)
    
    # Create email settings
    email_settings = EmailSettings(
        smtp_server=smtp_config.get('smtp_server', 'smtp.gmail.com'),
        smtp_port=smtp_config.get('smtp_port', 587),
        username=smtp_config.get('username', ''),
        password=smtp_config.get('password', ''),
        use_tls=smtp_config.get('use_tls', True),
        use_ssl=smtp_config.get('use_ssl', False),
        from_email=smtp_config.get('from_email', smtp_config.get('username', '')),
        from_name=smtp_config.get('from_name', 'FossaWork Automation')
    )
    
    # Create a mock database session
    class MockDB:
        pass
    
    db = MockDB()
    
    # Initialize email service
    email_service = EmailNotificationService(db, email_settings)
    
    # Test data
    test_data = {
        "station_name": "Test Station #001",
        "job_id": "TEST_JOB_001",
        "work_order_id": "TEST_WO_001", 
        "service_code": "2861",
        "dispenser_count": 4,
        "dispensers_processed": 4,
        "forms_completed": 4,
        "total_iterations": 20,
        "duration": "5 minutes",
        "success_rate": 100,
        "start_time": "2025-01-27 10:00:00 UTC"
    }
    
    try:
        print(f"📤 Sending test email to user {user_id}...")
        success = await email_service.send_automation_notification(
            user_id,
            NotificationType.AUTOMATION_COMPLETED,
            test_data
        )
        
        if success:
            print("✅ Test email sent successfully!")
        else:
            print("❌ Failed to send test email")
            
        return success
        
    except Exception as e:
        print(f"❌ Error sending test email: {e}")
        import traceback
        traceback.print_exc()
        return False


async def check_user_email():
    """Check if user has email configured"""
    print("\n=== Checking User Email ===")
    
    user_id = "demo"
    users_path = Path(f"data/users/{user_id}/user_info.json")
    
    if not users_path.exists():
        print(f"❌ No user info found for user {user_id}")
        return
    
    with open(users_path, 'r') as f:
        user_info = json.load(f)
    
    print(f"👤 User Information:")
    print(f"   User ID: {user_info.get('user_id', user_id)}")
    print(f"   Email: {user_info.get('email', 'NOT SET')}")
    print(f"   Username: {user_info.get('username', 'NOT SET')}")


async def main():
    """Run all tests"""
    print("🔍 FossaWork Email Notification Diagnostics")
    print("=" * 50)
    
    # Check user email
    await check_user_email()
    
    # Test SMTP connection
    smtp_ok = await test_smtp_connection()
    
    # Check notification preferences
    await test_notification_preferences()
    
    # Send test email if SMTP is OK
    if smtp_ok:
        await send_test_email()
    else:
        print("\n⚠️  Skipping email send test due to SMTP connection failure")
    
    print("\n" + "=" * 50)
    print("✅ Diagnostics complete")


if __name__ == "__main__":
    asyncio.run(main())
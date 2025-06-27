#!/usr/bin/env python3
"""
Fix notification settings structure and ensure proper API response
"""

import json
from pathlib import Path


def fix_notification_preferences():
    """Create or fix notification preferences for the user"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Create notification preferences in the correct location expected by the service
    settings_dir = Path(f"data/users/{user_id}/settings")
    settings_dir.mkdir(parents=True, exist_ok=True)
    
    # Create notification_preferences.json in settings directory
    notification_prefs_file = settings_dir / "notification_preferences.json"
    
    notification_prefs = {
        "email_enabled": True,
        "pushover_enabled": False,
        "automation_started": "email",
        "automation_completed": "email",
        "automation_failed": "email",
        "automation_progress": "none",
        "schedule_change": "email",
        "daily_digest": "email",
        "weekly_summary": "email",
        "error_alert": "email",
        "digest_time": "08:00",
        "quiet_hours_start": "22:00",
        "quiet_hours_end": "07:00",
        "pushover_user_key": "",
        "pushover_device": "",
        "pushover_sound": "pushover"
    }
    
    with open(notification_prefs_file, 'w') as f:
        json.dump(notification_prefs, f, indent=2)
    
    print(f"✅ Created/Updated notification preferences at {notification_prefs_file}")
    
    # Also create in preferences directory for compatibility
    prefs_dir = Path(f"data/users/{user_id}/preferences")
    prefs_dir.mkdir(parents=True, exist_ok=True)
    
    prefs_file = prefs_dir / "notification_preferences.json"
    with open(prefs_file, 'w') as f:
        json.dump(notification_prefs, f, indent=2)
    
    print(f"✅ Created/Updated notification preferences at {prefs_file}")
    
    # Create user preferences file with notification settings
    user_prefs_file = settings_dir / "preferences.json"
    user_prefs = {
        "notification_preferences": notification_prefs
    }
    
    with open(user_prefs_file, 'w') as f:
        json.dump(user_prefs, f, indent=2)
    
    print(f"✅ Created/Updated user preferences at {user_prefs_file}")


def check_smtp_settings():
    """Verify SMTP settings are correct"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    smtp_file = Path(f"data/users/{user_id}/settings/smtp.json")
    
    if smtp_file.exists():
        with open(smtp_file, 'r') as f:
            smtp_config = json.load(f)
        
        print("\n📧 SMTP Settings:")
        print(f"   Server: {smtp_config.get('smtp_server')}:{smtp_config.get('smtp_port')}")
        print(f"   Username: {smtp_config.get('username')}")
        print(f"   From: {smtp_config.get('from_email')}")
        print(f"   TLS: {smtp_config.get('use_tls')}")
        print(f"   SSL: {smtp_config.get('use_ssl')}")
    else:
        print(f"\n❌ No SMTP settings found at {smtp_file}")


def main():
    print("🔧 Fixing FossaWork Notification Settings")
    print("=" * 50)
    
    fix_notification_preferences()
    check_smtp_settings()
    
    print("\n" + "=" * 50)
    print("✅ Settings fixed. Please try the following:")
    print("1. Refresh the Settings page in your browser")
    print("2. You should now be able to enter Pushover credentials")
    print("3. Run the email test script to send a test email:")
    print("   python scripts/test_email_with_correct_user.py")


if __name__ == "__main__":
    main()
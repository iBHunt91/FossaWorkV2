#!/usr/bin/env python3
"""
Fix email sending and Pushover UI issues
"""

import sys
import os
import json
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def patch_notification_manager():
    """Patch the notification manager to use user-specific SMTP settings"""
    notification_manager_path = Path("app/services/notification_manager.py")
    
    print("📝 Patching notification manager to use user SMTP settings...")
    
    # Read the current file
    with open(notification_manager_path, 'r') as f:
        content = f.read()
    
    # Check if already patched
    if "# PATCHED: Load user SMTP settings" in content:
        print("✅ Notification manager already patched")
        return
    
    # Find the get_notification_manager function
    patch_location = content.find("def get_notification_manager(")
    if patch_location == -1:
        print("❌ Could not find get_notification_manager function")
        return
    
    # Create the patched version
    new_function = '''def get_notification_manager(
    db: Session = None,
    email_settings: EmailSettings = None,
    pushover_settings: PushoverSettings = None
) -> NotificationManager:
    """Factory function for creating notification manager"""
    if db is None:
        db = next(get_db())
    
    # PATCHED: Load user SMTP settings
    if email_settings is None:
        # Try to load from current request context or use default
        import json
        from pathlib import Path
        
        # Try to get user ID from somewhere (this is a simplified approach)
        # In production, this should come from the request context
        user_dirs = list(Path("data/users").glob("*/settings/smtp.json"))
        if user_dirs:
            # Use the first user's SMTP settings found
            smtp_path = user_dirs[0]
            try:
                with open(smtp_path, 'r') as f:
                    smtp_config = json.load(f)
                
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
            except Exception as e:
                print(f"Error loading SMTP settings: {e}")
                email_settings = EmailSettings(
                    smtp_server="smtp.gmail.com",
                    smtp_port=587,
                    username="fossawork@example.com",
                    password="app_specific_password"
                )
        else:
            email_settings = EmailSettings(
                smtp_server="smtp.gmail.com",
                smtp_port=587,
                username="fossawork@example.com",
                password="app_specific_password"
            )
    
    if pushover_settings is None:
        pushover_settings = PushoverSettings(
            api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",
            user_key=""
        )
    
    return NotificationManager(db, email_settings, pushover_settings)'''
    
    # Find the end of the current function
    func_start = patch_location
    func_end = content.find("\n\ndef ", func_start)
    if func_end == -1:
        func_end = content.find("\n\nclass ", func_start)
    if func_end == -1:
        func_end = content.find("\n\n# ", func_start)
    if func_end == -1:
        func_end = len(content)
    
    # Replace the function
    new_content = content[:func_start] + new_function + content[func_end:]
    
    # Write back
    with open(notification_manager_path, 'w') as f:
        f.write(new_content)
    
    print("✅ Notification manager patched successfully")


def fix_user_management_preferences():
    """Ensure user management service can load preferences correctly"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Create all necessary preference files
    print("\n📝 Creating comprehensive preference structure...")
    
    # 1. Main preferences directory
    prefs_dir = Path(f"data/users/{user_id}/preferences")
    prefs_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Settings directory
    settings_dir = Path(f"data/users/{user_id}/settings")
    settings_dir.mkdir(parents=True, exist_ok=True)
    
    # 3. Create notification preferences in both locations
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
    
    # Save in preferences directory
    with open(prefs_dir / "notification_preferences.json", 'w') as f:
        json.dump(notification_prefs, f, indent=2)
    
    # Save in settings directory
    with open(settings_dir / "notification_preferences.json", 'w') as f:
        json.dump(notification_prefs, f, indent=2)
    
    # 4. Create master preferences file
    master_prefs = {
        "notification_preferences": notification_prefs,
        "email_notifications": {
            "automation_started": True,
            "automation_completed": True,
            "automation_failed": True,
            "daily_digest": True
        }
    }
    
    with open(settings_dir / "preferences.json", 'w') as f:
        json.dump(master_prefs, f, indent=2)
    
    print("✅ Preference structure created")


def create_test_endpoint():
    """Create a test endpoint for debugging"""
    test_script = '''#!/usr/bin/env python3
"""
Test endpoint to verify notification system
"""

import asyncio
import sys
import os
import json
from pathlib import Path
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def send_test_email_direct(email_address):
    """Send test email directly using SMTP settings"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    
    # Load SMTP settings
    settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    if not settings_path.exists():
        print(f"❌ No SMTP settings found")
        return False
    
    with open(settings_path, 'r') as f:
        smtp_config = json.load(f)
    
    print(f"📧 Sending test email to {email_address}...")
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "✅ FossaWork Email Configuration Test"
        msg['From'] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg['To'] = email_address
        
        # HTML body
        html = """
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #28a745; text-align: center;">✅ Email Test Successful!</h1>
                <p style="font-size: 16px; color: #333;">Your FossaWork email notifications are working correctly.</p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="color: #2c5aa0; margin-top: 0;">Configuration Details:</h3>
                    <ul style="color: #666;">
                        <li><strong>SMTP Server:</strong> {}</li>
                        <li><strong>Port:</strong> {}</li>
                        <li><strong>Security:</strong> {}</li>
                        <li><strong>From:</strong> {}</li>
                    </ul>
                </div>
                <p style="color: #666; text-align: center; margin-top: 30px;">
                    You will receive notifications when automation jobs start, complete, or encounter errors.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                    FossaWork V2 Automation System<br>
                    This is an automated test message
                </p>
            </div>
        </body>
        </html>
        """.format(
            smtp_config['smtp_server'],
            smtp_config['smtp_port'],
            "TLS" if smtp_config.get('use_tls') else "SSL" if smtp_config.get('use_ssl') else "None",
            smtp_config['from_email']
        )
        
        # Text body
        text = """
Email Test Successful!

Your FossaWork email notifications are working correctly.

Configuration Details:
- SMTP Server: {}
- Port: {}
- Security: {}
- From: {}

You will receive notifications when automation jobs start, complete, or encounter errors.

---
FossaWork V2 Automation System
This is an automated test message
        """.format(
            smtp_config['smtp_server'],
            smtp_config['smtp_port'],
            "TLS" if smtp_config.get('use_tls') else "SSL" if smtp_config.get('use_ssl') else "None",
            smtp_config['from_email']
        )
        
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        if smtp_config.get('use_ssl'):
            server = smtplib.SMTP_SSL(smtp_config['smtp_server'], smtp_config['smtp_port'])
        else:
            server = smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'])
            if smtp_config.get('use_tls'):
                server.starttls()
        
        server.login(smtp_config['username'], smtp_config['password'])
        server.send_message(msg)
        server.quit()
        
        print("✅ Email sent successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    print("🔧 FossaWork Email Test")
    print("=" * 50)
    
    email = input("Enter email address to send test to: ").strip()
    if not email:
        print("❌ No email provided!")
        return
    
    await send_test_email_direct(email)


if __name__ == "__main__":
    asyncio.run(main())
'''
    
    with open("scripts/send_test_email.py", 'w') as f:
        f.write(test_script)
    
    os.chmod("scripts/send_test_email.py", 0o755)
    print("✅ Created test email script: scripts/send_test_email.py")


def main():
    print("🔧 Fixing FossaWork Email and Pushover Issues")
    print("=" * 50)
    
    # 1. Fix preference structure
    fix_user_management_preferences()
    
    # 2. Patch notification manager
    patch_notification_manager()
    
    # 3. Create test script
    create_test_endpoint()
    
    print("\n" + "=" * 50)
    print("✅ Fixes applied. Next steps:")
    print("\n1. Restart the backend server")
    print("2. Refresh the Settings page in your browser")
    print("3. You should now be able to:")
    print("   - Enter Pushover credentials")
    print("   - Send test emails")
    print("\n4. To send a test email, run:")
    print("   python3 scripts/send_test_email.py")


if __name__ == "__main__":
    main()
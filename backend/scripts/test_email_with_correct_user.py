#!/usr/bin/env python3
"""
Test email sending with correct user ID and create notification preferences
"""

import asyncio
import sys
import os
import json
from pathlib import Path
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def create_notification_preferences(user_id):
    """Create notification preferences if they don't exist"""
    prefs_dir = Path(f"data/users/{user_id}/preferences")
    prefs_dir.mkdir(parents=True, exist_ok=True)
    
    prefs_file = prefs_dir / "notification_preferences.json"
    
    if not prefs_file.exists():
        default_prefs = {
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
            "pushover_user_key": None,
            "pushover_device": None,
            "pushover_sound": "pushover"
        }
        
        with open(prefs_file, 'w') as f:
            json.dump(default_prefs, f, indent=2)
        
        print(f"✅ Created notification preferences at {prefs_file}")
    else:
        print(f"📋 Notification preferences already exist at {prefs_file}")


async def test_direct_smtp_email(user_id, test_email):
    """Test direct SMTP email sending"""
    print("\n=== Testing Direct SMTP Email ===")
    
    # Load SMTP settings
    settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    
    if not settings_path.exists():
        print(f"❌ No SMTP settings found at {settings_path}")
        return False
    
    with open(settings_path, 'r') as f:
        smtp_config = json.load(f)
    
    print(f"📧 Using SMTP Configuration:")
    print(f"   Server: {smtp_config['smtp_server']}:{smtp_config['smtp_port']}")
    print(f"   From: {smtp_config['from_email']}")
    print(f"   To: {test_email}")
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "FossaWork SMTP Test Email"
        msg['From'] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg['To'] = test_email
        
        # Create the body
        text = """Hello,

This is a test email from FossaWork to verify your email settings are working correctly.

If you received this email, your email configuration is working properly!

Settings tested:
- Server: {}:{}
- TLS: {}
- SSL: {}

Best regards,
FossaWork Automation System""".format(
            smtp_config['smtp_server'],
            smtp_config['smtp_port'],
            "Enabled" if smtp_config.get('use_tls', True) else "Disabled",
            "Enabled" if smtp_config.get('use_ssl', False) else "Disabled"
        )
        
        html = """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px; border-radius: 8px;">
                <h2 style="color: #2c5aa0;">✅ FossaWork Email Test Successful!</h2>
                <p>This is a test email from FossaWork to verify your email settings are working correctly.</p>
                <p>If you received this email, your email configuration is working properly!</p>
                <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
                    <h3>Settings tested:</h3>
                    <ul>
                        <li>Server: {}:{}</li>
                        <li>TLS: {}</li>
                        <li>SSL: {}</li>
                    </ul>
                </div>
                <p style="color: #666; font-size: 12px;">FossaWork V2 Automation System</p>
            </div>
        </body>
        </html>
        """.format(
            smtp_config['smtp_server'],
            smtp_config['smtp_port'],
            "Enabled" if smtp_config.get('use_tls', True) else "Disabled",
            "Enabled" if smtp_config.get('use_ssl', False) else "Disabled"
        )
        
        # Attach parts
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        print("\n🔄 Connecting to SMTP server...")
        
        # Send the email
        if smtp_config.get('use_ssl', False):
            server = smtplib.SMTP_SSL(smtp_config['smtp_server'], smtp_config['smtp_port'])
        else:
            server = smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'])
            if smtp_config.get('use_tls', True):
                print("🔒 Starting TLS...")
                server.starttls()
        
        print("🔐 Logging in...")
        server.login(smtp_config['username'], smtp_config['password'])
        
        print("📤 Sending email...")
        server.send_message(msg)
        server.quit()
        
        print("✅ Email sent successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return False


async def check_and_update_user_info(user_id, email):
    """Check and update user info"""
    user_dir = Path(f"data/users/{user_id}")
    user_dir.mkdir(parents=True, exist_ok=True)
    
    user_info_file = user_dir / "user_info.json"
    
    if not user_info_file.exists():
        user_info = {
            "user_id": user_id,
            "email": email,
            "username": "demo_user",
            "created_at": "2025-01-27T00:00:00Z"
        }
        
        with open(user_info_file, 'w') as f:
            json.dump(user_info, f, indent=2)
        
        print(f"✅ Created user info at {user_info_file}")
    else:
        print(f"📋 User info already exists at {user_info_file}")


async def main():
    """Run email test with correct user ID"""
    print("🔍 FossaWork Email Test with Correct User ID")
    print("=" * 50)
    
    # The actual user ID from the settings
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    test_email = "youremail@example.com"  # Change this to your email
    
    print(f"📧 Please enter the email address to send test to:")
    test_email = input("Email: ").strip()
    
    if not test_email:
        print("❌ No email provided!")
        return
    
    # Create user info if needed
    await check_and_update_user_info(user_id, test_email)
    
    # Create notification preferences if needed
    await create_notification_preferences(user_id)
    
    # Test direct SMTP email
    await test_direct_smtp_email(user_id, test_email)
    
    print("\n" + "=" * 50)
    print("✅ Test complete")


if __name__ == "__main__":
    asyncio.run(main())
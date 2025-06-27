#!/usr/bin/env python3
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

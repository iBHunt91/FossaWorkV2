#!/usr/bin/env python3
"""
Quick email test - sends a test email immediately
"""

import smtplib
import json
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sys


def send_test_email(to_email):
    """Send a quick test email"""
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    
    if not settings_path.exists():
        print(f"❌ No SMTP settings found at {settings_path}")
        return False
    
    with open(settings_path, 'r') as f:
        smtp = json.load(f)
    
    print(f"📧 Sending test email...")
    print(f"   From: {smtp['from_email']}")
    print(f"   To: {to_email}")
    print(f"   Server: {smtp['server']}:{smtp['port']}")
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['Subject'] = "FossaWork Test - Email Working!"
        msg['From'] = f"{smtp['from_name']} <{smtp['from_email']}>"
        msg['To'] = to_email
        
        body = """
        <html>
        <body>
            <h2 style="color: #28a745;">✅ Success!</h2>
            <p>Your FossaWork email notifications are working correctly.</p>
            <p>You should now receive notifications when:</p>
            <ul>
                <li>Automation jobs start</li>
                <li>Automation jobs complete</li>
                <li>Errors occur</li>
            </ul>
            <hr>
            <p style="color: #666; font-size: 12px;">FossaWork V2</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Connect and send
        if smtp.get('use_ssl'):
            server = smtplib.SMTP_SSL(smtp['server'], smtp['port'])
        else:
            server = smtplib.SMTP(smtp['server'], smtp['port'])
            if smtp.get('use_tls'):
                server.starttls()
        
        server.login(smtp['username'], smtp['password'])
        server.send_message(msg)
        server.quit()
        
        print("✅ Email sent successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        email = sys.argv[1]
    else:
        email = input("Enter email address: ").strip()
    
    if email:
        send_test_email(email)
    else:
        print("❌ No email provided!")
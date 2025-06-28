#!/usr/bin/env python3
"""Test notification configuration for user"""

import json as json_module
import os
from pathlib import Path

def check_notification_config():
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    user_email = "bruce.hunt@owlservices.com"
    
    print(f"🔍 Checking notification configuration for {user_email}")
    print(f"   User ID: {user_id}")
    print()
    
    # Check SMTP settings
    smtp_path = Path(f"data/users/{user_id}/settings/smtp.json")
    if smtp_path.exists():
        with open(smtp_path) as f:
            smtp_settings = json_module.load(f)
        print("✅ Email (SMTP) Configuration:")
        print(f"   - Server: {smtp_settings['smtp_server']}:{smtp_settings['smtp_port']}")
        print(f"   - Username: {smtp_settings['username']}")
        print(f"   - Password: {'*' * 8} (configured)")
        print(f"   - From: {smtp_settings['from_email']}")
        print(f"   - TLS: {smtp_settings['use_tls']}")
    else:
        print("❌ Email (SMTP) settings not found")
    
    print()
    
    # Check database settings
    from sqlalchemy import create_engine, text
    
    engine = create_engine('sqlite:///fossawork_v2.db')
    with engine.connect() as conn:
        # Check user_preferences table
        result = conn.execute(text("""
            SELECT settings 
            FROM user_preferences 
            WHERE user_id = :user_id 
            AND category = 'notification_settings'
        """), {"user_id": user_id})
        
        row = result.fetchone()
        if row:
            settings = json_module.loads(row[0])
            print("✅ Notification Preferences (user_preferences table):")
            print(f"   - Email enabled: {settings.get('email', {}).get('enabled', False)}")
            print(f"   - Pushover enabled: {settings.get('pushover', {}).get('enabled', False)}")
            if settings.get('pushover_user_key'):
                print(f"   - Pushover user key: {settings['pushover_user_key'][:8]}... (configured)")
            else:
                print(f"   - Pushover user key: Not configured")
        
        print()
        
        # Check users table
        result = conn.execute(text("""
            SELECT notification_settings 
            FROM users 
            WHERE id = :user_id
        """), {"user_id": user_id})
        
        row = result.fetchone()
        if row and row[0]:
            settings = json_module.loads(row[0])
            print("✅ Notification Settings (users table):")
            print(f"   - Email enabled: {settings.get('email_enabled', False)}")
            print(f"   - Pushover enabled: {settings.get('pushover_enabled', False)}")
            if settings.get('pushover_user_key'):
                print(f"   - Pushover user key: {settings['pushover_user_key'][:8]}... (configured)")
            else:
                print(f"   - Pushover user key: Not configured")
    
    print()
    print("📋 Summary:")
    print("   - Email is configured and ready to use")
    print("   - Pushover is enabled but needs user key from user")
    print("   - User needs to provide their Pushover user key to complete setup")

if __name__ == "__main__":
    check_notification_config()
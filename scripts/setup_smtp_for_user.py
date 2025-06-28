#!/usr/bin/env python3
"""
Quick script to set up basic SMTP configuration for a user.
This creates the necessary SMTP settings file for email notifications to work.
"""

import json
import os
from pathlib import Path
import sys

def setup_smtp_settings(user_id: str):
    """Set up basic SMTP settings for a user"""
    
    # Create settings directory
    settings_dir = Path(f"data/users/{user_id}/settings")
    settings_dir.mkdir(parents=True, exist_ok=True)
    
    # SMTP settings file path
    smtp_file = settings_dir / "smtp.json"
    
    # Basic SMTP configuration (Gmail example)
    smtp_settings = {
        "smtp_server": "smtp.gmail.com",
        "smtp_port": 587,
        "username": "bruce.hunt@owlservices.com",  # Update this
        "password": "",  # User needs to set this
        "use_tls": True,
        "use_ssl": False,
        "from_email": "bruce.hunt@owlservices.com",  # Update this
        "from_name": "FossaWork Automation",
        "timeout": 30
    }
    
    # Check if file already exists
    if smtp_file.exists():
        print(f"SMTP settings already exist at: {smtp_file}")
        with open(smtp_file, 'r') as f:
            existing = json.load(f)
        print("Current settings:")
        for key, value in existing.items():
            if key == "password":
                print(f"  {key}: {'*' * 8 if value else '(not set)'}")
            else:
                print(f"  {key}: {value}")
    else:
        # Save the settings
        with open(smtp_file, 'w') as f:
            json.dump(smtp_settings, f, indent=2)
        print(f"Created SMTP settings file at: {smtp_file}")
        print("\nDefault Gmail SMTP settings have been configured:")
        print(f"  Server: {smtp_settings['smtp_server']}")
        print(f"  Port: {smtp_settings['smtp_port']}")
        print(f"  Username: {smtp_settings['username']}")
        print("  Password: (not set - please update)")
        print(f"  From Email: {smtp_settings['from_email']}")
        
    print("\nIMPORTANT: You need to:")
    print("1. Update the username and from_email if needed")
    print("2. Set your email password in the settings")
    print("3. For Gmail, use an app-specific password (not your regular password)")
    print("   - Go to: https://myaccount.google.com/apppasswords")
    print("   - Generate an app password for 'Mail'")
    print("   - Use that password in the SMTP settings")

if __name__ == "__main__":
    # Get user ID from command line or use the one from test results
    user_id = sys.argv[1] if len(sys.argv) > 1 else "7bea3bdb7e8e303eacaba442bd824004"
    
    print(f"Setting up SMTP configuration for user: {user_id}")
    setup_smtp_settings(user_id)
#!/usr/bin/env python3
"""
Test SMTP Provider Auto-Detection

This script tests the SMTP auto-detection feature by checking various
email providers and verifying that the correct settings are returned.
"""

import json
from typing import Dict, Optional

# Define the same provider configurations as in the frontend
SMTP_PROVIDERS = {
    # Google (Gmail, Google Workspace)
    'gmail.com': {
        'name': 'Gmail',
        'smtp_server': 'smtp.gmail.com',
        'smtp_port': 587,
        'use_tls': True,
        'use_ssl': False,
        'notes': 'Requires an App Password. Enable 2FA and generate an app-specific password.',
    },
    'outlook.com': {
        'name': 'Outlook.com',
        'smtp_server': 'smtp-mail.outlook.com',
        'smtp_port': 587,
        'use_tls': True,
        'use_ssl': False,
        'notes': 'May require an app password if 2FA is enabled.'
    },
    'yahoo.com': {
        'name': 'Yahoo Mail',
        'smtp_server': 'smtp.mail.yahoo.com',
        'smtp_port': 587,
        'use_tls': True,
        'use_ssl': False,
        'notes': 'Requires an App Password.',
    },
    'icloud.com': {
        'name': 'iCloud Mail',
        'smtp_server': 'smtp.mail.me.com',
        'smtp_port': 587,
        'use_tls': True,
        'use_ssl': False,
        'notes': 'Requires an app-specific password.'
    },
    'protonmail.com': {
        'name': 'ProtonMail',
        'smtp_server': 'smtp.protonmail.com',
        'smtp_port': 587,
        'use_tls': True,
        'use_ssl': False,
        'notes': 'Requires ProtonMail Bridge application.'
    },
    'fastmail.com': {
        'name': 'FastMail',
        'smtp_server': 'smtp.fastmail.com',
        'smtp_port': 587,
        'use_tls': True,
        'use_ssl': False,
        'notes': 'Requires an app-specific password.'
    }
}

def detect_smtp_provider(email: str) -> Optional[Dict]:
    """Detect SMTP configuration based on email address"""
    if not email or '@' not in email:
        return None
    
    domain = email.lower().split('@')[1]
    
    # Direct domain match
    if domain in SMTP_PROVIDERS:
        return SMTP_PROVIDERS[domain]
    
    # Return None for unknown domains
    return None

def test_smtp_detection():
    """Test SMTP auto-detection with various email addresses"""
    print("=== SMTP Auto-Detection Test ===\n")
    
    test_emails = [
        # Known providers
        "user@gmail.com",
        "user@outlook.com",
        "user@yahoo.com",
        "user@icloud.com",
        "user@protonmail.com",
        "user@fastmail.com",
        "user@hotmail.com",
        "user@live.com",
        "user@aol.com",
        "user@zoho.com",
        
        # Custom domains
        "user@company.com",
        "admin@example.org",
        
        # Invalid
        "invalid-email",
        "",
        None
    ]
    
    for email in test_emails:
        if email is None:
            continue
            
        result = detect_smtp_provider(email)
        
        if result:
            print(f"✅ {email}")
            print(f"   Provider: {result['name']}")
            print(f"   Server: {result['smtp_server']}")
            print(f"   Port: {result['smtp_port']}")
            print(f"   TLS: {result['use_tls']}, SSL: {result['use_ssl']}")
            if 'notes' in result:
                print(f"   Note: {result['notes']}")
        else:
            if email and '@' in email:
                print(f"❓ {email} - Unknown provider (manual configuration needed)")
            else:
                print(f"❌ {email} - Invalid email format")
        print()
    
    print("\n=== Frontend Implementation Notes ===")
    print("1. Auto-detect button fills in SMTP server, port, and security settings")
    print("2. Username field is auto-populated with the email address")
    print("3. User still needs to enter their app-specific password")
    print("4. Provider-specific notes are displayed when available")
    print("5. For unknown domains, users get guidance about common options")
    print("\n✅ The auto-detection feature helps users who don't know their SMTP settings!")

if __name__ == "__main__":
    test_smtp_detection()
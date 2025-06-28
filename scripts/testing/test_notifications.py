#!/usr/bin/env python3
"""
FossaWork V2 Notification Configuration Tester

This script validates email and Pushover notification configurations.
Run this after setting up your .env file to ensure notifications work correctly.

Usage:
    cd backend
    python scripts/test_notifications.py
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

class Colors:
    """Terminal colors for output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(title):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title.center(60)}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def print_result(success, message, details=None):
    """Print test result with color"""
    icon = f"{Colors.GREEN}✓{Colors.RESET}" if success else f"{Colors.RED}✗{Colors.RESET}"
    print(f"  {icon} {message}")
    if details:
        for detail in details:
            print(f"    {Colors.YELLOW}→{Colors.RESET} {detail}")

def check_env_variables():
    """Check if required environment variables are set"""
    print_header("Environment Configuration Check")
    
    required_vars = {
        'Email': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD'],
        'Pushover': ['PUSHOVER_APP_TOKEN'],
        'Security': ['SECRET_KEY', 'FOSSAWORK_MASTER_KEY']
    }
    
    all_good = True
    
    for category, vars in required_vars.items():
        print(f"{Colors.BOLD}{category}:{Colors.RESET}")
        for var in vars:
            value = os.getenv(var)
            if value:
                # Mask sensitive values
                if 'PASSWORD' in var or 'KEY' in var or 'TOKEN' in var:
                    display_value = value[:4] + '*' * (len(value) - 8) + value[-4:] if len(value) > 8 else '*' * len(value)
                else:
                    display_value = value
                print_result(True, f"{var}: {display_value}")
            else:
                print_result(False, f"{var}: NOT SET")
                all_good = False
        print()
    
    return all_good

def test_email_configuration():
    """Test email SMTP configuration"""
    print_header("Email Configuration Test")
    
    # Check configuration
    host = os.getenv('SMTP_HOST')
    port = os.getenv('SMTP_PORT')
    username = os.getenv('SMTP_USERNAME')
    password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('SMTP_FROM', username)
    use_tls = os.getenv('SMTP_TLS', 'true').lower() == 'true'
    use_ssl = os.getenv('SMTP_SSL', 'false').lower() == 'true'
    
    if not all([host, port, username, password]):
        print_result(False, "Missing required SMTP configuration", [
            "Please configure SMTP settings in your .env file",
            "See notification-setup-guide.md for details"
        ])
        return False
    
    try:
        print(f"Testing connection to {host}:{port}...")
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = username
        msg['Subject'] = f'FossaWork V2 Test - {datetime.now().strftime("%Y-%m-%d %H:%M")}'
        
        body = """
This is a test email from FossaWork V2.

If you're receiving this, your email configuration is working correctly!

Configuration:
- SMTP Host: {}
- Port: {}
- TLS: {}
- SSL: {}

Sent at: {}
        """.format(host, port, use_tls, use_ssl, datetime.now())
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect and send
        if use_ssl:
            server = smtplib.SMTP_SSL(host, int(port))
        else:
            server = smtplib.SMTP(host, int(port))
            if use_tls:
                server.starttls()
        
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        
        print_result(True, "Email sent successfully!", [
            f"Check your inbox at {username}",
            "Subject: FossaWork V2 Test"
        ])
        return True
        
    except smtplib.SMTPAuthenticationError:
        print_result(False, "Authentication failed", [
            "Check your username and password",
            "For Gmail: Use an app-specific password",
            "For Outlook/Yahoo: May need app password"
        ])
        return False
    except smtplib.SMTPConnectError:
        print_result(False, "Connection failed", [
            f"Could not connect to {host}:{port}",
            "Check your firewall settings",
            "Verify SMTP host and port"
        ])
        return False
    except Exception as e:
        print_result(False, f"Error: {type(e).__name__}", [str(e)])
        return False

def test_pushover_configuration(user_key=None):
    """Test Pushover configuration"""
    print_header("Pushover Configuration Test")
    
    token = os.getenv('PUSHOVER_APP_TOKEN')
    
    if not token:
        print_result(False, "PUSHOVER_APP_TOKEN not configured", [
            "Add PUSHOVER_APP_TOKEN to your .env file",
            "See notification-setup-guide.md for setup instructions"
        ])
        return False
    
    if not user_key:
        print("Enter your Pushover User Key to test notifications")
        print("(30 characters, starts with 'u')")
        user_key = input("User Key: ").strip()
        
        if not user_key:
            print_result(False, "Test skipped - no user key provided")
            return False
    
    try:
        print(f"Sending test notification...")
        
        response = requests.post('https://api.pushover.net/1/messages.json', data={
            'token': token,
            'user': user_key,
            'title': 'FossaWork V2 Test',
            'message': f'Test notification sent at {datetime.now().strftime("%H:%M")}',
            'priority': 0,
            'sound': 'pushover'
        })
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Notification sent successfully!", [
                "Check your Pushover app",
                f"Request ID: {data.get('request', 'N/A')}",
                f"Remaining limit: {response.headers.get('X-Limit-App-Remaining', 'N/A')}/7,500"
            ])
            return True
        else:
            error_data = response.json()
            errors = error_data.get('errors', ['Unknown error'])
            print_result(False, f"Pushover API error ({response.status_code})", errors)
            return False
            
    except requests.exceptions.ConnectionError:
        print_result(False, "Connection failed", [
            "Could not reach Pushover API",
            "Check your internet connection"
        ])
        return False
    except Exception as e:
        print_result(False, f"Error: {type(e).__name__}", [str(e)])
        return False

def test_desktop_notifications():
    """Information about desktop notifications"""
    print_header("Desktop Notifications")
    
    print("Desktop notifications are configured in the browser.")
    print("\nTo test desktop notifications:")
    print("1. Open FossaWork V2 in your browser")
    print("2. Go to Settings → Notifications")
    print("3. Enable Desktop Notifications")
    print("4. Click 'Test Desktop Notification'")
    print("\nNote: Desktop notifications work automatically when enabled!")
    
    return True

def main():
    """Run all notification tests"""
    print(f"\n{Colors.BOLD}FossaWork V2 Notification Configuration Tester{Colors.RESET}")
    print(f"Testing notification settings from: {env_path}")
    
    # Check environment variables
    env_ok = check_env_variables()
    
    if not env_ok:
        print(f"\n{Colors.YELLOW}⚠️  Some required variables are missing.{Colors.RESET}")
        print("Please configure them in your .env file before testing.\n")
    
    # Test email
    email_ok = test_email_configuration()
    
    # Test Pushover
    pushover_ok = test_pushover_configuration()
    
    # Show desktop notification info
    test_desktop_notifications()
    
    # Summary
    print_header("Test Summary")
    
    results = [
        ("Environment Variables", env_ok),
        ("Email (SMTP)", email_ok),
        ("Pushover", pushover_ok),
        ("Desktop", True)  # Always available in browser
    ]
    
    for name, status in results:
        print_result(status, name)
    
    passed = sum(1 for _, status in results if status)
    total = len(results)
    
    print(f"\n{Colors.BOLD}Overall: {passed}/{total} services configured{Colors.RESET}")
    
    if passed < total - 1:  # -1 because desktop is always available
        print(f"\n{Colors.YELLOW}💡 Tip:{Colors.RESET} FossaWork works without email/Pushover.")
        print("   Desktop notifications will still function in the browser!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test cancelled by user{Colors.RESET}")
    except Exception as e:
        print(f"\n{Colors.RED}Unexpected error: {e}{Colors.RESET}")
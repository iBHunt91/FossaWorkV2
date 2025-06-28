# FossaWork V2 Notification Configuration Guide

## Overview

This guide explains how to configure the notification systems in FossaWork V2. The application supports three notification channels:
- **Email** (via SMTP)
- **Pushover** (real-time push notifications)
- **Desktop** (browser notifications - already working)

## Email Configuration

### Prerequisites
- An email account with SMTP access
- App-specific password (for Gmail/Yahoo/etc.)
- SMTP server details

### Gmail Setup Example

1. **Enable 2-Factor Authentication** (required for app passwords)
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the 16-character password

3. **Configure .env file**
   ```env
   # Email Configuration
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USERNAME="your-email@gmail.com"
   SMTP_PASSWORD="your-16-char-app-password"
   SMTP_FROM="FossaWork <your-email@gmail.com>"
   SMTP_TLS=true
   SMTP_SSL=false
   ```

### Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT=587
SMTP_USERNAME="your-email@outlook.com"
SMTP_PASSWORD="your-password"
SMTP_TLS=true
```

#### Yahoo Mail
```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT=587
SMTP_USERNAME="your-email@yahoo.com"
SMTP_PASSWORD="your-app-password"
SMTP_TLS=true
```

#### Custom SMTP Server
```env
SMTP_HOST="mail.yourserver.com"
SMTP_PORT=587  # or 465 for SSL, 25 for unencrypted
SMTP_USERNAME="your-username"
SMTP_PASSWORD="your-password"
SMTP_TLS=true   # Set based on your server
SMTP_SSL=false  # Set based on your server
```

## Pushover Configuration

### Prerequisites
- Pushover account ($5 one-time purchase per platform)
- Pushover app installed on your device(s)

### Setup Steps

1. **Create Pushover Account**
   - Visit [Pushover.net](https://pushover.net/)
   - Sign up and purchase license

2. **Get Your User Key**
   - Log in to Pushover
   - Your User Key is displayed on the main page
   - Format: 30 characters (e.g., `u1234567890abcdefghij1234567890`)

3. **Create Application**
   - Go to [Create New Application](https://pushover.net/apps/build)
   - Name: "FossaWork V2"
   - Type: "Application"
   - Description: "FossaWork automation notifications"
   - Icon: (optional)
   - Click "Create Application"
   - Copy the API Token (30 characters)

4. **Configure .env file**
   ```env
   # Pushover Configuration
   PUSHOVER_APP_TOKEN="a1234567890abcdefghij1234567890"
   PUSHOVER_API_URL="https://api.pushover.net/1/messages.json"
   ```

5. **Configure User Settings**
   - In FossaWork, go to Settings
   - Enter your Pushover User Key
   - Save settings

## Testing Configuration

### Quick Test Script

Create `test_notifications.py` in the backend directory:

```python
import os
import asyncio
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
import requests

load_dotenv()

def test_email():
    """Test email configuration"""
    try:
        host = os.getenv('SMTP_HOST')
        port = int(os.getenv('SMTP_PORT', 587))
        username = os.getenv('SMTP_USERNAME')
        password = os.getenv('SMTP_PASSWORD')
        
        if not all([host, username, password]):
            return False, "Missing SMTP configuration"
        
        # Create test message
        msg = MIMEText('Test email from FossaWork V2')
        msg['Subject'] = 'FossaWork Test'
        msg['From'] = username
        msg['To'] = username
        
        # Send email
        server = smtplib.SMTP(host, port)
        server.starttls()
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        
        return True, "Email sent successfully"
    except Exception as e:
        return False, f"Email failed: {str(e)}"

def test_pushover(user_key):
    """Test Pushover configuration"""
    try:
        token = os.getenv('PUSHOVER_APP_TOKEN')
        
        if not token:
            return False, "Missing PUSHOVER_APP_TOKEN"
        
        if not user_key:
            return False, "User key required"
        
        response = requests.post('https://api.pushover.net/1/messages.json', data={
            'token': token,
            'user': user_key,
            'message': 'Test notification from FossaWork V2',
            'title': 'FossaWork Test'
        })
        
        if response.status_code == 200:
            return True, "Pushover notification sent"
        else:
            return False, f"Pushover failed: {response.text}"
    except Exception as e:
        return False, f"Pushover error: {str(e)}"

if __name__ == "__main__":
    print("Testing Email...")
    success, message = test_email()
    print(f"  {'✓' if success else '✗'} {message}")
    
    print("\nTesting Pushover...")
    user_key = input("Enter your Pushover User Key (or press Enter to skip): ").strip()
    if user_key:
        success, message = test_pushover(user_key)
        print(f"  {'✓' if success else '✗'} {message}")
    else:
        print("  - Skipped")
```

### Running Tests

```bash
cd backend
python test_notifications.py
```

## Troubleshooting

### Email Issues

1. **Authentication Failed**
   - Verify username and password
   - Ensure app-specific password is used (not regular password)
   - Check if less secure app access is needed

2. **Connection Timeout**
   - Check firewall settings
   - Verify SMTP host and port
   - Try different ports (587, 465, 25)

3. **TLS/SSL Errors**
   - Toggle SMTP_TLS and SMTP_SSL settings
   - Port 587 usually needs TLS=true, SSL=false
   - Port 465 usually needs TLS=false, SSL=true

### Pushover Issues

1. **Invalid Token**
   - Verify 30-character app token
   - Ensure no extra spaces
   - Check if app is active on Pushover dashboard

2. **User Key Invalid**
   - Verify 30-character user key
   - Ensure user has active Pushover subscription
   - Check device is registered

3. **Rate Limiting**
   - Pushover limits: 7,500 messages/month
   - Implement throttling if needed

## Security Considerations

1. **Never commit .env file**
   - Add to .gitignore
   - Use .env.example as template

2. **Use App Passwords**
   - Never use main account password
   - Generate specific passwords for apps

3. **Secure Storage**
   - Credentials are encrypted in database
   - Master key required for decryption

4. **Production Setup**
   - Use environment variables
   - Consider secret management service
   - Rotate credentials regularly

## Feature Flags

Control notifications via .env:

```env
# Enable/disable notification channels
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_PUSHOVER_NOTIFICATIONS=true
```

## Next Steps

1. Configure your preferred notification method
2. Run the test script to verify
3. Save user-specific settings in the app
4. Test via the Testing Dashboard

For more details on notification templates and customization, see the [Email Templates Documentation](/ai_docs/systems/notifications.md).
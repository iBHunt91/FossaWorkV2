#!/usr/bin/env python3
"""
Fixed Notification Manager that loads user SMTP settings
"""

from pathlib import Path
import json
from typing import Optional
from sqlalchemy.orm import Session

from .notification_manager import NotificationManager, EmailSettings, PushoverSettings
from ..database import get_db


def get_notification_manager_with_user_settings(user_id: str, db: Session = None) -> NotificationManager:
    """Create notification manager with user-specific SMTP settings"""
    if db is None:
        db = next(get_db())
    
    # Load user's SMTP settings
    smtp_settings_path = Path(f"data/users/{user_id}/settings/smtp.json")
    
    if smtp_settings_path.exists():
        with open(smtp_settings_path, 'r') as f:
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
    else:
        # Default settings
        email_settings = EmailSettings(
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            username="",
            password="",
            use_tls=True,
            use_ssl=False,
            from_email="",
            from_name="FossaWork Automation"
        )
    
    # Load user's Pushover settings if available
    notification_prefs_path = Path(f"data/users/{user_id}/settings/notification_preferences.json")
    
    if notification_prefs_path.exists():
        with open(notification_prefs_path, 'r') as f:
            prefs = json.load(f)
        
        pushover_settings = PushoverSettings(
            api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",  # FossaWork app token
            user_key=prefs.get('pushover_user_key', '')
        )
    else:
        pushover_settings = PushoverSettings(
            api_token="azrfbwsp4w3mjnuxvuk9s96n6j2jg2",
            user_key=""
        )
    
    return NotificationManager(db, email_settings, pushover_settings)
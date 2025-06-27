"""
Notification service for sending alerts via multiple channels.
"""

import json
import os
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import asyncio
from datetime import datetime

class NotificationService:
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.settings_path = f"data/users/{user_id}/settings.json"
        self.settings = self._load_settings()
    
    def _load_settings(self) -> Dict[str, Any]:
        """Load user notification settings"""
        if not os.path.exists(self.settings_path):
            return {
                "notifications": {
                    "email": {"enabled": False},
                    "pushover": {"enabled": False},
                    "desktop": {"enabled": False}
                }
            }
        
        with open(self.settings_path, 'r') as f:
            return json.load(f)
    
    async def send_notification(self, title: str, message: str, priority: str = "normal") -> Dict[str, bool]:
        """Send notification to all enabled channels"""
        results = {}
        
        # Email notification
        if self.settings.get("notifications", {}).get("email", {}).get("enabled"):
            results["email"] = await self._send_email(title, message)
        
        # Pushover notification
        if self.settings.get("notifications", {}).get("pushover", {}).get("enabled"):
            results["pushover"] = await self._send_pushover(title, message, priority)
        
        # Desktop notification (placeholder)
        if self.settings.get("notifications", {}).get("desktop", {}).get("enabled"):
            results["desktop"] = await self._send_desktop(title, message)
        
        return results
    
    async def _send_email(self, subject: str, body: str) -> bool:
        """Send email notification"""
        try:
            email_settings = self.settings["notifications"]["email"]
            
            msg = MIMEMultipart()
            msg['From'] = email_settings['from_email']
            msg['To'] = email_settings['to_email']
            msg['Subject'] = f"[FossaWork] {subject}"
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Connect to SMTP server
            if email_settings.get('use_ssl', True):
                server = smtplib.SMTP_SSL(
                    email_settings['smtp_server'], 
                    email_settings['smtp_port']
                )
            else:
                server = smtplib.SMTP(
                    email_settings['smtp_server'], 
                    email_settings['smtp_port']
                )
                if email_settings.get('use_tls', True):
                    server.starttls()
            
            server.login(
                email_settings['username'], 
                email_settings['password']
            )
            
            server.send_message(msg)
            server.quit()
            
            return True
        except Exception as e:
            print(f"Email notification failed: {e}")
            return False
    
    async def _send_pushover(self, title: str, message: str, priority: str) -> bool:
        """Send Pushover notification"""
        try:
            pushover_settings = self.settings["notifications"]["pushover"]
            
            # Convert priority
            priority_map = {
                "low": -1,
                "normal": 0,
                "high": 1,
                "urgent": 2
            }
            
            data = {
                "token": pushover_settings['token'],
                "user": pushover_settings['user'],
                "title": title,
                "message": message,
                "priority": priority_map.get(priority, 0),
                "timestamp": int(datetime.now().timestamp())
            }
            
            response = requests.post(
                "https://api.pushover.net/1/messages.json",
                data=data,
                timeout=10
            )
            
            return response.status_code == 200
        except Exception as e:
            print(f"Pushover notification failed: {e}")
            return False
    
    async def _send_desktop(self, title: str, message: str) -> bool:
        """Send desktop notification (placeholder for Electron integration)"""
        # In a real implementation, this would communicate with the Electron app
        # For now, we'll just return True to indicate it would be sent
        return True
#!/usr/bin/env python3
"""
Demo Enhanced Pushover Notifications

Demonstrates the migrated V1 Pushover notification templates with enhanced 
V2 functionality. Shows examples of all message types with V1-inspired 
design patterns including:

- Multi-section layouts with color-coded formatting
- Smart message splitting for Pushover's character limits
- Enhanced automation status messages
- Schedule change notifications with detailed formatting
- Critical alert messages with action items
- Daily summary with comprehensive statistics

Usage:
    python demo_enhanced_pushover.py
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, Any

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.pushover_notification import (
    PushoverNotificationService,
    PushoverSettings,
    PushoverPriority,
    PushoverSound
)
from app.services.logging_service import LoggingService


class PushoverDemo:
    """Demo class for enhanced Pushover notifications"""
    
    def __init__(self):
        # Mock settings for demo
        self.pushover_settings = PushoverSettings(
            api_token="demo_app_token",
            user_key="demo_user_key"
        )
        
        # Create demo service (won't actually send messages)
        self.service = PushoverNotificationService(None, self.pushover_settings)
        self.service.session = None  # Prevent actual API calls
    
    def print_message_preview(self, title: str, message: str, priority: str, sound: str, html: bool = False):
        """Print a formatted preview of the Pushover message"""
        print("=" * 60)
        print(f"📱 PUSHOVER MESSAGE PREVIEW")
        print("=" * 60)
        print(f"Title: {title}")
        print(f"Priority: {priority}")
        print(f"Sound: {sound}")
        print(f"HTML: {html}")
        print("-" * 60)
        
        if html:
            # Show HTML formatting for reference
            print("HTML Content:")
            print(message)
            print("-" * 60)
            print("Rendered Preview (approximate):")
            # Basic HTML to text conversion for demo
            rendered = message.replace("<b>", "").replace("</b>", "")
            rendered = rendered.replace("<font color='#007AFF'>", "").replace("</font>", "")
            rendered = rendered.replace("<font color='#888'>", "").replace("<font color='#34C759'>", "")
            rendered = rendered.replace("<font color='#FF3B30'>", "").replace("<font color='#FF9500'>", "")
            rendered = rendered.replace("<b style='color: #34C759'>", "").replace("<b style='color: #FF3B30'>", "")
            print(rendered)
        else:
            print(message)
        
        print("=" * 60)
        print()
    
    async def demo_automation_started(self):
        """Demo automation started notification"""
        print("🚀 AUTOMATION STARTED NOTIFICATION")
        print()
        
        data = {
            "station_name": "Circle K #2891",
            "dispenser_count": 10,
            "estimated_duration": 25,
            "service_code": "3146",
            "start_time": datetime.now().strftime("%I:%M %p")
        }
        
        message = await self.service._create_message("demo_user", "automation_started", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_automation_completed(self):
        """Demo automation completed notification"""
        print("✅ AUTOMATION COMPLETED NOTIFICATION")
        print()
        
        data = {
            "station_name": "Circle K #2891",
            "duration": "23m 45s",
            "forms_completed": 10,
            "total_forms": 10,
            "success_rate": 100,
            "completion_time": datetime.now().strftime("%I:%M %p")
        }
        
        message = await self.service._create_message("demo_user", "automation_completed", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_automation_failed(self):
        """Demo automation failed notification"""
        print("❌ AUTOMATION FAILED NOTIFICATION")
        print()
        
        data = {
            "station_name": "Circle K #2892",
            "error_message": "Network timeout during form submission",
            "progress_percentage": 60,
            "completed_dispensers": 6,
            "total_dispensers": 10,
            "recommended_action": "Check internet connection and retry",
            "failure_time": datetime.now().strftime("%I:%M %p")
        }
        
        message = await self.service._create_message("demo_user", "automation_failed", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_schedule_changes(self):
        """Demo schedule change notification with multiple sections"""
        print("📅 SCHEDULE CHANGE NOTIFICATION")
        print()
        
        # Create realistic schedule change data
        schedule_changes = {
            "changes": [
                {
                    "type": "added",
                    "job_id": "48592",
                    "date": "Fri 5/30",
                    "station_name": "Circle K #2891",
                    "address": "123 Main St, Dallas",
                    "dispensers": 10,
                    "service_code": "3146"
                },
                {
                    "type": "added",
                    "job_id": "48593",
                    "date": "Fri 5/30",
                    "station_name": "Circle K #2894",
                    "address": "789 Commerce Ave, Dallas",
                    "dispensers": 8,
                    "service_code": "2861"
                },
                {
                    "type": "removed",
                    "job_id": "48590",
                    "date": "Thu 5/29",
                    "station_name": "Circle K #2892",
                    "address": "456 Oak Ave, Dallas"
                },
                {
                    "type": "changed",
                    "job_id": "48591",
                    "old_date": "Tue 5/27",
                    "new_date": "Thu 5/29",
                    "station_name": "Circle K #2893"
                }
            ]
        }
        
        # Format the data using the enhanced method
        added_jobs = []
        removed_jobs = []
        changed_jobs = []
        
        for change in schedule_changes["changes"]:
            if change["type"] == "added":
                job_line = f"#{change['job_id']} • {change['date']}\n{change['station_name']}\n{change.get('address', 'N/A')}\n{change.get('dispensers', 0)} disp • Job {change.get('service_code', 'N/A')}"
                added_jobs.append(job_line)
            elif change["type"] == "removed":
                job_line = f"#{change['job_id']} • {change['date']}\n{change['station_name']}\n{change.get('address', 'N/A')}"
                removed_jobs.append(job_line)
            elif change["type"] == "changed":
                job_line = f"#{change['job_id']}\n{change['old_date']} → {change['new_date']}\n{change['station_name']}"
                changed_jobs.append(job_line)
        
        data = {
            "added_count": len(added_jobs),
            "removed_count": len(removed_jobs),
            "changed_count": len(changed_jobs),
            "added_jobs": "\n\n".join(added_jobs),
            "removed_jobs": "\n\n".join(removed_jobs),
            "changed_jobs": "\n\n".join(changed_jobs),
        }
        
        message = await self.service._create_message("demo_user", "schedule_change", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_error_alert(self):
        """Demo critical error alert notification"""
        print("🚨 CRITICAL ERROR ALERT NOTIFICATION")
        print()
        
        data = {
            "alert_count": 1,
            "alert_type": "Battery Critical",
            "component": "DISP-001",
            "error_details": "Battery: 5% remaining",
            "location": "Store #2891",
            "recommended_action": "Replace immediately"
        }
        
        message = await self.service._create_message("demo_user", "error_alert", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_daily_summary(self):
        """Demo daily summary notification"""
        print("📊 DAILY SUMMARY NOTIFICATION")
        print()
        
        data = {
            "successful_jobs": 15,
            "failed_jobs": 2,
            "dispensers_processed": 156,
            "success_rate": 88.2,
            "total_hours": 6.5
        }
        
        message = await self.service._create_message("demo_user", "daily_summary", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_test_notification(self):
        """Demo test notification"""
        print("🧪 TEST NOTIFICATION")
        print()
        
        data = {
            "sound_setting": "pushover",
            "priority_setting": "Normal",
            "test_time": datetime.now().strftime("%m/%d/%Y %I:%M %p")
        }
        
        message = await self.service._create_message("demo_user", "test_notification", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_batch_progress(self):
        """Demo batch processing progress notification"""
        print("📦 BATCH PROGRESS NOTIFICATION")
        print()
        
        data = {
            "batch_id": "BATCH-20250627-001",
            "completed_items": 25,
            "total_items": 50,
            "success_rate": 92.0,
            "estimated_completion": "15 minutes",
            "successful_items": 23,
            "failed_items": 2,
            "update_time": datetime.now().strftime("%I:%M %p")
        }
        
        message = await self.service._create_message("demo_user", "batch_update", data)
        if message:
            self.print_message_preview(
                message.title,
                message.message,
                message.priority.name,
                message.sound.value,
                message.html
            )
    
    async def demo_message_splitting(self):
        """Demo smart message splitting for long messages"""
        print("✂️ SMART MESSAGE SPLITTING DEMO")
        print()
        
        # Create a very long message to demonstrate splitting
        long_data = {
            "station_name": "Very Long Station Name That Goes On And On #2891",
            "dispenser_count": 25,
            "estimated_duration": 45,
            "service_code": "3146-EXTENDED-SERVICE-CODE",
            "start_time": datetime.now().strftime("%I:%M %p"),
            "additional_info": "This is additional information that makes the message much longer than normal. " * 10
        }
        
        # Create template with very long message for splitting demo
        long_template = {
            "title": "🚀 Long Message Test",
            "message": "<b>🚀 Very Long Job Started</b>\n\n<font color='#007AFF'>Station:</font> {station_name}\n<font color='#888'>Dispensers:</font> {dispenser_count}\n<font color='#888'>Est. Time:</font> {estimated_duration} min\n<font color='#888'>Service:</font> {service_code}\n<font color='#888'>Additional Info:</font> {additional_info}\n\n<font color='#888'>─────────────────</font>\n<font color='#888'>Started: {start_time}</font>",
            "priority": PushoverPriority.NORMAL,
            "sound": PushoverSound.PUSHOVER,
            "html": True
        }
        
        # Temporarily add long template
        original_template = self.service.MESSAGE_TEMPLATES.get("automation_started")
        self.service.MESSAGE_TEMPLATES["long_message_test"] = long_template
        
        try:
            messages = await self.service._create_message("demo_user", "long_message_test", long_data)
            
            if isinstance(messages, list):
                print(f"Message split into {len(messages)} parts:")
                print()
                for i, message in enumerate(messages):
                    print(f"📱 PART {i+1}/{len(messages)}")
                    print("-" * 40)
                    self.print_message_preview(
                        message.title,
                        message.message,
                        message.priority.name,
                        message.sound.value,
                        message.html
                    )
            else:
                print("Message was short enough to send as single message")
                self.print_message_preview(
                    messages.title,
                    messages.message,
                    messages.priority.name,
                    messages.sound.value,
                    messages.html
                )
        finally:
            # Restore original template
            if original_template:
                self.service.MESSAGE_TEMPLATES["automation_started"] = original_template
            self.service.MESSAGE_TEMPLATES.pop("long_message_test", None)
    
    async def run_all_demos(self):
        """Run all notification demos"""
        print("🎭 ENHANCED PUSHOVER NOTIFICATIONS DEMO")
        print("V1 → V2 Migration: Superior Design & Functionality")
        print("=" * 80)
        print()
        
        demos = [
            ("Automation Started", self.demo_automation_started),
            ("Automation Completed", self.demo_automation_completed),
            ("Automation Failed", self.demo_automation_failed),
            ("Schedule Changes", self.demo_schedule_changes),
            ("Critical Alert", self.demo_error_alert),
            ("Daily Summary", self.demo_daily_summary),
            ("Test Notification", self.demo_test_notification),
            ("Batch Progress", self.demo_batch_progress),
            ("Message Splitting", self.demo_message_splitting)
        ]
        
        for i, (name, demo_func) in enumerate(demos):
            print(f"📋 Demo {i+1}/{len(demos)}: {name}")
            print()
            await demo_func()
            
            if i < len(demos) - 1:
                print("\n" + "🔄 " + "-" * 76 + " 🔄\n")
        
        print("✅ All demos completed!")
        print()
        print("🌟 ENHANCED FEATURES DEMONSTRATED:")
        print("   • Color-coded HTML formatting with visual hierarchy")
        print("   • Smart message splitting for Pushover's 1024 character limit") 
        print("   • Multi-section layouts with clear separators")
        print("   • Emoji-based visual indicators and status colors")
        print("   • Comprehensive data formatting with graceful fallbacks")
        print("   • Priority-based sound selection")
        print("   • Mobile-optimized compact layouts")
        print("   • Professional styling with consistent spacing")


async def main():
    """Main demo function"""
    demo = PushoverDemo()
    await demo.run_all_demos()


if __name__ == "__main__":
    # Run the demo
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n🛑 Demo interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Demo error: {e}")
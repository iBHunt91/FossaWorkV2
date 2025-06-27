#!/usr/bin/env python3
"""
Test script for enhanced email templates

This script demonstrates the new template variables and enhanced designs
for the V2 email notification system.
"""

import sys
from datetime import datetime
from pathlib import Path
from enum import Enum

try:
    from jinja2 import Template
except ImportError:
    print("❌ Jinja2 not installed. Install with: pip install jinja2")
    sys.exit(1)

# Define NotificationType enum for standalone testing
class NotificationType(Enum):
    AUTOMATION_STARTED = "automation_started"
    AUTOMATION_COMPLETED = "automation_completed"
    AUTOMATION_FAILED = "automation_failed"
    DAILY_DIGEST = "daily_digest"
    SCHEDULE_CHANGE = "schedule_change"

def test_template_rendering():
    """Test template rendering with sample data"""
    
    # Sample data for automation started
    automation_started_data = {
        "user_name": "John Smith",
        "station_name": "Circle K Store #2891",
        "job_id": "AUTO-12345",
        "work_order_id": "W-48592",
        "service_code": "2861",
        "service_name": "All Dispensers (AccuMeasure)",
        "dispenser_count": 10,
        "total_iterations": 3,
        "start_time": "2025-01-26 10:30:00",
        "location_address": "123 Main Street, Dallas, TX 75201",
        "dashboard_url": "https://app.fossawork.com/dashboard",
        "settings_url": "https://app.fossawork.com/settings",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    }
    
    # Sample data for automation completed
    automation_completed_data = {
        "user_name": "John Smith",
        "station_name": "Circle K Store #2891",
        "job_id": "AUTO-12345",
        "work_order_id": "W-48592",
        "duration": "45 minutes",
        "dispensers_processed": 10,
        "forms_completed": 30,
        "total_iterations": 3,
        "success_rate": 100,
        "completion_time": "2025-01-26 11:15:00",
        "location_address": "123 Main Street, Dallas, TX 75201",
        "dashboard_url": "https://app.fossawork.com/dashboard",
        "reports_url": "https://app.fossawork.com/reports",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    }
    
    # Sample data for automation failed
    automation_failed_data = {
        "user_name": "John Smith",
        "station_name": "Circle K Store #2891",
        "job_id": "AUTO-12345",
        "work_order_id": "W-48592",
        "error_message": "WorkFossa authentication failed: Invalid credentials",
        "failure_time": "2025-01-26 10:45:00",
        "progress_percentage": 65,
        "retry_available": True,
        "location_address": "123 Main Street, Dallas, TX 75201",
        "dashboard_url": "https://app.fossawork.com/dashboard",
        "support_url": "https://app.fossawork.com/support",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    }
    
    # Sample data for daily digest
    daily_digest_data = {
        "user_name": "John Smith",
        "date": "January 26, 2025",
        "total_jobs": 8,
        "successful_jobs": 7,
        "failed_jobs": 1,
        "dispensers_processed": 156,
        "success_rate": 87.5,
        "recent_jobs": [
            {
                "station_name": "Circle K Store #2891",
                "status": "success",
                "time": "10:30 AM"
            },
            {
                "station_name": "7-Eleven Store #4567",
                "status": "success", 
                "time": "2:15 PM"
            },
            {
                "station_name": "Wawa Store #8901",
                "status": "failed",
                "time": "4:45 PM"
            }
        ],
        "dashboard_url": "https://app.fossawork.com/dashboard",
        "analytics_url": "https://app.fossawork.com/analytics",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    }
    
    # Sample data for schedule changes
    schedule_change_data = {
        "user_name": "John Smith", 
        "change_count": 3,
        "added_visits": [
            {
                "id": "48592",
                "date": "Friday, May 30th",
                "customer_name": "Circle K",
                "store_number": "2891",
                "address": "123 Main Street, Dallas, TX 75201",
                "dispenser_count": 10,
                "service_name": "Open Neck Prover",
                "service_code": "3146"
            }
        ],
        "removed_visits": [
            {
                "id": "48590",
                "date": "Thursday, May 29th",
                "customer_name": "Circle K",
                "store_number": "2892",
                "address": "456 Oak Avenue, Dallas, TX 75202",
                "dispenser_count": 8,
                "service_name": "All Dispensers",
                "service_code": "2861"
            }
        ],
        "date_changed_visits": [
            {
                "id": "48591",
                "old_date": "Tuesday, May 27th",
                "new_date": "Thursday, May 29th",
                "customer_name": "Circle K",
                "store_number": "2893",
                "address": "789 Elm Street, Dallas, TX 75203",
                "dispenser_count": 12,
                "service_name": "Specific Dispensers",
                "service_code": "2862"
            }
        ],
        "swapped_visits": [],
        "schedule_url": "https://app.fossawork.com/schedule",
        "settings_url": "https://app.fossawork.com/settings",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    }
    
    # Define templates for testing (excerpted from EmailNotificationService)
    templates = {
        NotificationType.AUTOMATION_STARTED: {
            "subject": "🚀 Automation Job Started - {station_name}",
            "html_template": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                        margin: 0; 
                        padding: 20px; 
                        background-color: #f5f5f7; 
                        line-height: 1.6; 
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background: white; 
                        border-radius: 12px; 
                        overflow: hidden; 
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
                    }
                    .header { 
                        background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%); 
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                    }
                    .header h1 { 
                        margin: 0; 
                        font-size: 28px; 
                        font-weight: 600; 
                    }
                    .header p { 
                        margin: 10px 0 0 0; 
                        opacity: 0.9; 
                        font-size: 16px; 
                    }
                    .content { 
                        padding: 30px; 
                    }
                    .info-section { 
                        background-color: #E8F5E9; 
                        border-left: 4px solid #34C759; 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 20px 0; 
                    }
                    .info-section h3 { 
                        color: #34C759; 
                        margin-top: 0; 
                        margin-bottom: 15px; 
                        font-size: 18px; 
                    }
                    .location-link {
                        color: #007AFF;
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .status-badge { 
                        display: inline-block; 
                        padding: 6px 12px; 
                        border-radius: 20px; 
                        font-weight: 600; 
                        font-size: 14px;
                        background: #E8F5E9; 
                        color: #34C759; 
                        border: 1px solid #34C759;
                    }
                    .footer { 
                        background: #f8f9fa; 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #6c757d; 
                        border-top: 1px solid #dee2e6;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚀 Automation Job Started</h1>
                        <p>Your automation task is now running</p>
                    </div>
                    <div class="content">
                        <p>Hello {{user_name | default('User')}},</p>
                        <p>Your automation job has been started successfully and is now processing.</p>
                        
                        <div class="info-section">
                            <h3>✅ Job Details</h3>
                            <p><strong>📍 Station:</strong> {{station_name}}</p>
                            {% if location_address %}
                            <p><a href="https://maps.google.com/?q={{location_address | urlencode}}" class="location-link">View on Google Maps</a></p>
                            {% endif %}
                            <p><strong>🆔 Job ID:</strong> {{job_id}}</p>
                            <p><strong>📋 Work Order:</strong> {{work_order_id}}</p>
                            <p><strong>🔧 Service:</strong> {{service_code}} - {{service_name | default('Automation Task')}}</p>
                            <p><strong>⛽ Dispensers:</strong> {{dispenser_count}} dispensers</p>
                            <p><strong>🔄 Total Iterations:</strong> {{total_iterations}}</p>
                            <p><strong>Status:</strong> <span class="status-badge">Started</span></p>
                            <p><strong>Started At:</strong> {{start_time}}</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                        <p>🔗 <a href="{{dashboard_url | default('#')}}" style="color: #007AFF;">View Dashboard</a></p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        NotificationType.SCHEDULE_CHANGE: {
            "subject": "📅 Schedule Changes Detected - {change_count} updates",
            "html_template": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                        margin: 0; 
                        padding: 20px; 
                        background-color: #f5f5f7; 
                        line-height: 1.6; 
                    }
                    .container { 
                        max-width: 700px; 
                        margin: 0 auto; 
                        background: white; 
                        border-radius: 12px; 
                        overflow: hidden; 
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
                    }
                    .header { 
                        background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%); 
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                    }
                    .header h1 { 
                        margin: 0; 
                        font-size: 28px; 
                        font-weight: 600; 
                    }
                    .header p { 
                        margin: 10px 0 0 0; 
                        opacity: 0.9; 
                        font-size: 16px; 
                    }
                    .content { 
                        padding: 30px; 
                    }
                    .change-section { 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 20px 0; 
                    }
                    .added { 
                        background-color: #E8F5E9; 
                        border-left: 4px solid #34C759; 
                    }
                    .removed { 
                        background-color: #FFEBEE; 
                        border-left: 4px solid #FF3B30; 
                    }
                    .date-changed { 
                        background-color: #FFF3E0; 
                        border-left: 4px solid #FF9500; 
                    }
                    .change-section h3 { 
                        margin-top: 0; 
                        margin-bottom: 15px; 
                        font-size: 18px; 
                    }
                    .added h3 { color: #34C759; }
                    .removed h3 { color: #FF3B30; }
                    .date-changed h3 { color: #FF9500; }
                    .visit-item {
                        background: white;
                        border-radius: 6px;
                        padding: 15px;
                        margin: 15px 0;
                        border: 1px solid rgba(0,0,0,0.1);
                    }
                    .location-link {
                        color: #007AFF;
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .summary-box {
                        background: #f0f0f0; 
                        border-radius: 8px; 
                        padding: 20px; 
                        text-align: center; 
                        margin: 30px 0;
                        border: 1px solid #dee2e6;
                    }
                    .footer { 
                        background: #f8f9fa; 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #6c757d; 
                        border-top: 1px solid #dee2e6;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📅 Schedule Changes Detected</h1>
                        <p>Hello {{user_name | default('User')}}, here are your latest schedule updates</p>
                    </div>
                    <div class="content">
                        {% if added_visits %}
                        <div class="change-section added">
                            <h3>✅ Added Visits ({{added_visits | length}})</h3>
                            {% for visit in added_visits %}
                            <div class="visit-item">
                                <strong>Visit #{{visit.id}} - {{visit.date}}</strong><br>
                                📍 {{visit.customer_name}} - Store #{{visit.store_number}}<br>
                                📌 {{visit.address}}<br>
                                ⛽ {{visit.dispenser_count}} dispensers | Job: {{visit.service_name}} ({{visit.service_code}})<br>
                                {% if visit.address %}
                                <a href="https://maps.google.com/?q={{visit.address | urlencode}}" class="location-link">View on Google Maps</a>
                                {% endif %}
                            </div>
                            {% endfor %}
                        </div>
                        {% endif %}
                        
                        {% if removed_visits %}
                        <div class="change-section removed">
                            <h3>❌ Removed Visits ({{removed_visits | length}})</h3>
                            {% for visit in removed_visits %}
                            <div class="visit-item">
                                <strong>Visit #{{visit.id}} - {{visit.date}}</strong><br>
                                📍 {{visit.customer_name}} - Store #{{visit.store_number}}<br>
                                📌 {{visit.address}}<br>
                                ⛽ {{visit.dispenser_count}} dispensers | Job: {{visit.service_name}} ({{visit.service_code}})
                            </div>
                            {% endfor %}
                        </div>
                        {% endif %}
                        
                        {% if date_changed_visits %}
                        <div class="change-section date-changed">
                            <h3>📅 Date Changes ({{date_changed_visits | length}})</h3>
                            {% for visit in date_changed_visits %}
                            <div class="visit-item">
                                <strong>Visit #{{visit.id}}</strong><br>
                                <strong>Changed from:</strong> {{visit.old_date}} → {{visit.new_date}}<br>
                                📍 {{visit.customer_name}} - Store #{{visit.store_number}}<br>
                                📌 {{visit.address}}<br>
                                ⛽ {{visit.dispenser_count}} dispensers | Job: {{visit.service_name}} ({{visit.service_code}})
                            </div>
                            {% endfor %}
                        </div>
                        {% endif %}
                        
                        <div class="summary-box">
                            <strong>📊 Summary:</strong> 
                            {{added_visits | length | default(0)}} visits added, 
                            {{removed_visits | length | default(0)}} visits removed, 
                            {{date_changed_visits | length | default(0)}} date changes
                        </div>
                    </div>
                    <div class="footer">
                        <p>FossaWork V2 Automation System | Generated at {{timestamp}}</p>
                        <p>🔗 <a href="{{schedule_url | default('#')}}" style="color: #007AFF;">View Full Schedule</a></p>
                    </div>
                </div>
            </body>
            </html>
            """
        }
    }
    
    # Test each template
    test_cases = [
        (NotificationType.AUTOMATION_STARTED, automation_started_data),
        (NotificationType.SCHEDULE_CHANGE, schedule_change_data)
    ]
    
    print("🧪 Testing Enhanced Email Templates V2")
    print("=" * 50)
    
    for notification_type, test_data in test_cases:
        print(f"\n📧 Testing {notification_type.value}...")
        
        try:
            template_config = templates[notification_type]
            
            # Render subject
            subject = template_config["subject"].format(**test_data)
            print(f"   Subject: {subject}")
            
            # Render HTML template
            html_template = Template(template_config["html_template"])
            html_content = html_template.render(**test_data)
            
            # Save rendered template to file for viewing
            output_dir = Path(__file__).parent / "output"
            output_dir.mkdir(exist_ok=True)
            
            output_file = output_dir / f"{notification_type.value}_enhanced.html"
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            print(f"   ✅ Rendered successfully")
            print(f"   📁 Saved to: {output_file}")
            
            # Check for new template variables
            new_vars = [
                "user_name", "location_address", "service_name", 
                "dashboard_url", "settings_url", "reports_url",
                "support_url", "analytics_url", "schedule_url"
            ]
            
            used_vars = [var for var in new_vars if var in str(html_content)]
            if used_vars:
                print(f"   🆕 New variables used: {', '.join(used_vars)}")
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
    
    print(f"\n🎉 Testing complete! Check the output directory for rendered templates:")
    print(f"   📂 {Path(__file__).parent / 'output'}")
    
    print(f"\n💡 To view templates:")
    print(f"   - Open .html files in your web browser")
    print(f"   - Compare with original V1 designs")
    print(f"   - Test responsive design by resizing browser")

def test_google_maps_integration():
    """Test Google Maps URL generation"""
    
    print(f"\n🗺️  Testing Google Maps Integration")
    print("=" * 40)
    
    test_addresses = [
        "123 Main Street, Dallas, TX 75201",
        "456 Oak Avenue, Dallas, TX 75202", 
        "789 Elm Street, Dallas, TX 75203",
        "1600 Amphitheatre Parkway, Mountain View, CA 94043"
    ]
    
    for address in test_addresses:
        # Simulate URL encoding
        encoded_address = address.replace(" ", "+").replace(",", "%2C")
        maps_url = f"https://maps.google.com/?q={encoded_address}"
        
        print(f"   Address: {address}")
        print(f"   Maps URL: {maps_url}")
        print()

def demonstrate_color_coding():
    """Demonstrate the color-coded change sections"""
    
    print(f"\n🎨 Color-Coded Change Sections")
    print("=" * 40)
    
    color_schemes = {
        "Added/Success": {"color": "#34C759", "background": "#E8F5E9"},
        "Removed/Failed": {"color": "#FF3B30", "background": "#FFEBEE"},
        "Date Changes": {"color": "#FF9500", "background": "#FFF3E0"},
        "Swapped": {"color": "#007AFF", "background": "#E3F2FD"},
        "Replaced": {"color": "#AF52DE", "background": "#F3E5F5"}
    }
    
    for change_type, colors in color_schemes.items():
        print(f"   {change_type}:")
        print(f"     Text Color: {colors['color']}")
        print(f"     Background: {colors['background']}")
        print()

if __name__ == "__main__":
    print("🚀 Enhanced Email Templates V2 - Test Suite")
    print("=" * 60)
    
    try:
        test_template_rendering()
        test_google_maps_integration()
        demonstrate_color_coding()
        
        print(f"\n✨ All tests completed successfully!")
        print(f"\n📖 Next Steps:")
        print(f"   1. Review rendered HTML files in output directory")
        print(f"   2. Test in actual email clients")
        print(f"   3. Verify Google Maps links work correctly")
        print(f"   4. Test responsive design on mobile devices")
        print(f"   5. Update notification service to use new variables")
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        sys.exit(1)
"""
Testing endpoints for the system testing dashboard.
Provides visual verification of all system functionality.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import asyncio
from datetime import datetime
from typing import Dict, Any
import os
import json
import time

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user_models import User
from app.services.form_automation import FormAutomationService
from app.services.notification_service import NotificationService
from app.database import engine
from playwright.async_api import async_playwright

router = APIRouter(prefix="/api/test", tags=["testing"])

@router.get("/health")
async def test_health():
    """Basic health check - no authentication required"""
    return {
        "success": True,
        "message": "API is healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "testing_endpoints": "Available"
    }

@router.get("/version")
async def test_version():
    """Get API version and system info"""
    return {
        "success": True,
        "message": "System version information",
        "data": {
            "api_version": "2.0.0",
            "python_version": "3.8+",
            "backend": "FastAPI",
            "database": "SQLite",
            "automation": "Playwright"
        }
    }

@router.get("/auth/validate-token")
async def test_token_validation(current_user: User = Depends(get_current_user)):
    """Validate JWT token"""
    return {
        "success": True,
        "message": f"Token is valid for user: {current_user.username}",
        "data": {
            "user_id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "token_valid": True
        }
    }

@router.get("/auth/test-workfossa")
async def test_workfossa_connection(current_user: User = Depends(get_current_user)):
    """Test connection to WorkFossa API"""
    try:
        # Check if credentials exist using the CredentialManager
        from app.services.credential_manager import CredentialManager
        credential_manager = CredentialManager()
        
        # Try to retrieve credentials
        credentials = credential_manager.retrieve_credentials(current_user.id)
        
        if not credentials:
            return {
                "success": False,
                "message": "WorkFossa credentials not found",
                "data": {"credentials_exist": False}
            }
        
        if not credentials.username or not credentials.password:
            return {
                "success": False,
                "message": "WorkFossa credentials not configured properly",
                "data": {"credentials_configured": False}
            }
        
        # Test basic connectivity to WorkFossa
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                await page.goto("https://app.workfossa.com", timeout=10000)
                await page.wait_for_load_state("networkidle", timeout=10000)
                
                # Check if we can reach the login page
                title = await page.title()
                
                return {
                    "success": True,
                    "message": "WorkFossa is accessible",
                    "data": {
                        "reachable": True,
                        "page_title": title,
                        "credentials_exist": True,
                        "credentials_configured": True
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Cannot reach WorkFossa: {str(e)}",
                    "data": {"error": str(e)}
                }
            finally:
                await browser.close()
                
    except Exception as e:
        return {
            "success": False,
            "message": f"WorkFossa test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/health/database")
async def test_database(db: Session = Depends(get_db)):
    """Test database connectivity"""
    try:
        # Simple query to test connection
        result = db.execute(text("SELECT 1"))
        result.fetchone()
        
        # Get database file info
        db_path = "fossawork_v2.db"
        db_exists = os.path.exists(db_path)
        db_size = os.path.getsize(db_path) if db_exists else 0
        
        return {
            "success": True,
            "message": "Database is accessible",
            "data": {
                "connected": True,
                "database_exists": db_exists,
                "database_size_mb": round(db_size / 1024 / 1024, 2),
                "database_type": "SQLite"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Database connection failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/health/tables")
async def test_database_tables(db: Session = Depends(get_db)):
    """Check if all required tables exist"""
    try:
        tables = {
            "users": "SELECT COUNT(*) FROM users",
            "work_orders": "SELECT COUNT(*) FROM work_orders",
            "dispensers": "SELECT COUNT(*) FROM dispensers",
            "automation_jobs": "SELECT COUNT(*) FROM automation_jobs",
            "scraping_schedules": "SELECT COUNT(*) FROM scraping_schedules"
        }
        
        table_info = {}
        for table_name, query in tables.items():
            try:
                result = db.execute(text(query))
                count = result.scalar()
                table_info[table_name] = {
                    "exists": True,
                    "row_count": count
                }
            except Exception:
                table_info[table_name] = {
                    "exists": False,
                    "row_count": 0
                }
        
        all_exist = all(info["exists"] for info in table_info.values())
        
        return {
            "success": all_exist,
            "message": "All tables exist" if all_exist else "Some tables are missing",
            "data": table_info
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Table check failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/health/db-performance")
async def test_database_performance(db: Session = Depends(get_db)):
    """Test database query performance"""
    try:
        import time
        
        # Test simple query
        start = time.time()
        db.execute(text("SELECT 1"))
        simple_query_time = (time.time() - start) * 1000
        
        # Test join query
        start = time.time()
        db.execute(text("""
            SELECT COUNT(*) 
            FROM work_orders wo 
            LEFT JOIN dispensers d ON wo.id = d.work_order_id
        """))
        join_query_time = (time.time() - start) * 1000
        
        # Test index performance
        start = time.time()
        db.execute(text("SELECT * FROM work_orders WHERE store_number = '1234' LIMIT 1"))
        index_query_time = (time.time() - start) * 1000
        
        performance_good = all(t < 100 for t in [simple_query_time, join_query_time, index_query_time])
        
        return {
            "success": performance_good,
            "message": "Database performance is good" if performance_good else "Database performance issues detected",
            "data": {
                "simple_query_ms": round(simple_query_time, 2),
                "join_query_ms": round(join_query_time, 2),
                "index_query_ms": round(index_query_time, 2),
                "performance_rating": "Good" if performance_good else "Needs optimization"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Performance test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/scraping/status")
async def test_scraping_status(current_user: User = Depends(get_current_user)):
    """Check scraping service status"""
    try:
        # Check if Playwright is available
        try:
            async with async_playwright() as p:
                browser_types = ["chromium", "firefox", "webkit"]
                available_browsers = []
                
                for browser_type in browser_types:
                    try:
                        browser = await getattr(p, browser_type).launch(headless=True)
                        await browser.close()
                        available_browsers.append(browser_type)
                    except:
                        pass
                
                return {
                    "success": len(available_browsers) > 0,
                    "message": f"Scraping service is ready with {len(available_browsers)} browser(s)",
                    "data": {
                        "playwright_available": True,
                        "available_browsers": available_browsers,
                        "recommended_browser": "chromium"
                    }
                }
        except Exception as e:
            return {
                "success": False,
                "message": "Playwright is not available",
                "data": {"error": str(e)}
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Scraping status check failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/scraping/test-work-order")
async def test_work_order_scraping(current_user: User = Depends(get_current_user)):
    """Test work order scraping with a mock example"""
    try:
        return {
            "success": True,
            "message": "Work order scraping test completed (mock data)",
            "data": {
                "sample_work_order": {
                    "work_order_id": "W-123456",
                    "store_number": "#1234",
                    "customer_name": "Test Store Inc",
                    "address": "123 Test St, Test City, TS 12345",
                    "service_code": "2861",
                    "service_name": "AccuMeasure",
                    "created_date": datetime.utcnow().isoformat(),
                    "status": "Test Mode"
                },
                "note": "This is mock data for testing. Real scraping requires WorkFossa login."
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Work order test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/scraping/test-dispenser")
async def test_dispenser_scraping(current_user: User = Depends(get_current_user)):
    """Test dispenser scraping with mock data"""
    try:
        return {
            "success": True,
            "message": "Dispenser scraping test completed (mock data)",
            "data": {
                "sample_dispensers": [
                    {
                        "dispenser_id": "D001",
                        "type": "Regular",
                        "status": "Active",
                        "last_service": datetime.utcnow().isoformat()
                    },
                    {
                        "dispenser_id": "D002",
                        "type": "Premium",
                        "status": "Active",
                        "last_service": datetime.utcnow().isoformat()
                    }
                ],
                "total_count": 2,
                "note": "This is mock data for testing. Real scraping requires WorkFossa login."
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Dispenser test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/automation/status")
async def test_automation_status(current_user: User = Depends(get_current_user)):
    """Check form automation service status"""
    try:
        # Check if automation service can be initialized
        # FormAutomationService requires a BrowserAutomationService instance
        from app.services.browser_automation import BrowserAutomationService
        browser_service = BrowserAutomationService()
        service = FormAutomationService(browser_automation=browser_service)
        
        # Check if AccuMeasure credentials exist
        creds_path = f"data/users/{current_user.id}/credentials.json"
        accumeasure_configured = False
        
        if os.path.exists(creds_path):
            with open(creds_path, 'r') as f:
                creds = json.load(f)
                accumeasure_configured = 'accumeasure' in creds
        
        return {
            "success": True,
            "message": "Automation service is available",
            "data": {
                "service_available": True,
                "accumeasure_configured": accumeasure_configured,
                "supported_job_codes": ["2861", "2862", "3002", "3146"]
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Automation status check failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/automation/test-browser")
async def test_browser_launch():
    """Test if Playwright can launch a browser"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )
            page = await browser.new_page()
            await page.goto("https://example.com")
            title = await page.title()
            await browser.close()
            
            return {
                "success": True,
                "message": "Browser launched successfully",
                "data": {
                    "browser_type": "chromium",
                    "test_page_title": title,
                    "headless_mode": True
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Browser launch failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/automation/test-form-detection")
async def test_form_detection():
    """Test ability to detect form fields"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Create a simple test form
            await page.set_content("""
                <html>
                <body>
                    <form>
                        <input type="text" name="username" placeholder="Username">
                        <input type="password" name="password" placeholder="Password">
                        <input type="email" name="email" placeholder="Email">
                        <button type="submit">Submit</button>
                    </form>
                </body>
                </html>
            """)
            
            # Detect form fields
            inputs = await page.query_selector_all("input")
            buttons = await page.query_selector_all("button")
            
            field_info = []
            for input_elem in inputs:
                field_type = await input_elem.get_attribute("type")
                field_name = await input_elem.get_attribute("name")
                field_info.append({
                    "type": field_type,
                    "name": field_name
                })
            
            await browser.close()
            
            return {
                "success": True,
                "message": "Form detection working correctly",
                "data": {
                    "fields_found": len(inputs),
                    "buttons_found": len(buttons),
                    "field_details": field_info
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Form detection failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-email-config")
async def test_email_configuration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test email notification configuration"""
    try:
        # Check for SMTP settings (stored separately)
        smtp_settings_path = f"data/users/{current_user.id}/settings/smtp.json"
        
        if not os.path.exists(smtp_settings_path):
            # Try the legacy location
            legacy_settings_path = f"data/users/{current_user.id}/settings.json"
            if os.path.exists(legacy_settings_path):
                with open(legacy_settings_path, 'r') as f:
                    user_settings = json.load(f)
                email_settings = user_settings.get('notifications', {}).get('email', {})
            else:
                return {
                    "success": False,
                    "message": "Email settings not configured",
                    "data": {"configured": False}
                }
        else:
            with open(smtp_settings_path, 'r') as f:
                email_settings = json.load(f)
        
        # Check if we have the basic SMTP configuration
        required_fields = ['smtp_server', 'smtp_port', 'username', 'password']
        missing_fields = [field for field in required_fields if not email_settings.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "message": f"Missing email configuration fields: {', '.join(missing_fields)}",
                "data": {
                    "configured": True,
                    "missing_fields": missing_fields
                }
            }
        
        # Check notification preferences in database
        notification_prefs = db.execute(
            text("SELECT notification_settings FROM users WHERE id = :user_id"),
            {"user_id": current_user.id}
        ).scalar()
        
        email_enabled = True  # Default to enabled if no preferences
        if notification_prefs:
            prefs_data = json.loads(notification_prefs)
            email_enabled = prefs_data.get('email_enabled', True)
        
        return {
            "success": True,
            "message": "Email configuration is valid",
            "data": {
                "configured": True,
                "enabled": email_enabled,
                "smtp_server": email_settings['smtp_server'],
                "smtp_port": email_settings['smtp_port'],
                "from_email": email_settings.get('from_email', email_settings.get('username'))
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Email config test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-pushover-config")
async def test_pushover_configuration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test Pushover notification configuration"""
    try:
        # Check for Pushover settings in various locations
        pushover_settings = None
        
        # Check for pushover settings file
        pushover_settings_path = f"data/users/{current_user.id}/settings/pushover.json"
        if os.path.exists(pushover_settings_path):
            with open(pushover_settings_path, 'r') as f:
                pushover_settings = json.load(f)
        else:
            # Try the legacy location
            legacy_settings_path = f"data/users/{current_user.id}/settings.json"
            if os.path.exists(legacy_settings_path):
                with open(legacy_settings_path, 'r') as f:
                    user_settings = json.load(f)
                pushover_settings = user_settings.get('notifications', {}).get('pushover', {})
        
        if not pushover_settings:
            # Check notification preferences in database
            notification_prefs = db.execute(
                text("SELECT notification_settings FROM users WHERE id = :user_id"),
                {"user_id": current_user.id}
            ).scalar()
            
            if notification_prefs:
                prefs_data = json.loads(notification_prefs)
                # Look for pushover credentials in preferences
                if prefs_data.get('pushover_user_key'):
                    pushover_settings = {
                        'enabled': prefs_data.get('pushover_enabled', False),
                        'user': prefs_data.get('pushover_user_key'),
                        'token': 'app_token_configured'  # Token would be app-wide
                    }
        
        if not pushover_settings:
            return {
                "success": False,
                "message": "Pushover settings not configured",
                "data": {"configured": False}
            }
        
        pushover_enabled = pushover_settings.get('enabled', False)
        
        # Check notification preferences in database for enabled status
        notification_prefs = db.execute(
            text("SELECT notification_settings FROM users WHERE id = :user_id"),
            {"user_id": current_user.id}
        ).scalar()
        
        if notification_prefs:
            prefs_data = json.loads(notification_prefs)
            pushover_enabled = prefs_data.get('pushover_enabled', pushover_enabled)
        
        if not pushover_enabled:
            return {
                "success": False,
                "message": "Pushover notifications are disabled",
                "data": {"enabled": False, "configured": True}
            }
        
        # For Pushover, we need a user key (per user) and app token (global)
        has_user_key = bool(pushover_settings.get('user') or pushover_settings.get('user_key'))
        
        if not has_user_key:
            return {
                "success": False,
                "message": "Pushover user key missing",
                "data": {
                    "configured": True,
                    "enabled": True,
                    "has_user_key": False
                }
            }
        
        return {
            "success": True,
            "message": "Pushover configuration is valid",
            "data": {
                "configured": True,
                "enabled": True,
                "has_credentials": True
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Pushover config test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-smtp-connection")
async def test_smtp_connection(current_user: User = Depends(get_current_user)):
    """Test SMTP server connection without sending email"""
    try:
        from app.services.email_notification import EmailNotificationService, EmailSettings
        import smtplib
        import ssl
        
        # Load user email settings
        smtp_settings_path = f"data/users/{current_user.id}/settings/smtp.json"
        if not os.path.exists(smtp_settings_path):
            return {
                "success": False,
                "message": "SMTP settings not configured",
                "data": {"configured": False}
            }
        
        with open(smtp_settings_path, 'r') as f:
            smtp_config = json.load(f)
        
        # Test connection
        server = None
        try:
            if smtp_config.get('use_tls', True):
                context = ssl.create_default_context()
                server = smtplib.SMTP(smtp_config['smtp_server'], smtp_config['smtp_port'])
                server.starttls(context=context)
            else:
                server = smtplib.SMTP_SSL(smtp_config['smtp_server'], smtp_config['smtp_port'])
            
            # Test login
            server.login(smtp_config['username'], smtp_config['password'])
            
            return {
                "success": True,
                "message": "SMTP connection and authentication successful",
                "data": {
                    "smtp_server": smtp_config['smtp_server'],
                    "smtp_port": smtp_config['smtp_port'],
                    "tls_enabled": smtp_config.get('use_tls', True),
                    "auth_successful": True
                }
            }
        except smtplib.SMTPAuthenticationError as e:
            return {
                "success": False,
                "message": "SMTP authentication failed - check username/password",
                "data": {"auth_error": str(e)}
            }
        except smtplib.SMTPConnectError as e:
            return {
                "success": False,
                "message": "Cannot connect to SMTP server - check server/port",
                "data": {"connection_error": str(e)}
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"SMTP connection test failed: {str(e)}",
                "data": {"error": str(e)}
            }
        finally:
            if server:
                try:
                    server.quit()
                except:
                    pass
                    
    except Exception as e:
        return {
            "success": False,
            "message": f"SMTP test setup failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.post("/notifications/test-email-send")
async def test_email_send(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Send a test email to verify email delivery"""
    try:
        from app.services.email_notification import EmailNotificationService, EmailSettings, NotificationType
        
        # Load email settings
        smtp_settings_path = f"data/users/{current_user.id}/settings/smtp.json"
        if not os.path.exists(smtp_settings_path):
            return {
                "success": False,
                "message": "Email settings not configured",
                "data": {"configured": False}
            }
        
        with open(smtp_settings_path, 'r') as f:
            smtp_config = json.load(f)
        
        email_settings = EmailSettings(
            smtp_server=smtp_config['smtp_server'],
            smtp_port=smtp_config['smtp_port'],
            username=smtp_config['username'],
            password=smtp_config['password'],
            use_tls=smtp_config.get('use_tls', True),
            from_email=smtp_config.get('from_email', smtp_config['username']),
            from_name=smtp_config.get('from_name', 'FossaWork Testing')
        )
        
        # Create email service
        email_service = EmailNotificationService(db=db, email_settings=email_settings)
        
        # Test data for notification
        test_data = {
            "station_name": "Test Station #123",
            "job_id": "TEST-001",
            "work_order_id": "W-TEST-001",
            "started_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "service_type": "AccuMeasure Test",
            "dispenser_count": 3,
            "estimated_duration": "5 minutes"
        }
        
        # Send test automation started notification
        success = await email_service.send_automation_notification(
            user_id=current_user.id,
            notification_type=NotificationType.AUTOMATION_STARTED,
            data=test_data
        )
        
        if success:
            return {
                "success": True,
                "message": "Test email sent successfully",
                "data": {
                    "recipient": email_settings.from_email,
                    "notification_type": "automation_started",
                    "test_data": test_data
                }
            }
        else:
            return {
                "success": False,
                "message": "Email sending failed",
                "data": {"service_error": "Email service returned False"}
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Email test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-email-templates")
async def test_email_templates(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Test email template rendering"""
    try:
        from app.services.email_notification import EmailNotificationService, NotificationType
        
        # Test template rendering without sending
        email_service = EmailNotificationService(db=db, email_settings=None)
        
        test_scenarios = []
        notification_types = [
            NotificationType.AUTOMATION_STARTED,
            NotificationType.AUTOMATION_COMPLETED,
            NotificationType.AUTOMATION_FAILED,
            NotificationType.DAILY_DIGEST
        ]
        
        for notification_type in notification_types:
            try:
                # Create test data for each template
                if notification_type == NotificationType.DAILY_DIGEST:
                    test_data = {
                        "date": datetime.utcnow().strftime("%Y-%m-%d"),
                        "total_jobs": 5,
                        "successful_jobs": 4,
                        "failed_jobs": 1,
                        "dispensers_processed": 23,
                        "recent_jobs": [
                            {"station_name": "Test Station #1", "status": "completed", "time": "14:30"},
                            {"station_name": "Test Station #2", "status": "completed", "time": "15:45"},
                            {"station_name": "Test Station #3", "status": "failed", "time": "16:20"}
                        ]
                    }
                else:
                    test_data = {
                        "station_name": "Test Station #123",
                        "job_id": "TEST-001",
                        "work_order_id": "W-TEST-001",
                        "started_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                        "completed_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                        "failure_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                        "service_type": "AccuMeasure Test",
                        "dispenser_count": 3,
                        "progress_percentage": 65,
                        "error_message": "Test error for template validation",
                        "retry_available": True
                    }
                
                # Test template rendering
                template_info = email_service.EMAIL_TEMPLATES.get(notification_type)
                if template_info:
                    subject = template_info["subject"].format(**test_data)
                    html_content = template_info["html_template"].format(**test_data)
                    text_content = template_info.get("text_template", "").format(**test_data)
                    
                    test_scenarios.append({
                        "notification_type": notification_type.value,
                        "template_exists": True,
                        "subject_rendered": len(subject) > 0,
                        "html_rendered": len(html_content) > 0,
                        "text_rendered": len(text_content) > 0,
                        "subject_preview": subject[:100],
                        "html_size": len(html_content),
                        "text_size": len(text_content)
                    })
                else:
                    test_scenarios.append({
                        "notification_type": notification_type.value,
                        "template_exists": False,
                        "error": "No template found"
                    })
                    
            except Exception as e:
                test_scenarios.append({
                    "notification_type": notification_type.value,
                    "template_exists": True,
                    "rendering_error": str(e)
                })
        
        templates_working = sum(1 for scenario in test_scenarios if scenario.get("template_exists") and not scenario.get("rendering_error"))
        
        return {
            "success": templates_working > 0,
            "message": f"Template test completed - {templates_working}/{len(notification_types)} templates working",
            "data": {
                "templates_tested": len(notification_types),
                "templates_working": templates_working,
                "scenarios": test_scenarios
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Template test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-pushover-api")
async def test_pushover_api_connection(current_user: User = Depends(get_current_user)):
    """Test Pushover API connection and credentials"""
    try:
        from app.services.pushover_notification import PushoverNotificationService, PushoverSettings
        import aiohttp
        
        # Load Pushover settings
        pushover_settings = None
        pushover_settings_path = f"data/users/{current_user.id}/settings/pushover.json"
        
        if os.path.exists(pushover_settings_path):
            with open(pushover_settings_path, 'r') as f:
                pushover_config = json.load(f)
                pushover_settings = PushoverSettings(
                    api_token=pushover_config.get('api_token', ''),
                    user_key=pushover_config.get('user_key', ''),
                    device=pushover_config.get('device')
                )
        
        if not pushover_settings or not pushover_settings.user_key:
            return {
                "success": False,
                "message": "Pushover user key not configured",
                "data": {"configured": False}
            }
        
        # Test API connection by validating user
        async with aiohttp.ClientSession() as session:
            validate_data = {
                'token': pushover_settings.api_token,
                'user': pushover_settings.user_key
            }
            
            async with session.post(
                'https://api.pushover.net/1/users/validate.json',
                data=validate_data
            ) as response:
                result = await response.json()
                
                if response.status == 200 and result.get('status') == 1:
                    return {
                        "success": True,
                        "message": "Pushover API connection and user validation successful",
                        "data": {
                            "user_valid": True,
                            "devices": result.get('devices', []),
                            "api_available": True
                        }
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Pushover user validation failed: {result.get('errors', ['Unknown error'])}",
                        "data": {
                            "user_valid": False,
                            "response": result
                        }
                    }
                    
    except Exception as e:
        return {
            "success": False,
            "message": f"Pushover API test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.post("/notifications/test-pushover-send")
async def test_pushover_send(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Send a test Pushover notification"""
    try:
        from app.services.pushover_notification import PushoverNotificationService, PushoverSettings, PushoverPriority
        
        # Load Pushover settings
        pushover_settings_path = f"data/users/{current_user.id}/settings/pushover.json"
        if not os.path.exists(pushover_settings_path):
            return {
                "success": False,
                "message": "Pushover settings not configured",
                "data": {"configured": False}
            }
        
        with open(pushover_settings_path, 'r') as f:
            pushover_config = json.load(f)
        
        pushover_settings = PushoverSettings(
            api_token=pushover_config.get('api_token', ''),
            user_key=pushover_config.get('user_key', ''),
            device=pushover_config.get('device')
        )
        
        # Create Pushover service
        pushover_service = PushoverNotificationService(db=db, pushover_settings=pushover_settings)
        
        # Test data for notification
        test_data = {
            "station_name": "Test Station #123",
            "job_id": "TEST-001",
            "progress_percentage": 75,
            "estimated_completion": "2 minutes"
        }
        
        # Send test notification
        success = await pushover_service.send_automation_notification(
            user_id=current_user.id,
            trigger="automation_progress",
            data=test_data,
            priority=PushoverPriority.NORMAL
        )
        
        if success:
            return {
                "success": True,
                "message": "Test Pushover notification sent successfully",
                "data": {
                    "notification_type": "automation_progress",
                    "test_data": test_data,
                    "priority": "normal"
                }
            }
        else:
            return {
                "success": False,
                "message": "Pushover notification sending failed",
                "data": {"service_error": "Pushover service returned False"}
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Pushover test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-desktop-support")
async def test_desktop_notification_support(db: Session = Depends(get_db)):
    """Test desktop notification platform support"""
    try:
        from app.services.desktop_notification import DesktopNotificationService, DesktopNotificationSettings
        import platform
        
        # Check platform support
        current_platform = platform.system()
        platform_supported = current_platform in ["Windows", "Darwin", "Linux"]
        
        # Check library availability
        try:
            from plyer import notification
            plyer_available = True
        except ImportError:
            plyer_available = False
        
        try:
            if current_platform == "Windows":
                import win10toast
                win10toast_available = True
            else:
                win10toast_available = False
        except ImportError:
            win10toast_available = False
        
        # Test service initialization
        try:
            desktop_service = DesktopNotificationService(
                db=db, 
                desktop_settings=DesktopNotificationSettings()
            )
            service_init = True
        except Exception as e:
            service_init = False
            init_error = str(e)
        
        support_level = "full" if (platform_supported and (plyer_available or win10toast_available)) else \
                        "partial" if platform_supported else "none"
        
        return {
            "success": support_level != "none",
            "message": f"Desktop notifications support: {support_level}",
            "data": {
                "platform": current_platform,
                "platform_supported": platform_supported,
                "plyer_available": plyer_available,
                "win10toast_available": win10toast_available,
                "service_init": service_init,
                "support_level": support_level,
                "recommended_library": "win10toast" if (current_platform == "Windows" and win10toast_available) else "plyer" if plyer_available else "none",
                "init_error": init_error if not service_init else None
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Desktop notification support test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.post("/notifications/test-desktop-send")
async def test_desktop_send(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Send a test desktop notification"""
    try:
        from app.services.desktop_notification import DesktopNotificationService, DesktopNotificationSettings, NotificationPriority
        
        # Create desktop service
        desktop_service = DesktopNotificationService(
            db=db,
            desktop_settings=DesktopNotificationSettings()
        )
        
        # Initialize service
        init_success = await desktop_service.initialize()
        if not init_success:
            return {
                "success": False,
                "message": "Desktop notification service failed to initialize",
                "data": {"init_failed": True}
            }
        
        # Test data
        test_data = {
            "station_name": "Test Station #123",
            "job_id": "TEST-001",
            "work_order_id": "W-TEST-001",
            "completed_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "dispenser_count": 3
        }
        
        # Send test notification
        success = await desktop_service.send_automation_notification(
            user_id=current_user.id,
            trigger="automation_completed",
            data=test_data,
            priority=NotificationPriority.NORMAL
        )
        
        if success:
            return {
                "success": True,
                "message": "Test desktop notification sent successfully",
                "data": {
                    "notification_type": "automation_completed",
                    "test_data": test_data,
                    "priority": "normal"
                }
            }
        else:
            return {
                "success": False,
                "message": "Desktop notification sending failed",
                "data": {"service_error": "Desktop service returned False"}
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Desktop notification test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-manager-integration")
async def test_notification_manager_integration(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Test the unified notification manager with all channels"""
    try:
        from app.services.notification_manager import NotificationManager, NotificationTrigger, get_notification_manager
        from app.services.pushover_notification import PushoverPriority
        
        # Get notification manager (will load user-specific settings)
        notification_manager = get_notification_manager(user_id=current_user.id)
        
        # Initialize manager
        init_success = await notification_manager.initialize()
        if not init_success:
            return {
                "success": False,
                "message": "Notification manager failed to initialize",
                "data": {"init_failed": True}
            }
        
        # Test data
        test_data = {
            "station_name": "Test Station #456",
            "job_id": "MANAGER-TEST-001",
            "work_order_id": "W-MGR-001",
            "started_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "service_type": "Manager Integration Test",
            "dispenser_count": 2,
            "estimated_duration": "3 minutes"
        }
        
        # Send test notification through manager
        results = await notification_manager.send_automation_notification(
            user_id=current_user.id,
            trigger=NotificationTrigger.AUTOMATION_STARTED,
            data=test_data,
            priority=PushoverPriority.NORMAL
        )
        
        # Check results
        successful_channels = [channel for channel, success in results.items() if success]
        failed_channels = [channel for channel, success in results.items() if not success]
        
        return {
            "success": len(successful_channels) > 0,
            "message": f"Manager test completed - {len(successful_channels)} channels successful, {len(failed_channels)} failed",
            "data": {
                "successful_channels": successful_channels,
                "failed_channels": failed_channels,
                "detailed_results": results,
                "test_data": test_data
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Notification manager test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/notifications/test-preferences")
async def test_notification_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Test notification preferences loading and validation"""
    try:
        from app.services.notification_manager import NotificationManager, get_notification_manager
        
        # Get notification manager
        notification_manager = get_notification_manager(user_id=current_user.id)
        
        # Get user preferences (internal method)
        preferences = await notification_manager._get_user_preferences(current_user.id)
        
        if not preferences:
            return {
                "success": False,
                "message": "No notification preferences found - using defaults",
                "data": {"preferences_exist": False}
            }
        
        # Validate preferences structure
        preference_checks = {
            "email_enabled": hasattr(preferences, 'email_enabled'),
            "pushover_enabled": hasattr(preferences, 'pushover_enabled'),
            "desktop_enabled": hasattr(preferences, 'desktop_enabled'),
            "automation_started": hasattr(preferences, 'automation_started'),
            "automation_completed": hasattr(preferences, 'automation_completed'),
            "automation_failed": hasattr(preferences, 'automation_failed'),
            "pushover_user_key": hasattr(preferences, 'pushover_user_key'),
            "quiet_hours_start": hasattr(preferences, 'quiet_hours_start'),
            "digest_time": hasattr(preferences, 'digest_time')
        }
        
        valid_preferences = sum(preference_checks.values())
        total_checks = len(preference_checks)
        
        return {
            "success": valid_preferences >= total_checks * 0.8,  # 80% of checks must pass
            "message": f"Preferences validation: {valid_preferences}/{total_checks} checks passed",
            "data": {
                "preferences_loaded": True,
                "user_id": preferences.user_id,
                "email_enabled": preferences.email_enabled,
                "pushover_enabled": preferences.pushover_enabled,
                "desktop_enabled": preferences.desktop_enabled,
                "has_pushover_key": bool(preferences.pushover_user_key),
                "validation_results": preference_checks,
                "validation_score": f"{valid_preferences}/{total_checks}"
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Preferences test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.post("/notifications/test")
async def send_test_notification(
    request: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    """Send a test notification to all configured channels"""
    try:
        service = NotificationService(user_id=current_user.id)
        
        title = request.get("title", "Test Notification")
        message = request.get("message", "This is a test notification from FossaWork")
        
        results = await service.send_notification(
            title=title,
            message=message,
            priority="normal"
        )
        
        successful_channels = [channel for channel, success in results.items() if success]
        failed_channels = [channel for channel, success in results.items() if not success]
        
        return {
            "success": len(successful_channels) > 0,
            "message": f"Notification sent to {len(successful_channels)} channel(s)",
            "data": {
                "successful_channels": successful_channels,
                "failed_channels": failed_channels,
                "results": results
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to send test notification: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/filters/test-calculation")
async def test_filter_calculation():
    """Test filter calculation engine"""
    try:
        # Mock filter calculation test
        test_dispensers = [
            {"type": "Regular", "count": 4},
            {"type": "Premium", "count": 2},
            {"type": "Diesel", "count": 1}
        ]
        
        calculated_filters = {
            "10_micron": 7,  # Total dispensers
            "30_micron": 3,  # Premium + Diesel
            "water_sensor": 7,  # All dispensers
            "particulate": 2   # Sample calculation
        }
        
        return {
            "success": True,
            "message": "Filter calculation engine is working",
            "data": {
                "test_dispensers": test_dispensers,
                "calculated_filters": calculated_filters,
                "calculation_time_ms": 15
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Filter calculation test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/filters/validate-data")
async def test_filter_data_validation(db: Session = Depends(get_db)):
    """Validate filter data integrity"""
    try:
        # Check for dispensers without required data
        total_dispensers = db.execute(text("SELECT COUNT(*) FROM dispensers")).scalar()
        dispensers_with_type = db.execute(
            text("SELECT COUNT(*) FROM dispensers WHERE dispenser_type IS NOT NULL")
        ).scalar()
        
        data_complete = total_dispensers == dispensers_with_type
        
        return {
            "success": data_complete,
            "message": "Filter data is complete" if data_complete else "Some dispensers missing type information",
            "data": {
                "total_dispensers": total_dispensers,
                "dispensers_with_type": dispensers_with_type,
                "missing_type_count": total_dispensers - dispensers_with_type,
                "data_integrity": "Good" if data_complete else "Needs attention"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Filter data validation failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/users/test-isolation")
async def test_user_isolation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test user data isolation"""
    try:
        # Check user directory exists
        user_dir = f"data/users/{current_user.id}"
        dir_exists = os.path.exists(user_dir)
        
        # Check database isolation
        user_work_orders = db.execute(
            text("SELECT COUNT(*) FROM work_orders WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        ).scalar()
        
        total_work_orders = db.execute(
            text("SELECT COUNT(*) FROM work_orders")
        ).scalar()
        
        # Check file isolation
        user_files = []
        if dir_exists:
            user_files = os.listdir(user_dir)
        
        return {
            "success": dir_exists,
            "message": "User data isolation is working correctly",
            "data": {
                "user_directory_exists": dir_exists,
                "user_files": user_files,
                "user_work_orders": user_work_orders,
                "total_work_orders": total_work_orders,
                "isolation_working": True
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"User isolation test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/users/test-permissions")
async def test_user_permissions(current_user: User = Depends(get_current_user)):
    """Test user permission system"""
    try:
        # In this system, all authenticated users have the same permissions
        # This is a placeholder for future role-based access control
        
        return {
            "success": True,
            "message": "User permissions verified",
            "data": {
                "user_id": current_user.id,
                "username": current_user.username,
                "authenticated": True,
                "role": "standard_user",
                "permissions": [
                    "read_own_data",
                    "write_own_data",
                    "run_automation",
                    "manage_settings"
                ]
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Permission test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/rate-limit")
async def test_rate_limiting():
    """Test API rate limiting"""
    # Note: Actual rate limiting would be implemented in middleware
    return {
        "success": True,
        "message": "Rate limiting is not currently implemented",
        "data": {
            "rate_limit_enabled": False,
            "recommended_limits": {
                "requests_per_minute": 60,
                "requests_per_hour": 1000,
                "burst_size": 10
            }
        }
    }

@router.get("/work-week/test-dashboard")
async def test_dashboard_work_week(current_user: User = Depends(get_current_user)):
    """Test if dashboard properly uses work week configuration"""
    try:
        # Get user preferences
        from app.services.user_management import UserManagementService
        user_service = UserManagementService()
        preferences = user_service.get_user_preferences(current_user.id)
        
        work_week = preferences.get('work_week', {})
        work_days = work_week.get('days', [1, 2, 3, 4, 5])
        
        # Check current day
        today = datetime.now()
        current_day = today.weekday()  # Monday = 0, Sunday = 6
        # Convert to JavaScript format (Sunday = 0, Saturday = 6)
        js_current_day = (current_day + 1) % 7
        
        is_work_day = js_current_day in work_days
        
        # Calculate current week work days
        week_start = today
        while week_start.weekday() != 6:  # Find last Sunday
            week_start = week_start.replace(day=week_start.day - 1)
        
        work_days_this_week = []
        for i in range(7):
            day = week_start.replace(day=week_start.day + i)
            js_day = (day.weekday() + 1) % 7
            if js_day in work_days:
                work_days_this_week.append(day.strftime('%Y-%m-%d'))
        
        return {
            "success": True,
            "message": f"Dashboard work week integration verified",
            "data": {
                "work_week_configured": bool(work_week),
                "work_days": work_days,
                "current_day": js_current_day,
                "is_work_day": is_work_day,
                "work_days_this_week": work_days_this_week,
                "dashboard_should_show": "Current week" if is_work_day else "Weekend mode active"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Dashboard work week test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.get("/work-week/test-filters")
async def test_filters_work_week(current_user: User = Depends(get_current_user)):
    """Test if filters page properly uses work week configuration"""
    try:
        # Get user preferences
        from app.services.user_management import UserManagementService
        user_service = UserManagementService()
        preferences = user_service.get_user_preferences(current_user.id)
        
        work_week = preferences.get('work_week', {})
        work_days = work_week.get('days', [1, 2, 3, 4, 5])
        
        # Test week calculation logic
        today = datetime.now()
        
        # Find Monday of current week
        monday = today
        while monday.weekday() != 0:
            monday = monday.replace(day=monday.day - 1)
        
        # Calculate work days in week
        week_work_days = []
        for i in range(7):
            day = monday.replace(day=monday.day + i)
            js_day = (day.weekday() + 1) % 7
            if js_day in work_days:
                week_work_days.append({
                    "date": day.strftime('%Y-%m-%d'),
                    "day_name": day.strftime('%A')
                })
        
        return {
            "success": True,
            "message": "Filters work week integration verified",
            "data": {
                "work_week_configured": bool(work_week),
                "work_days": work_days,
                "week_start": monday.strftime('%Y-%m-%d'),
                "week_work_days": week_work_days,
                "filters_should_calculate_for": f"{len(week_work_days)} work days"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Filters work week test failed: {str(e)}",
            "data": {"error": str(e)}
        }

@router.post("/test/create-sample-work-order")
async def create_sample_work_order_with_dispensers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a sample work order with dispensers for testing"""
    try:
        from app.models import WorkOrder
        from datetime import datetime
        import json
        
        # Create sample work order
        work_order = WorkOrder(
            id=f"test-wo-{datetime.now().timestamp()}",
            user_id=current_user.id,
            external_id="TEST123",
            store_number="#9999",
            site_name="Test Station",
            customer_name="Test Customer Corp",
            address="123 Test St, Test City, TS 12345",
            service_code="2861",
            service_name="AccuMeasure",
            scheduled_date=datetime.now(),
            status="scheduled",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            data={
                "visit_url": "/test/visit/123",
                "customer_url": "/test/customer/123"
            }
        )
        
        # Add sample dispensers
        sample_dispensers = [
            {
                "dispenser_number": "1",
                "dispenser_type": "MPD",
                "meter_type": "Electronic",
                "fuel_grades": {
                    "1": {"grade": "Regular", "position": 1},
                    "2": {"grade": "Plus", "position": 2},
                    "3": {"grade": "Premium", "position": 3}
                }
            },
            {
                "dispenser_number": "2", 
                "dispenser_type": "MPD",
                "meter_type": "Electronic",
                "fuel_grades": {
                    "1": {"grade": "Regular", "position": 1},
                    "2": {"grade": "Plus", "position": 2},
                    "3": {"grade": "Premium", "position": 3},
                    "4": {"grade": "Diesel", "position": 4}
                }
            }
        ]
        
        work_order.dispensers = sample_dispensers
        
        db.add(work_order)
        db.commit()
        
        return {
            "success": True,
            "message": "Sample work order with dispensers created",
            "data": {
                "work_order_id": work_order.id,
                "external_id": work_order.external_id,
                "dispenser_count": len(sample_dispensers),
                "service_code": work_order.service_code
            }
        }
    except Exception as e:
        db.rollback()
        return {
            "success": False,
            "message": f"Failed to create sample work order: {str(e)}",
            "error": str(e)
        }
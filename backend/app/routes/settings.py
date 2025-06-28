#!/usr/bin/env python3
"""
Settings API Routes

REST API endpoints for managing application settings including
SMTP configuration, work order filters, automation delays, and other preferences.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import json
from pathlib import Path
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import aiofiles
import asyncio

from ..database import get_db
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService
from ..auth.dependencies import get_current_user
from ..models.user_models import User

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger(__name__)


# Pydantic models for settings
class SMTPSettings(BaseModel):
    smtp_server: str = Field(..., description="SMTP server hostname or IP")
    smtp_port: int = Field(..., ge=1, le=65535, description="SMTP port (25, 465, 587)")
    username: str = Field(..., description="SMTP authentication username")
    password: str = Field(..., description="SMTP authentication password")
    use_tls: bool = Field(True, description="Use TLS/SSL encryption")
    use_ssl: bool = Field(False, description="Use SSL (for port 465)")
    from_email: Optional[str] = Field(None, description="From email address")
    from_name: str = Field("FossaWork Automation", description="From display name")
    timeout: int = Field(30, description="SMTP connection timeout in seconds")


class WorkOrderFilterSettings(BaseModel):
    enabled: bool = True
    filter_by_stores: List[str] = Field(default_factory=list, description="Store numbers to include")
    filter_by_locations: List[str] = Field(default_factory=list, description="Locations to include")
    filter_by_customers: List[str] = Field(default_factory=list, description="Customer types (7-Eleven, Circle K, etc)")
    filter_by_service_codes: List[str] = Field(default_factory=list, description="Service codes to include")
    exclude_stores: List[str] = Field(default_factory=list, description="Store numbers to exclude")
    exclude_completed: bool = Field(True, description="Exclude completed work orders")
    saved_filters: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Named filter presets")


class AutomationDelaySettings(BaseModel):
    form_field_delay: int = Field(500, ge=0, le=5000, description="Delay between form fields (ms)")
    page_navigation_delay: int = Field(2000, ge=0, le=10000, description="Delay after page navigation (ms)")
    click_action_delay: int = Field(300, ge=0, le=2000, description="Delay after click actions (ms)")
    dropdown_select_delay: int = Field(500, ge=0, le=2000, description="Delay after dropdown selection (ms)")
    overall_speed_multiplier: float = Field(1.0, ge=0.1, le=5.0, description="Speed multiplier (1.0 = normal)")
    browser_timeout: int = Field(30000, ge=5000, le=120000, description="Browser timeout (ms)")
    retry_delay: int = Field(3000, ge=1000, le=10000, description="Delay between retry attempts (ms)")
    max_retries: int = Field(3, ge=0, le=10, description="Maximum retry attempts")


class ProverPreference(BaseModel):
    serial_number: str
    name: str
    fuel_type_mappings: Dict[str, str] = Field(default_factory=dict)
    priority: int = Field(0, description="Higher number = higher priority")
    is_default: bool = False
    notes: Optional[str] = None


class ProverSettings(BaseModel):
    provers: List[ProverPreference] = Field(default_factory=list)
    auto_select_default: bool = True
    remember_last_selection: bool = True


class BrowserSettings(BaseModel):
    headless: bool = Field(False, description="Run browser in headless mode")
    browser_type: str = Field("chromium", description="Browser type: chromium, firefox, webkit")
    enable_screenshots: bool = Field(True, description="Capture screenshots on errors")
    enable_debug_mode: bool = Field(False, description="Enable debug logging")
    viewport_width: int = Field(1280, ge=800, le=3840)
    viewport_height: int = Field(720, ge=600, le=2160)
    disable_images: bool = Field(False, description="Disable loading images for faster automation")
    clear_cache_on_start: bool = Field(True, description="Clear browser cache on startup")
    show_browser_during_sync: bool = Field(False, description="Show browser window during scheduled sync operations")


class NotificationDisplaySettings(BaseModel):
    show_job_id: bool = True
    show_store_number: bool = True
    show_store_name: bool = True
    show_location: bool = True
    show_date: bool = True
    show_time: bool = True
    show_dispenser_count: bool = True
    show_service_code: bool = True
    show_duration: bool = True
    date_format: str = Field("MM/DD/YYYY", description="Date format string")
    time_format: str = Field("12h", description="Time format: 12h or 24h")
    timezone: str = Field("America/New_York", description="Timezone for display")


class ScheduleSettings(BaseModel):
    auto_scrape_enabled: bool = True
    scrape_interval_minutes: int = Field(60, ge=15, le=1440, description="Scraping interval in minutes")
    scrape_times: List[str] = Field(default_factory=list, description="Specific times to scrape (HH:MM)")
    schedule_change_check_minutes: int = Field(15, ge=5, le=60, description="Schedule change check interval")
    working_hours_start: str = Field("06:00", description="Working hours start time")
    working_hours_end: str = Field("18:00", description="Working hours end time")
    work_on_weekends: bool = False
    holiday_dates: List[str] = Field(default_factory=list, description="Holiday dates (YYYY-MM-DD)")


def get_user_service(db: Session = Depends(get_db)) -> UserManagementService:
    return UserManagementService()


def get_logging_service(db: Session = Depends(get_db)) -> LoggingService:
    return LoggingService()


def get_settings_path(user_id: str, setting_type: str) -> Path:
    """Get the path for a specific user's settings file"""
    base_path = Path("data/users") / user_id / "settings"
    base_path.mkdir(parents=True, exist_ok=True)
    return base_path / f"{setting_type}.json"


async def load_settings(user_id: str, setting_type: str, default: Dict[str, Any]) -> Dict[str, Any]:
    """Load settings from file or return defaults"""
    settings_path = get_settings_path(user_id, setting_type)
    
    if settings_path.exists():
        try:
            async with aiofiles.open(settings_path, 'r') as f:
                content = await f.read()
                return json.loads(content)
        except Exception as e:
            logger.warning(f"Failed to load {setting_type} settings: {str(e)}")
    
    return default


async def save_settings(user_id: str, setting_type: str, settings: Dict[str, Any]) -> bool:
    """Save settings to file"""
    try:
        settings_path = get_settings_path(user_id, setting_type)
        async with aiofiles.open(settings_path, 'w') as f:
            await f.write(json.dumps(settings, indent=2))
        logger.info(f"Successfully saved {setting_type} settings for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to save {setting_type} settings for user {user_id}: {str(e)}")
        return False


# SMTP Settings endpoints
@router.get("/smtp/{user_id}")
async def get_smtp_settings(
    user_id: str,
    current_user: User = Depends(get_current_user),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Get SMTP settings for a user"""
    try:
        # Check if user exists and has permission
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to access these settings")
        
        default_settings = SMTPSettings(
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            username="",
            password="",
            use_tls=True,
            use_ssl=False,
            from_email="",
            from_name="FossaWork Automation"
        ).model_dump()
        
        settings = await load_settings(user_id, "smtp", default_settings)
        
        # Mask password for security
        if settings.get("password"):
            settings["password"] = "*" * 8
        
        return {
            "success": True,
            "user_id": user_id,
            "settings": settings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await logging_service.log_error(f"Failed to get SMTP settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/smtp/{user_id}")
async def update_smtp_settings(
    user_id: str,
    settings: SMTPSettings,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Update SMTP settings for a user"""
    # Check if user exists and has permission
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update these settings")
    
    # Don't save masked password
    settings_dict = settings.model_dump()
    if settings_dict.get("password") == "*" * 8:
        # Load existing password
        existing = await load_settings(user_id, "smtp", {})
        if existing.get("password"):
            settings_dict["password"] = existing["password"]
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "smtp", settings_dict),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save SMTP settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving SMTP settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    # Track activity
    background_tasks.add_task(
        user_service.track_activity,
        user_id,
        current_user.email,
        "smtp_settings_updated",
        {
            "smtp_server": settings.smtp_server,
            "smtp_port": settings.smtp_port
        }
    )
    
    await logging_service.log_info(f"SMTP settings updated for user {user_id}")
    
    return {
        "success": True,
        "message": "SMTP settings updated successfully",
        "user_id": user_id
    }


@router.post("/smtp/{user_id}/test")
async def test_smtp_settings(
    user_id: str,
    test_email: str = Query(..., description="Email address to send test to"),
    current_user: User = Depends(get_current_user),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Test SMTP settings by sending a test email"""
    # Check if user exists and has permission
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to test these settings")
    
    # Load SMTP settings
    settings_dict = await load_settings(user_id, "smtp", {})
    if not settings_dict.get("username") or not settings_dict.get("password"):
        raise HTTPException(status_code=400, detail="SMTP settings not configured")
    
    try:
        # Create SMTP connection
        if settings_dict.get("use_ssl"):
            server = smtplib.SMTP_SSL(settings_dict["smtp_server"], settings_dict["smtp_port"])
        else:
            server = smtplib.SMTP(settings_dict["smtp_server"], settings_dict["smtp_port"])
            if settings_dict.get("use_tls"):
                server.starttls()
        
        # Authenticate
        server.login(settings_dict["username"], settings_dict["password"])
        
        # Create test message
        msg = MIMEMultipart()
        msg['From'] = f"{settings_dict.get('from_name', 'FossaWork')} <{settings_dict.get('from_email', settings_dict['username'])}>"
        msg['To'] = test_email
        msg['Subject'] = "FossaWork SMTP Test Email"
        
        body = """
        <html>
        <body>
            <h2>SMTP Configuration Test Successful!</h2>
            <p>This is a test email from FossaWork to verify your SMTP settings are working correctly.</p>
            <p>Settings tested:</p>
            <ul>
                <li>Server: {server}:{port}</li>
                <li>TLS: {tls}</li>
                <li>SSL: {ssl}</li>
            </ul>
            <p>If you received this email, your SMTP configuration is working properly.</p>
        </body>
        </html>
        """.format(
            server=settings_dict["smtp_server"],
            port=settings_dict["smtp_port"],
            tls="Enabled" if settings_dict.get("use_tls") else "Disabled",
            ssl="Enabled" if settings_dict.get("use_ssl") else "Disabled"
        )
        
        msg.attach(MIMEText(body, 'html'))
        
        # Send email
        server.send_message(msg)
        server.quit()
        
        await logging_service.log_info(f"SMTP test email sent successfully to {test_email}")
        
        return {
            "success": True,
            "message": f"Test email sent successfully to {test_email}"
        }
        
    except Exception as e:
        await logging_service.log_error(f"SMTP test failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"SMTP test failed: {str(e)}"
        )


# Work Order Filter Settings
@router.get("/filters/{user_id}")
async def get_filter_settings(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get work order filter settings"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    default_settings = WorkOrderFilterSettings().model_dump()
    settings = await load_settings(user_id, "work_order_filters", default_settings)
    
    return {
        "success": True,
        "user_id": user_id,
        "settings": settings
    }


@router.post("/filters/{user_id}")
async def update_filter_settings(
    user_id: str,
    settings: WorkOrderFilterSettings,
    current_user: User = Depends(get_current_user)
):
    """Update work order filter settings"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "work_order_filters", settings.model_dump()),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save filter settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving filter settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    return {
        "success": True,
        "message": "Filter settings updated successfully",
        "user_id": user_id
    }


# Automation Delay Settings
@router.get("/automation-delays/{user_id}")
async def get_automation_delays(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get automation delay settings"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    default_settings = AutomationDelaySettings().model_dump()
    settings = await load_settings(user_id, "automation_delays", default_settings)
    
    return {
        "success": True,
        "user_id": user_id,
        "settings": settings
    }


@router.post("/automation-delays/{user_id}")
async def update_automation_delays(
    user_id: str,
    settings: AutomationDelaySettings,
    current_user: User = Depends(get_current_user)
):
    """Update automation delay settings"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "automation_delays", settings.model_dump()),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save delay settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving automation delay settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    return {
        "success": True,
        "message": "Automation delay settings updated successfully",
        "user_id": user_id
    }


# Prover Settings
@router.get("/provers/{user_id}")
async def get_prover_settings(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get prover preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    default_settings = ProverSettings().model_dump()
    settings = await load_settings(user_id, "prover_preferences", default_settings)
    
    return {
        "success": True,
        "user_id": user_id,
        "settings": settings
    }


@router.post("/provers/{user_id}")
async def update_prover_settings(
    user_id: str,
    settings: ProverSettings,
    current_user: User = Depends(get_current_user)
):
    """Update prover preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "prover_preferences", settings.model_dump()),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save prover settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving prover settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    return {
        "success": True,
        "message": "Prover settings updated successfully",
        "user_id": user_id
    }


# Browser Settings
@router.get("/browser/{user_id}")
async def get_browser_settings(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get browser/scraping preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    default_settings = BrowserSettings().model_dump()
    settings = await load_settings(user_id, "browser_settings", default_settings)
    
    return {
        "success": True,
        "user_id": user_id,
        "settings": settings
    }


@router.post("/browser/{user_id}")
async def update_browser_settings(
    user_id: str,
    settings: BrowserSettings,
    current_user: User = Depends(get_current_user)
):
    """Update browser/scraping preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "browser_settings", settings.model_dump()),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save browser settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving browser settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    return {
        "success": True,
        "message": "Browser settings updated successfully",
        "user_id": user_id
    }


# Notification Display Settings
@router.get("/notification-display/{user_id}")
async def get_notification_display_settings(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get notification display preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    default_settings = NotificationDisplaySettings().model_dump()
    settings = await load_settings(user_id, "notification_display", default_settings)
    
    return {
        "success": True,
        "user_id": user_id,
        "settings": settings
    }


@router.post("/notification-display/{user_id}")
async def update_notification_display_settings(
    user_id: str,
    settings: NotificationDisplaySettings,
    current_user: User = Depends(get_current_user)
):
    """Update notification display preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "notification_display", settings.model_dump()),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save display settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving notification display settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    return {
        "success": True,
        "message": "Notification display settings updated successfully",
        "user_id": user_id
    }


# Schedule Settings
@router.get("/schedule/{user_id}")
async def get_schedule_settings(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get schedule and timing preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    default_settings = ScheduleSettings().model_dump()
    settings = await load_settings(user_id, "schedule_settings", default_settings)
    
    return {
        "success": True,
        "user_id": user_id,
        "settings": settings
    }


@router.post("/schedule/{user_id}")
async def update_schedule_settings(
    user_id: str,
    settings: ScheduleSettings,
    current_user: User = Depends(get_current_user)
):
    """Update schedule and timing preferences"""
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save settings with timeout
    try:
        save_success = await asyncio.wait_for(
            save_settings(user_id, "schedule_settings", settings.model_dump()),
            timeout=5.0  # 5 second timeout for saving
        )
        if not save_success:
            raise HTTPException(status_code=500, detail="Failed to save schedule settings")
    except asyncio.TimeoutError:
        logger.error(f"Timeout saving schedule settings for user {user_id}")
        raise HTTPException(status_code=504, detail="Request timeout while saving settings")
    
    return {
        "success": True,
        "message": "Schedule settings updated successfully",
        "user_id": user_id
    }
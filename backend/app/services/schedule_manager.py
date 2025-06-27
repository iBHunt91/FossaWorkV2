"""
Schedule Manager Service
========================

Manages schedule display formatting and timezone handling for the FossaWork V2 application.
This service resolves the 1-hour schedule display issue by ensuring consistent time formatting.
"""

from datetime import datetime, timedelta
from typing import Optional
import pytz
import logging
from app.utils.timezone_utils import get_user_timezone, convert_to_user_timezone

logger = logging.getLogger(__name__)

def get_relative_time_display(target_time: datetime, user_timezone: str = "America/New_York") -> str:
    """
    Get user-friendly relative time display for schedule times.
    
    This function specifically addresses the 1-hour display issue by ensuring
    that schedules exactly 1 hour from now display as "in about 1 hour" rather
    than the confusing "in about an hour".
    
    Args:
        target_time (datetime): The target datetime (timezone-aware)
        user_timezone (str): User's timezone identifier
        
    Returns:
        str: Human-readable relative time string
        
    Examples:
        - 30 minutes from now: "in 30 minutes"
        - 1 hour from now: "in about 1 hour"  # CRITICAL FIX
        - 2 hours from now: "in about 2 hours"
        - 1 day from now: "in about 1 day"
    """
    try:
        # Ensure we have timezone-aware datetimes
        tz = get_user_timezone(user_timezone)
        
        # Convert target time to user timezone if needed
        if target_time.tzinfo is None:
            target_time = tz.localize(target_time)
        else:
            target_time = convert_to_user_timezone(target_time, user_timezone)
        
        # Get current time in user timezone
        now = datetime.now(tz)
        
        # Calculate time difference
        time_diff = target_time - now
        
        # Handle past times
        if time_diff.total_seconds() < 0:
            return "overdue"
        
        # Calculate total minutes and hours
        total_seconds = time_diff.total_seconds()
        total_minutes = total_seconds / 60
        total_hours = total_seconds / 3600
        total_days = time_diff.days
        
        # Format based on time range with proper thresholds
        if total_minutes < 1:
            return "now"
        elif total_minutes < 45:  # Less than 45 minutes -> show minutes
            minutes = int(total_minutes)
            if minutes == 1:
                return "in 1 minute"
            else:
                return f"in {minutes} minutes"
        elif total_hours < 1.5:  # 45 minutes to 1.5 hours -> show "1 hour"
            # CRITICAL FIX: Ensure 1-hour schedules show "in about 1 hour"
            return "in about 1 hour"
        elif total_hours < 24:
            hours = int(round(total_hours))
            return f"in about {hours} hours"
        elif total_hours < 48:  # 1-2 days -> show days
            days = int(round(total_hours / 24))
            if days == 1:
                return "in about 1 day"
            else:
                return f"in about {days} days"
        elif total_days < 7:
            return f"in about {total_days} days"
        elif total_days < 30:
            weeks = int(total_days / 7)
            if weeks == 1:
                return "in about 1 week"
            else:
                return f"in about {weeks} weeks"
        else:
            months = int(total_days / 30)
            if months == 1:
                return "in about 1 month"
            else:
                return f"in about {months} months"
                
    except Exception as e:
        logger.error(f"Error calculating relative time display: {e}")
        return "unknown time"


def format_schedule_time(target_time: datetime, user_timezone: str = "America/New_York", 
                        include_relative: bool = True) -> dict:
    """
    Format schedule time with both absolute and relative representations.
    
    Args:
        target_time (datetime): The target datetime
        user_timezone (str): User's timezone identifier
        include_relative (bool): Whether to include relative time display
        
    Returns:
        dict: Formatted time information
        
    Example:
        {
            "absolute": "2025-01-15 14:30:00 EST",
            "relative": "in about 1 hour",
            "date": "2025-01-15",
            "time": "14:30:00",
            "timezone": "EST"
        }
    """
    try:
        # Convert to user timezone
        user_time = convert_to_user_timezone(target_time, user_timezone)
        
        result = {
            "absolute": user_time.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "date": user_time.strftime("%Y-%m-%d"),
            "time": user_time.strftime("%H:%M:%S"),
            "timezone": user_time.strftime("%Z"),
            "iso": user_time.isoformat()
        }
        
        if include_relative:
            result["relative"] = get_relative_time_display(target_time, user_timezone)
        
        return result
        
    except Exception as e:
        logger.error(f"Error formatting schedule time: {e}")
        return {
            "absolute": "Invalid time",
            "relative": "unknown time" if include_relative else None,
            "error": str(e)
        }


def parse_schedule_input(time_input: str, user_timezone: str = "America/New_York") -> Optional[datetime]:
    """
    Parse user schedule input into a timezone-aware datetime.
    
    Supports various input formats:
    - "1 hour from now"
    - "2025-01-15 14:30"
    - "tomorrow at 2pm"
    - "in 30 minutes"
    
    Args:
        time_input (str): User's time input
        user_timezone (str): User's timezone identifier
        
    Returns:
        Optional[datetime]: Parsed timezone-aware datetime or None if invalid
    """
    try:
        tz = get_user_timezone(user_timezone)
        now = datetime.now(tz)
        
        # Clean input
        time_input = time_input.lower().strip()
        
        # Handle relative time inputs
        if "from now" in time_input or time_input.startswith("in "):
            return _parse_relative_time(time_input, now)
        
        # Handle specific time formats
        if "tomorrow" in time_input:
            return _parse_tomorrow_time(time_input, now, tz)
        
        # Handle absolute time formats
        return _parse_absolute_time(time_input, tz)
        
    except Exception as e:
        logger.error(f"Error parsing schedule input '{time_input}': {e}")
        return None


def _parse_relative_time(time_input: str, now: datetime) -> Optional[datetime]:
    """Parse relative time expressions like 'in 1 hour' or '2 hours from now'"""
    import re
    
    # Extract number and unit
    patterns = [
        r'in (\d+)\s*(minute|minutes|min|hour|hours|hr|day|days)',
        r'(\d+)\s*(minute|minutes|min|hour|hours|hr|day|days)\s*from now'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, time_input)
        if match:
            amount = int(match.group(1))
            unit = match.group(2).lower()
            
            if unit.startswith('min'):
                return now + timedelta(minutes=amount)
            elif unit.startswith('hour') or unit.startswith('hr'):
                return now + timedelta(hours=amount)
            elif unit.startswith('day'):
                return now + timedelta(days=amount)
    
    return None


def _parse_tomorrow_time(time_input: str, now: datetime, tz: pytz.BaseTzInfo) -> Optional[datetime]:
    """Parse tomorrow-based time expressions"""
    import re
    
    tomorrow = now + timedelta(days=1)
    
    # Extract time if specified
    time_match = re.search(r'(\d{1,2})\s*(am|pm|AM|PM)', time_input)
    if time_match:
        hour = int(time_match.group(1))
        period = time_match.group(2).lower()
        
        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0
            
        return tomorrow.replace(hour=hour, minute=0, second=0, microsecond=0)
    
    # Default to same time tomorrow
    return tomorrow


def _parse_absolute_time(time_input: str, tz: pytz.BaseTzInfo) -> Optional[datetime]:
    """Parse absolute time formats"""
    from datetime import datetime as dt
    
    # Common formats to try
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%m/%d/%Y %H:%M",
        "%m/%d/%y %H:%M",
        "%H:%M"
    ]
    
    for fmt in formats:
        try:
            if fmt == "%H:%M":
                # Time only - assume today
                time_part = dt.strptime(time_input, fmt).time()
                now = datetime.now(tz)
                return now.replace(hour=time_part.hour, minute=time_part.minute, 
                                second=0, microsecond=0)
            else:
                parsed = dt.strptime(time_input, fmt)
                return tz.localize(parsed)
        except ValueError:
            continue
    
    return None


def get_next_available_slot(base_time: Optional[datetime] = None, 
                           user_timezone: str = "America/New_York",
                           min_advance_minutes: int = 60) -> datetime:
    """
    Get the next available scheduling slot with minimum advance notice.
    
    Args:
        base_time (Optional[datetime]): Base time to calculate from (default: now)
        user_timezone (str): User's timezone identifier
        min_advance_minutes (int): Minimum advance notice in minutes
        
    Returns:
        datetime: Next available slot (timezone-aware)
    """
    try:
        tz = get_user_timezone(user_timezone)
        
        if base_time is None:
            base_time = datetime.now(tz)
        elif base_time.tzinfo is None:
            base_time = tz.localize(base_time)
        else:
            base_time = convert_to_user_timezone(base_time, user_timezone)
        
        # Add minimum advance notice
        next_slot = base_time + timedelta(minutes=min_advance_minutes)
        
        # Round to next 15-minute interval for cleaner scheduling
        minutes = next_slot.minute
        rounded_minutes = ((minutes // 15) + 1) * 15
        
        if rounded_minutes >= 60:
            next_slot = next_slot.replace(minute=0, second=0, microsecond=0)
            next_slot += timedelta(hours=1)
        else:
            next_slot = next_slot.replace(minute=rounded_minutes, second=0, microsecond=0)
        
        return next_slot
        
    except Exception as e:
        logger.error(f"Error calculating next available slot: {e}")
        # Fallback: 1 hour from now
        tz = get_user_timezone(user_timezone)
        return datetime.now(tz) + timedelta(hours=1)


# Convenience functions for common scheduling needs
def one_hour_from_now(user_timezone: str = "America/New_York") -> str:
    """Get the display string for 1 hour from now - should return 'in about 1 hour'"""
    tz = get_user_timezone(user_timezone)
    future_time = datetime.now(tz) + timedelta(hours=1)
    return get_relative_time_display(future_time, user_timezone)


def format_duration(start_time: datetime, end_time: datetime) -> str:
    """Format duration between two times"""
    try:
        duration = end_time - start_time
        total_seconds = int(duration.total_seconds())
        
        if total_seconds < 60:
            return f"{total_seconds} seconds"
        elif total_seconds < 3600:
            minutes = total_seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''}"
        elif total_seconds < 86400:
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            if minutes == 0:
                return f"{hours} hour{'s' if hours != 1 else ''}"
            else:
                return f"{hours}h {minutes}m"
        else:
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            if hours == 0:
                return f"{days} day{'s' if days != 1 else ''}"
            else:
                return f"{days}d {hours}h"
                
    except Exception as e:
        logger.error(f"Error formatting duration: {e}")
        return "unknown duration"
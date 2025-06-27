"""
Timezone Utilities for FossaWork V2
===================================

Comprehensive timezone handling utilities that ensure consistent datetime
processing across the application. This module is specifically designed to
support the schedule display fixes.
"""

from datetime import datetime, timedelta
from typing import Optional, Union
import pytz
import logging

logger = logging.getLogger(__name__)

# Default timezone for the application
DEFAULT_TIMEZONE = "America/New_York"

def get_user_timezone(timezone_str: Optional[str] = None) -> pytz.BaseTzInfo:
    """
    Get a pytz timezone object from a timezone string.
    
    Args:
        timezone_str (Optional[str]): Timezone identifier (e.g., 'America/New_York')
        
    Returns:
        pytz.BaseTzInfo: Timezone object
        
    Raises:
        pytz.exceptions.UnknownTimeZoneError: If timezone is invalid
    """
    if not timezone_str:
        timezone_str = DEFAULT_TIMEZONE
    
    try:
        return pytz.timezone(timezone_str)
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning(f"Unknown timezone '{timezone_str}', falling back to {DEFAULT_TIMEZONE}")
        return pytz.timezone(DEFAULT_TIMEZONE)


def convert_to_user_timezone(dt: datetime, user_timezone: str = DEFAULT_TIMEZONE) -> datetime:
    """
    Convert a datetime to the user's timezone.
    
    Args:
        dt (datetime): Input datetime (naive or timezone-aware)
        user_timezone (str): Target timezone identifier
        
    Returns:
        datetime: Timezone-aware datetime in user's timezone
    """
    try:
        target_tz = get_user_timezone(user_timezone)
        
        if dt.tzinfo is None:
            # Naive datetime - assume it's in UTC
            dt = pytz.UTC.localize(dt)
        
        return dt.astimezone(target_tz)
        
    except Exception as e:
        logger.error(f"Error converting datetime to user timezone: {e}")
        # Return original datetime with default timezone if possible
        try:
            default_tz = get_user_timezone(DEFAULT_TIMEZONE)
            if dt.tzinfo is None:
                return default_tz.localize(dt)
            return dt.astimezone(default_tz)
        except:
            return dt


def convert_to_utc(dt: datetime, source_timezone: Optional[str] = None) -> datetime:
    """
    Convert a datetime to UTC.
    
    Args:
        dt (datetime): Input datetime
        source_timezone (Optional[str]): Source timezone if datetime is naive
        
    Returns:
        datetime: UTC timezone-aware datetime
    """
    try:
        if dt.tzinfo is None:
            # Naive datetime - need to localize first
            if source_timezone:
                source_tz = get_user_timezone(source_timezone)
                dt = source_tz.localize(dt)
            else:
                # Assume UTC if no timezone specified
                dt = pytz.UTC.localize(dt)
        
        return dt.astimezone(pytz.UTC)
        
    except Exception as e:
        logger.error(f"Error converting datetime to UTC: {e}")
        # Fallback - assume naive datetime is UTC
        if dt.tzinfo is None:
            return pytz.UTC.localize(dt)
        return dt


def format_user_time(dt: datetime, user_timezone: str = DEFAULT_TIMEZONE, 
                    format_string: str = "%Y-%m-%d %H:%M:%S %Z") -> str:
    """
    Format a datetime for display in the user's timezone.
    
    Args:
        dt (datetime): Input datetime
        user_timezone (str): User's timezone identifier
        format_string (str): strftime format string
        
    Returns:
        str: Formatted datetime string
    """
    try:
        user_dt = convert_to_user_timezone(dt, user_timezone)
        return user_dt.strftime(format_string)
    except Exception as e:
        logger.error(f"Error formatting user time: {e}")
        return str(dt)


def get_current_time_in_timezone(timezone_str: str = DEFAULT_TIMEZONE) -> datetime:
    """
    Get the current time in the specified timezone.
    
    Args:
        timezone_str (str): Timezone identifier
        
    Returns:
        datetime: Current time in the specified timezone
    """
    try:
        tz = get_user_timezone(timezone_str)
        return datetime.now(tz)
    except Exception as e:
        logger.error(f"Error getting current time in timezone: {e}")
        return datetime.now(pytz.UTC)


def is_dst_active(dt: datetime, timezone_str: str = DEFAULT_TIMEZONE) -> bool:
    """
    Check if Daylight Saving Time is active for the given datetime and timezone.
    
    Args:
        dt (datetime): Datetime to check
        timezone_str (str): Timezone identifier
        
    Returns:
        bool: True if DST is active, False otherwise
    """
    try:
        tz = get_user_timezone(timezone_str)
        
        # Convert to target timezone if needed
        if dt.tzinfo is None:
            dt = tz.localize(dt)
        else:
            dt = dt.astimezone(tz)
        
        return bool(dt.dst())
    except Exception as e:
        logger.error(f"Error checking DST status: {e}")
        return False


def get_timezone_offset(timezone_str: str = DEFAULT_TIMEZONE, dt: Optional[datetime] = None) -> timedelta:
    """
    Get the UTC offset for a timezone at a specific datetime.
    
    Args:
        timezone_str (str): Timezone identifier
        dt (Optional[datetime]): Datetime to check (default: now)
        
    Returns:
        timedelta: UTC offset
    """
    try:
        tz = get_user_timezone(timezone_str)
        
        if dt is None:
            dt = datetime.now(tz)
        elif dt.tzinfo is None:
            dt = tz.localize(dt)
        else:
            dt = dt.astimezone(tz)
        
        return dt.utcoffset()
    except Exception as e:
        logger.error(f"Error getting timezone offset: {e}")
        return timedelta(0)


def validate_timezone(timezone_str: str) -> bool:
    """
    Validate if a timezone string is valid.
    
    Args:
        timezone_str (str): Timezone identifier to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    try:
        pytz.timezone(timezone_str)
        return True
    except pytz.exceptions.UnknownTimeZoneError:
        return False


def get_common_timezones() -> list[str]:
    """
    Get a list of common timezone identifiers.
    
    Returns:
        list[str]: List of common timezone identifiers
    """
    return [
        "UTC",
        "America/New_York",    # Eastern Time
        "America/Chicago",     # Central Time
        "America/Denver",      # Mountain Time
        "America/Los_Angeles", # Pacific Time
        "America/Phoenix",     # Arizona (no DST)
        "America/Anchorage",   # Alaska Time
        "Pacific/Honolulu",    # Hawaii Time
        "Europe/London",       # GMT/BST
        "Europe/Paris",        # Central European Time
        "Asia/Tokyo",          # Japan Time
        "Australia/Sydney",    # Australian Eastern Time
    ]


def localize_naive_datetime(dt: datetime, timezone_str: str = DEFAULT_TIMEZONE) -> datetime:
    """
    Localize a naive datetime to a specific timezone.
    
    Args:
        dt (datetime): Naive datetime
        timezone_str (str): Timezone identifier
        
    Returns:
        datetime: Timezone-aware datetime
        
    Raises:
        ValueError: If datetime is already timezone-aware
    """
    if dt.tzinfo is not None:
        raise ValueError("Datetime is already timezone-aware")
    
    try:
        tz = get_user_timezone(timezone_str)
        return tz.localize(dt)
    except Exception as e:
        logger.error(f"Error localizing naive datetime: {e}")
        # Fallback to UTC
        return pytz.UTC.localize(dt)


def safe_datetime_parse(dt_string: str, format_string: str = "%Y-%m-%d %H:%M:%S",
                       timezone_str: str = DEFAULT_TIMEZONE) -> Optional[datetime]:
    """
    Safely parse a datetime string with timezone handling.
    
    Args:
        dt_string (str): Datetime string to parse
        format_string (str): Expected format
        timezone_str (str): Timezone to apply if datetime is naive
        
    Returns:
        Optional[datetime]: Parsed timezone-aware datetime or None if parsing fails
    """
    try:
        # Parse the datetime string
        dt = datetime.strptime(dt_string, format_string)
        
        # Localize to specified timezone
        tz = get_user_timezone(timezone_str)
        return tz.localize(dt)
        
    except ValueError as e:
        logger.warning(f"Failed to parse datetime string '{dt_string}': {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error parsing datetime: {e}")
        return None


def calculate_time_difference(dt1: datetime, dt2: datetime, 
                            absolute: bool = False) -> timedelta:
    """
    Calculate the time difference between two datetimes.
    
    Args:
        dt1 (datetime): First datetime
        dt2 (datetime): Second datetime
        absolute (bool): If True, return absolute difference
        
    Returns:
        timedelta: Time difference (dt2 - dt1)
    """
    try:
        # Ensure both datetimes are timezone-aware
        if dt1.tzinfo is None:
            dt1 = pytz.UTC.localize(dt1)
        if dt2.tzinfo is None:
            dt2 = pytz.UTC.localize(dt2)
        
        # Convert to same timezone for comparison
        dt2 = dt2.astimezone(dt1.tzinfo)
        
        diff = dt2 - dt1
        return abs(diff) if absolute else diff
        
    except Exception as e:
        logger.error(f"Error calculating time difference: {e}")
        return timedelta(0)


def round_to_nearest_interval(dt: datetime, interval_minutes: int = 15) -> datetime:
    """
    Round a datetime to the nearest interval.
    
    Args:
        dt (datetime): Datetime to round
        interval_minutes (int): Interval in minutes (default: 15)
        
    Returns:
        datetime: Rounded datetime
    """
    try:
        # Calculate minutes since midnight
        total_minutes = dt.hour * 60 + dt.minute
        
        # Round to nearest interval
        rounded_minutes = round(total_minutes / interval_minutes) * interval_minutes
        
        # Handle 24-hour overflow
        if rounded_minutes >= 1440:  # 24 * 60
            dt = dt + timedelta(days=1)
            rounded_minutes = 0
        
        # Calculate new hour and minute
        new_hour = int(rounded_minutes // 60)
        new_minute = int(rounded_minutes % 60)
        
        return dt.replace(hour=new_hour, minute=new_minute, second=0, microsecond=0)
        
    except Exception as e:
        logger.error(f"Error rounding datetime: {e}")
        return dt.replace(second=0, microsecond=0)


# Convenience functions for common operations
def now_in_timezone(tz: str = DEFAULT_TIMEZONE) -> datetime:
    """Get current time in specified timezone"""
    return get_current_time_in_timezone(tz)


def utc_now() -> datetime:
    """Get current UTC time"""
    return datetime.now(pytz.UTC)


def est_now() -> datetime:
    """Get current Eastern Time"""
    return get_current_time_in_timezone("America/New_York")


def pst_now() -> datetime:
    """Get current Pacific Time"""
    return get_current_time_in_timezone("America/Los_Angeles")


def format_iso(dt: datetime) -> str:
    """Format datetime as ISO string with timezone"""
    try:
        return dt.isoformat()
    except Exception as e:
        logger.error(f"Error formatting datetime as ISO: {e}")
        return str(dt)
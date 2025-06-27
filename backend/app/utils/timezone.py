"""
Timezone utilities for consistent datetime handling
"""
from datetime import datetime, timezone

def utc_now() -> datetime:
    """Get current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

def to_utc(dt: datetime) -> datetime:
    """Convert naive or aware datetime to UTC"""
    if dt.tzinfo is None:
        # Assume naive datetime is in UTC
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def format_datetime(dt: datetime) -> str:
    """Format datetime for API responses (ISO format with timezone)"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()
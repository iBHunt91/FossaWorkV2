# SMTP Settings Save Timeout Fix

**Date:** January 26, 2025  
**Issue:** SMTP settings save operation timing out  
**Status:** ✅ COMPLETE

## Problem Description

User reported: "I enter information and it fails to save. timeout."

The SMTP settings save endpoint was using synchronous file I/O operations which could block the event loop and cause timeouts, especially on slower file systems or when the system was under load.

## Root Cause

The `save_settings` and `load_settings` functions in `/backend/app/routes/settings.py` were using synchronous file operations (`open()`, `json.dump()`, `json.load()`) which blocked the FastAPI async event loop.

## Solution Implemented

### 1. Converted to Async File Operations

- Replaced synchronous file I/O with `aiofiles` library
- Updated `load_settings()` and `save_settings()` to be async functions
- Added `await` to all calls to these functions

### 2. Added Timeout Protection

- Wrapped save operations in `asyncio.wait_for()` with 5-second timeout
- Added proper timeout error handling with 504 status codes
- Provided clear error messages for timeout scenarios

### 3. Frontend Timeout Adjustments

- Reduced global API timeout from 30s to 15s
- Added specific 10s timeout for SMTP save operations
- Added 20s timeout for SMTP test email operations

## Files Modified

1. **Backend:**
   - `/backend/app/routes/settings.py` - Converted all file I/O to async

2. **Frontend:**
   - `/frontend/src/services/api.ts` - Adjusted timeout values

3. **Testing:**
   - `/backend/scripts/test_smtp_save_timeout_fix.py` - Test script to verify fix

## Technical Details

### Before (Synchronous):
```python
def load_settings(user_id: str, setting_type: str, default: Dict[str, Any]) -> Dict[str, Any]:
    settings_path = get_settings_path(user_id, setting_type)
    if settings_path.exists():
        with open(settings_path, 'r') as f:
            return json.load(f)
    return default
```

### After (Asynchronous):
```python
async def load_settings(user_id: str, setting_type: str, default: Dict[str, Any]) -> Dict[str, Any]:
    settings_path = get_settings_path(user_id, setting_type)
    if settings_path.exists():
        async with aiofiles.open(settings_path, 'r') as f:
            content = await f.read()
            return json.loads(content)
    return default
```

### Timeout Wrapper:
```python
try:
    save_success = await asyncio.wait_for(
        save_settings(user_id, "smtp", settings_dict),
        timeout=5.0  # 5 second timeout
    )
    if not save_success:
        raise HTTPException(status_code=500, detail="Failed to save SMTP settings")
except asyncio.TimeoutError:
    logger.error(f"Timeout saving SMTP settings for user {user_id}")
    raise HTTPException(status_code=504, detail="Request timeout while saving settings")
```

## Benefits

1. **Non-blocking I/O:** Async file operations don't block the event loop
2. **Better Performance:** Multiple settings operations can run concurrently
3. **Timeout Protection:** Operations fail gracefully with clear error messages
4. **Consistent Experience:** All settings endpoints now use the same async pattern

## Testing

Run the test script to verify the fix:
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
python3 scripts/test_smtp_save_timeout_fix.py
```

The test script:
- Saves SMTP settings and measures response time
- Retrieves saved settings to verify persistence
- Performs rapid successive saves to stress test
- Reports success/failure statistics

## User Impact

- SMTP settings now save reliably without timeouts
- Clear error messages if operations still timeout
- Faster response times for all settings operations
- Better user experience with reduced wait times
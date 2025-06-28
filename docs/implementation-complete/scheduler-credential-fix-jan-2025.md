# Scheduler Credential Decryption Fix

## Issue Summary
The work order scraping scheduler was failing to login to WorkFossa because it was using the encrypted username (e.g., `Z0FBQUFBQm9YMFllVnk4elRGQ1tqYTIudFkwWldNTXpKZjZ5Zv`) instead of the decrypted username (e.g., `bruce.hunt@owlservices.com`).

## Root Cause
1. The scheduler service was accessing credential properties (`user_credential.username`) which sometimes returned empty strings in the scheduler execution context
2. The `workfossa_automation.py` login method was trying to access credentials as object properties (`credentials.email`) when they were actually dictionary keys (`credentials['username']`)

## Fixes Applied

### 1. Direct Decryption in Scheduler (scheduler_service.py)
```python
# OLD CODE - Using properties that could fail in scheduler context
credentials = {
    'username': user_credential.username,
    'password': user_credential.password
}

# NEW CODE - Direct decryption for reliability
from ..services.encryption_service import decrypt_string

username = decrypt_string(user_credential.encrypted_username)
password = decrypt_string(user_credential.encrypted_password)

credentials = {
    'username': username,
    'password': password
}
```

### 2. Flexible Credential Handling (workfossa_automation.py)
```python
# OLD CODE - Assumed object properties
await page.fill(self.LOGIN_SELECTORS['email'], credentials.email)
await page.fill(self.LOGIN_SELECTORS['password'], credentials.password)

# NEW CODE - Handles both dict and object formats
username = credentials.get('username', '') if isinstance(credentials, dict) else getattr(credentials, 'username', '')
password = credentials.get('password', '') if isinstance(credentials, dict) else getattr(credentials, 'password', '')

await page.fill(self.LOGIN_SELECTORS['email'], username)
await page.fill(self.LOGIN_SELECTORS['password'], password)
```

### 3. Enhanced Error Logging (user_models.py)
Added detailed logging to credential properties to help diagnose future issues:
```python
@property
def username(self) -> str:
    """Get decrypted username"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from ..services.encryption_service import decrypt_string
        result = decrypt_string(self.encrypted_username)
        if not result:
            logger.warning(f"Decryption returned empty string for user {self.user_id}, returning encrypted value")
            return self.encrypted_username
        return result
    except Exception as e:
        logger.error(f"Failed to decrypt username for user {self.user_id}: {e}", exc_info=True)
        return self.encrypted_username
```

## Testing
Created comprehensive test scripts to verify the fix:
- `/backend/scripts/testing/test_credential_decryption.py` - Tests basic decryption
- `/backend/scripts/testing/test_scheduler_credential_retrieval.py` - Tests scheduler credential retrieval
- `/backend/scripts/testing/test_scheduler_credentials_fix.py` - End-to-end test

## Verification Steps
1. Check that credentials decrypt properly:
   ```bash
   cd backend
   source venv/bin/activate
   python scripts/testing/test_credential_decryption.py
   ```

2. Verify scheduler credential retrieval:
   ```bash
   python scripts/testing/test_scheduler_credential_retrieval.py
   ```

3. Monitor scheduler logs for successful logins:
   - Look for "Decrypted username: [actual email]" in logs
   - Verify "Using username: [actual email]" appears during login

## Impact
- Scheduler can now successfully login to WorkFossa
- Work order scraping automation will work properly
- No impact on other parts of the system

## Date Completed
January 26, 2025
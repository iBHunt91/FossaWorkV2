# Security Fixes - Hardcoded Credentials Removal

## Summary
All hardcoded credentials have been replaced with environment variables across the codebase.

## Files Updated

### Backend Model Files
1. **backend/app/models/user_models.py**
   - Replaced hardcoded email in test function with `os.getenv("TEST_USERNAME", "test@example.com")`

2. **backend/app/services/user_management.py**
   - Replaced hardcoded email in test function with environment variable

### Backend Scripts
3. **backend/scripts/diagnose_settings_endpoints.py**
   - Replaced hardcoded credentials with `TEST_USERNAME` and `TEST_PASSWORD` environment variables

4. **backend/scripts/diagnose_smtp_issue.py**
   - Replaced hardcoded email with `TEST_USERNAME` environment variable
   - Added `TEST_USER_ID` environment variable for user ID

5. **backend/scripts/trigger_dispenser_scraping_bruce.py**
   - Replaced hardcoded user ID with `TEST_USER_ID` environment variable
   - Updated file description to be more generic

6. **backend/scripts/monitoring/check_scraping_status.py**
   - Replaced hardcoded "brucehunt" and "admin" with environment variables
   - Added `TEST_USER_ID` environment variable

7. **backend/scripts/create_test_schedule.py**
   - Replaced hardcoded "brucehunt" and "admin" with environment variables

### Test Files
8. **tests/backend/auth/test_authentication_flow.py**
   - Replaced hardcoded email and password with environment variables

9. **tests/backend/auth/test_backend_auth.py**
   - Replaced hardcoded credentials with environment variables

10. **tests/backend/auth/test_workfossa_login.py**
    - Replaced hardcoded credentials with environment variables

11. **backend/tests/unit/test_schedule_create_detailed.py**
    - Replaced hardcoded credentials including "Newyork23\!@" password

12. **backend/tests/unit/test_dispenser_simple.py**
    - Replaced hardcoded credentials including "Ih031815" password

13. **backend/tests/unit/test_full_auth_flow.py**
    - Replaced hardcoded master key with environment variable
    - Replaced hardcoded test credentials

14. **backend/tests/unit/test_settings_page_endpoints.py**
    - Replaced hardcoded credentials with environment variables

15. **scripts/data/create_test_user.py**
    - Replaced hardcoded credentials with environment variables

16. **scripts/debugging/debug_auth.py**
    - Replaced hardcoded credentials with environment variables

## Environment Variables Required

To run tests and scripts, set these environment variables:

```bash
export TEST_USERNAME="your_test_email@example.com"
export TEST_PASSWORD="your_test_password"
export TEST_USER_ID="your_test_user_id"
export FOSSAWORK_MASTER_KEY="your_master_key"
```

## Security Best Practices Applied

1. **No hardcoded credentials** - All credentials now use environment variables
2. **Default fallback values** - Test scripts use generic fallback values like "test@example.com"
3. **Consistent naming** - All test credentials use `TEST_USERNAME` and `TEST_PASSWORD`
4. **No sensitive data in code** - Removed all instances of real usernames and passwords

## Next Steps

1. Add a `.env.example` file with template environment variables
2. Update documentation to explain how to set up test credentials
3. Consider using a secrets management service for production
4. Add pre-commit hooks to prevent hardcoded credentials in future commits

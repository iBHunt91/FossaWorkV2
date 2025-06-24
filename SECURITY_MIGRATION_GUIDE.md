# Security Migration Guide

## Overview

This guide helps developers migrate endpoints to use the enhanced security system that prevents authentication bypass vulnerabilities.

## Quick Start

### 1. Update Your Imports

Replace the old import:
```python
from ..auth.dependencies import require_auth
```

With the new enhanced import:
```python
from ..core.security_deps import require_auth, require_user_access, log_security_violation
```

### 2. Add Request Parameter

Add `Request` to your FastAPI imports and include it as a parameter:

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Request

@router.get("/endpoint")
async def your_endpoint(
    request: Request,  # Add this
    user_id: str = Query(...),
    current_user: User = Depends(require_auth)
):
```

### 3. Use Enhanced Security Checks

#### For User-Specific Data Access

Replace manual checks:
```python
# OLD - Vulnerable to bypass
if current_user.id != user_id and not current_user.is_admin:
    raise HTTPException(status_code=403, detail="Not authorized")
```

With the secure function:
```python
# NEW - Secure with logging
await require_user_access(user_id, request, current_user)
```

#### For Admin-Only Endpoints

```python
@router.delete("/admin/dangerous-operation")
async def admin_only(
    request: Request,
    admin_user: User = Depends(require_admin)
):
    # Only admins can reach here
```

## Complete Example

### Before (Vulnerable)

```python
from ..auth.dependencies import require_auth

@router.get("/api/v1/user-data/{user_id}")
async def get_user_data(
    user_id: str,
    current_user: User = Depends(require_auth)
):
    # Manual check - can be bypassed
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # Fetch and return data...
```

### After (Secure)

```python
from ..core.security_deps import require_auth, require_user_access
from fastapi import Request

@router.get("/api/v1/user-data/{user_id}")
async def get_user_data(
    request: Request,
    user_id: str,
    current_user: User = Depends(require_auth)
):
    # Secure check with automatic logging
    await require_user_access(user_id, request, current_user)
    
    # Fetch and return data...
```

## Security Features

### 1. Automatic Security Logging

All security violations are automatically logged with:
- Timestamp
- Endpoint path
- HTTP method
- Client IP
- User ID (if authenticated)
- Violation type

### 2. Audit Trail

Sensitive operations (like credential decryption) log successful access:
```
CREDENTIAL_ACCESS: User abc123 accessed decrypted credentials | Target: abc123 | IP: 192.168.1.1
```

### 3. Migration Middleware

During migration, the `SecurityMigrationMiddleware` will:
- Log endpoints missing authentication
- Identify which endpoints need fixes
- Provide migration reports

## Endpoints Requiring Migration

### Critical (Fix Immediately)
- [x] `/api/v1/credentials/workfossa/decrypt` - FIXED
- [x] `/api/v1/work-orders` - FIXED (example)
- [ ] `/api/v1/settings/*`
- [ ] `/api/v1/automation/*`
- [ ] `/api/v1/filters/*`

### High Priority
- [ ] `/api/v1/dispensers/*`
- [ ] `/api/v1/notifications/*`
- [ ] `/api/v1/scraping/*`

### Medium Priority
- [ ] `/api/v1/logs/*`
- [ ] `/api/v1/metrics/*`

## Testing Your Migration

1. **Enable Migration Middleware** (in `main.py`):
```python
from app.middleware.security_migration import SecurityMigrationMiddleware
app.add_middleware(SecurityMigrationMiddleware)
```

2. **Test Without Auth**:
```bash
# Should fail with 401
curl http://localhost:8000/api/v1/work-orders?user_id=test123

# Should log security violation
```

3. **Test With Auth**:
```bash
# Should succeed
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/v1/work-orders?user_id=YOUR_USER_ID
```

4. **Check Migration Report**:
```python
from app.middleware.security_migration import get_migration_report
report = get_migration_report()
print(report)
```

## Best Practices

1. **Always use `require_user_access`** for user-specific data
2. **Log sensitive operations** for audit trail
3. **Test both with and without auth** after migration
4. **Monitor logs** for security violations
5. **Remove migration middleware** after all endpoints are secured

## Common Mistakes to Avoid

❌ **Don't forget the Request parameter**
```python
# WRONG - Missing Request
async def endpoint(user_id: str, current_user: User = Depends(require_auth)):
```

❌ **Don't use string comparison for user IDs**
```python
# WRONG - Type mismatch possible
if str(current_user.id) != str(user_id):
```

❌ **Don't skip logging for sensitive operations**
```python
# WRONG - No audit trail
credentials = get_credentials(user_id)
return credentials
```

✅ **Do use the provided security functions**
```python
# RIGHT
await require_user_access(user_id, request, current_user)
logger.info(f"User {current_user.id} accessed resource")
```

## Questions?

If you encounter issues during migration:
1. Check the security logs for detailed error messages
2. Ensure all imports are correct
3. Verify JWT tokens are being passed correctly
4. Contact the security team for assistance
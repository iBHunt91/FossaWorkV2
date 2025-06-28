# Security Migration Guide - Fixing Authentication Bypass

## Overview

FossaWork V2 has a critical security vulnerability where API endpoints accept `user_id` as a query parameter, allowing authenticated users to potentially access other users' data. This guide shows how to fix these vulnerabilities.

## The Problem

**Current Vulnerable Pattern:**
```python
@router.get("/api/work-orders")
async def get_work_orders(
    user_id: str = Query(...),  # ❌ VULNERABLE - accepts any user_id
    current_user: User = Depends(require_auth)
):
    # Weak check that can be bypassed
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(403)
```

**Why This Is Dangerous:**
1. Users can try different user_id values to access others' data
2. The admin check creates a privilege escalation path
3. Violates principle of least privilege
4. Creates audit trail gaps

## The Solution

### Step 1: Use Secure Dependencies

Import the new security dependencies:
```python
from app.core.security_deps import (
    get_current_user_id,
    require_user_access,
    require_admin,
    log_security_event,
    SecurityEvent
)
```

### Step 2: Fix Endpoints - Three Patterns

#### Pattern A: Simple User Data Access (Most Common)
```python
# ❌ BEFORE - Vulnerable
@router.get("/api/work-orders")
async def get_work_orders(
    user_id: str = Query(...),
    current_user: User = Depends(require_auth)
):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(403)
    return get_user_work_orders(db, user_id)

# ✅ AFTER - Secure
@router.get("/api/work-orders")
async def get_work_orders(
    user_id: str = Depends(get_current_user_id),  # Gets ID from JWT
    db: Session = Depends(get_db)
):
    return get_user_work_orders(db, user_id)
```

#### Pattern B: When You Need Request Context
```python
# ❌ BEFORE
@router.post("/api/credentials/decrypt")
async def decrypt_credentials(
    user_id: str = Query(...),
    current_user: User = Depends(require_auth)
):
    # Vulnerable check

# ✅ AFTER
@router.post("/api/credentials/decrypt")
async def decrypt_credentials(
    request: Request,
    user_id: str = Query(...),  # Keep for backward compatibility
    current_user: User = Depends(require_auth)
):
    # Use require_user_access for enhanced security + logging
    await require_user_access(user_id, request, current_user)
    # Now safe to proceed
```

#### Pattern C: Admin-Only Endpoints
```python
# ✅ Create separate admin endpoints
@router.get("/api/admin/users/{target_user_id}/work-orders")
async def admin_get_user_work_orders(
    target_user_id: str,
    request: Request,
    admin_user: User = Depends(require_admin)  # Enforces admin + logs
):
    log_security_event(
        SecurityEvent.ADMIN_ACCESS,
        admin_user.id,
        {"action": "view_user_work_orders", "target": target_user_id},
        request
    )
    return get_user_work_orders(db, target_user_id)
```

## Endpoints Requiring Migration

### CRITICAL Priority (Fix Immediately)
- [ ] `/api/v1/credentials/workfossa/decrypt` ✅ ALREADY FIXED
- [ ] `/api/settings/smtp/{user_id}` - Contains SMTP passwords
- [ ] `/api/credentials/*` - All credential endpoints

### HIGH Priority (Fix Within 24 Hours)
- [ ] `/api/v1/work-orders/*` - All work order endpoints
- [ ] `/api/v1/work-orders/{id}/scrape-dispensers`
- [ ] `/api/v1/work-orders/scrape-dispensers-batch`
- [ ] `/api/settings/*` - All settings endpoints
- [ ] `/api/notifications/preferences/{user_id}`

### MEDIUM Priority (Fix Within Week)
- [ ] `/api/user-preferences/*`
- [ ] `/api/scraping/schedules/*`
- [ ] `/api/filters/*`
- [ ] `/api/dispensers/*`

## Step-by-Step Migration Process

### 1. Enable Migration Monitoring

Add to `main.py`:
```python
from app.middleware.enable_security_migration import enable_security_migration

# After creating the FastAPI app
app = FastAPI()

# Enable security migration monitoring
enable_security_migration(app, block_legacy=False)  # Set True to block critical endpoints
```

### 2. Run and Monitor

```bash
# Start the app
cd backend
uvicorn app.main:app --reload

# Monitor logs for security issues
tail -f logs/app.log | grep -E "SECURITY_MIGRATION|CRITICAL_SECURITY"

# Check migration report
curl http://localhost:8000/api/admin/security-migration-report
```

### 3. Fix Endpoints Systematically

For each endpoint:
1. Check if it accepts `user_id` as query param
2. Determine which pattern to use (A, B, or C)
3. Update the code
4. Test the endpoint
5. Update any frontend code that calls it

### 4. Frontend Updates

```typescript
// OLD - Sending user_id
const response = await api.get(`/api/work-orders?user_id=${currentUser.id}`);

// NEW - No user_id needed
const response = await api.get('/api/work-orders');
```

## Testing Your Fixes

### Manual Testing
```bash
# Test that endpoint rejects other user's data
curl -H "Authorization: Bearer <user_a_token>" \
  "http://localhost:8000/api/work-orders?user_id=user_b_id"
# Should return 403 Forbidden

# Test that user can access their own data
curl -H "Authorization: Bearer <user_a_token>" \
  "http://localhost:8000/api/work-orders"
# Should return user A's work orders
```

### Automated Test Example
```python
def test_user_cannot_access_other_users_data():
    # Login as user A
    user_a_token = login_user("user_a")
    
    # Try to access user B's data
    response = client.get(
        "/api/work-orders?user_id=user_b_id",
        headers={"Authorization": f"Bearer {user_a_token}"}
    )
    
    assert response.status_code == 403
    assert "your own data" in response.json()["detail"]
```

## Common Mistakes to Avoid

### ❌ Don't Do This:
```python
# Still accepting user_id from query
async def get_data(
    user_id: str = Query(None),  # Optional doesn't make it secure!
    current_user: User = Depends(require_auth)
):
    user_id = user_id or current_user.id  # Still vulnerable!
```

### ✅ Do This Instead:
```python
# Only use JWT-derived user ID
async def get_data(
    user_id: str = Depends(get_current_user_id)
):
    # user_id is guaranteed to be the authenticated user
```

## Verification Checklist

- [ ] Migration middleware enabled
- [ ] No endpoints accept user_id from query params (except during migration)
- [ ] All endpoints use `get_current_user_id` or `require_user_access`
- [ ] Admin endpoints are separate and logged
- [ ] Frontend updated to not send user_id
- [ ] Security tests pass
- [ ] Migration report shows 0 violations

## Need Help?

1. Check logs for `SECURITY_MIGRATION` tags
2. View migration report at `/api/admin/security-migration-report`
3. Run the test script: `python test_security_fix.py`
4. Review the security deps module: `app/core/security_deps.py`

Remember: **Never trust user-provided identifiers. Always derive user context from the authenticated JWT token.**
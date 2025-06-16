# security-fix

Automated security remediation tool that fixes critical vulnerabilities in the FossaWork V2 codebase.

## Usage
```
/security-fix [issue] [options]
```

## Issues
- `hardcoded-secrets` - Replace hardcoded passwords and keys
- `encryption` - Fix base64 "encryption" with proper cryptography
- `auth-middleware` - Implement proper authentication
- `api-protection` - Protect exposed endpoints
- `cors` - Configure secure CORS settings
- `all` - Fix all security issues

## Options
- `--check` - Preview changes without applying
- `--backup` - Create backup before changes
- `--test` - Run tests after fixes

## Security Fixes Applied

### 1. Hardcoded Secrets
- Removes all hardcoded default keys
- Generates secure random keys
- Updates .env.example with required variables
- Validates environment variables on startup

### 2. Encryption Implementation
- Makes cryptography library mandatory
- Removes base64 fallback completely
- Implements proper Fernet encryption
- Adds key rotation support

### 3. Authentication Middleware
- Replaces dummy auth with real JWT validation
- Implements token verification
- Adds user session management
- Protects all non-auth endpoints

### 4. API Protection
- Removes public access to sensitive endpoints
- Implements role-based access control
- Adds request rate limiting
- Logs all access attempts

### 5. CORS Configuration
- Restricts allowed origins for production
- Limits methods to required ones only
- Specifies exact headers needed
- Disables credentials where not needed

## Implementation Examples

### Fix Hardcoded Secrets:
```python
# Before:
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")

# After:
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")
```

### Fix Encryption:
```python
# Before:
if not CRYPTO_AVAILABLE:
    return base64.urlsafe_b64encode(data.encode()).decode()

# After:
if not CRYPTO_AVAILABLE:
    raise ImportError("cryptography library is required for secure credential storage")
```

### Fix Authentication:
```python
# Before:
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    # Dummy implementation
    return {"user_id": "dev_user", "username": "developer"}

# After:
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return await get_user_by_id(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## Safety Features
- Creates git commit before changes
- Validates fixes don't break functionality
- Runs security scan after fixes
- Provides rollback instructions

## Post-Fix Actions
1. Update all .env files with new required variables
2. Restart all services
3. Run full test suite
4. Update deployment configurations
5. Rotate all existing tokens/sessions
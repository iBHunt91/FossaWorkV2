# Security Fixes Implementation Prompt for FossaWork V2

## Context
You are working in the security-fixes branch to address critical security vulnerabilities identified in the comprehensive code audit. The application is a fuel dispenser automation and monitoring system with React frontend and FastAPI backend.

## Priority 1: CRITICAL Security Issues to Fix

### 1. Encrypt All Stored Credentials (CRITICAL)
**Current Issue**: WorkFossa credentials stored in plain text JSON files
**Location**: `backend/app/services/credential_manager.py`, `backend/data/credentials/`

**Tasks**:
- Review existing `EncryptionService` at `backend/app/services/encryption.py`
- Modify `CredentialManager` to use `EncryptionService` for all credential operations
- Migrate existing plain text credentials to encrypted format
- Create migration script: `backend/scripts/migrate_credentials.py`
- Update all services that read credentials to use the encrypted format
- Test credential encryption/decryption thoroughly

**Acceptance Criteria**:
- No plain text passwords in any JSON files
- All credentials encrypted with AES-256
- Backward compatibility maintained during migration
- Clear logging of encryption operations (without logging sensitive data)

### 2. Fix API Authentication Middleware (CRITICAL)
**Current Issue**: Middleware only checks token presence, not validity
**Location**: `backend/app/middleware/auth.py`

**Tasks**:
- Update `AuthMiddleware` to validate JWT tokens, not just check presence
- Ensure all API endpoints (except public ones) require valid authentication
- Review and update the `public_endpoints` list - remove any sensitive endpoints
- Add proper error responses for invalid/expired tokens
- Implement token validation using `verify_token` from `backend/app/core/security.py`

**Public endpoints should only include**:
- `/api/auth/login`
- `/api/auth/register` (if applicable)
- `/docs`, `/redoc`, `/openapi.json` (API documentation)
- Static files and health checks

### 3. Configure Production CORS Settings (CRITICAL)
**Current Issue**: CORS allows all methods and headers (`allow_methods=["*"]`)
**Location**: `backend/app/main.py` lines 50-56

**Tasks**:
- Create environment-based CORS configuration
- Restrict allowed origins to specific domains
- Explicitly list allowed methods: `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`
- Explicitly list allowed headers: `["Authorization", "Content-Type", "Accept"]`
- Add CORS configuration to `.env.example`
- Implement dynamic CORS based on ENVIRONMENT variable

**Example implementation**:
```python
CORS_ORIGINS = {
    "development": ["http://localhost:3001", "http://localhost:5173"],
    "production": ["https://yourdomain.com", "https://app.yourdomain.com"]
}
```

## Priority 2: HIGH Security Issues

### 4. Implement Input Validation Framework
**Current Issue**: No systematic input validation across endpoints
**Locations**: All API route files in `backend/app/routes/`

**Tasks**:
- Create Pydantic models for ALL request/response schemas
- Add validation for:
  - Work order IDs (format: W-XXXXXX)
  - Store numbers (numeric only)
  - Service codes (valid codes: 2861, 2862, 3002, 3146)
  - Email addresses (use pydantic[email])
  - File paths (prevent directory traversal)
- Create `backend/app/schemas/` directory for all Pydantic models
- Update all endpoints to use request/response models
- Add custom validators for business logic

### 5. Remove Sensitive Files from Repository
**Current Issue**: `.env` files may be in repository
**Location**: Root and backend directories

**Tasks**:
- Check if any `.env` files are tracked by git
- Add `.env` to `.gitignore` if not already present
- Remove any committed `.env` files from git history
- Create comprehensive `.env.example` with all required variables
- Document all environment variables in README

### 6. Implement Token Refresh Mechanism
**Current Issue**: JWT tokens expire after 24 hours with no refresh
**Location**: `backend/app/core/security.py`, `backend/app/routes/auth.py`

**Tasks**:
- Implement refresh token generation and storage
- Add `/api/auth/refresh` endpoint
- Update frontend to handle token refresh automatically
- Reduce access token lifetime to 15 minutes
- Implement refresh token rotation for security
- Add token revocation mechanism

## Priority 3: Additional Security Enhancements

### 7. Add Rate Limiting
**Tasks**:
- Implement rate limiting for authentication endpoints (5 attempts per minute)
- Add rate limiting for API endpoints (100 requests per minute per user)
- Use `slowapi` library for FastAPI rate limiting
- Store rate limit data in Redis (if available) or in-memory

### 8. Security Headers Middleware
**Tasks**:
- Add security headers middleware to `backend/app/middleware/`
- Implement headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy` (configure appropriately)

### 9. Audit Logging
**Tasks**:
- Create security event logger
- Log: authentication attempts, authorization failures, data modifications
- Separate security logs from application logs
- Include: timestamp, user ID, IP address, action, result

## Implementation Order

1. **Day 1**: Credential encryption (Priority 1.1)
2. **Day 2**: API authentication fixes (Priority 1.2)
3. **Day 3**: CORS configuration (Priority 1.3)
4. **Day 4**: Input validation framework (Priority 2.4)
5. **Day 5**: Token refresh mechanism (Priority 2.6)
6. **Week 2**: Additional enhancements (Priority 3)

## Testing Requirements

For each security fix:
1. Write unit tests for the security functionality
2. Test both positive and negative cases
3. Verify no regression in existing functionality
4. Document test cases in `/tests/security/`

## Security Testing Checklist

- [ ] Credentials properly encrypted in storage
- [ ] API endpoints reject invalid tokens
- [ ] CORS properly restricts origins
- [ ] Input validation prevents injection attacks
- [ ] Token refresh works seamlessly
- [ ] Rate limiting prevents brute force
- [ ] Security headers present in responses
- [ ] Audit logs capture security events

## Important Notes

1. **NEVER log sensitive information** (passwords, tokens, keys)
2. **Always validate input** before processing
3. **Test security fixes thoroughly** before marking complete
4. **Update documentation** for any API changes
5. **Maintain backward compatibility** where possible

## Resources

- OWASP Security Guidelines: https://owasp.org/www-project-top-ten/
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

## Success Criteria

The security fixes are complete when:
1. All credentials are encrypted at rest
2. All API endpoints properly authenticate requests
3. CORS is configured for production security
4. Input validation prevents common attacks
5. Security headers are present
6. Comprehensive tests pass
7. Documentation is updated

Start with Priority 1 issues as they are CRITICAL for production safety.
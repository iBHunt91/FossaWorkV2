# Claude Code Security Fixes Implementation

I need to implement critical security fixes for FossaWork V2 based on the code audit. I'm working in the security-fixes branch.

## CRITICAL Issues to Fix (Priority 1)

### 1. Encrypt Stored Credentials
- **Problem**: WorkFossa credentials stored as plain text in JSON files
- **Solution**: Use existing EncryptionService to encrypt all credentials
- **Files**: `backend/app/services/credential_manager.py`
- **Task**: Modify save_credentials() and get_credentials() to use encryption

### 2. Fix API Authentication 
- **Problem**: AuthMiddleware only checks if token exists, doesn't validate it
- **Solution**: Add proper JWT validation in middleware
- **File**: `backend/app/middleware/auth.py`
- **Task**: Call verify_token() to validate tokens, not just check presence

### 3. Fix CORS Configuration
- **Problem**: CORS allows all methods/headers (security risk)
- **Solution**: Restrict CORS for production
- **File**: `backend/app/main.py` lines 50-56
- **Task**: Replace allow_methods=["*"] with specific methods

## Implementation Plan

Please implement these security fixes in order:

1. **First**: Read and understand the existing security implementation:
   - Read `backend/app/services/encryption.py` 
   - Read `backend/app/core/security.py`
   - Read `backend/app/middleware/auth.py`

2. **Implement Credential Encryption**:
   - Update CredentialManager to encrypt before saving
   - Update CredentialManager to decrypt after loading
   - Create migration script for existing credentials
   - Test with sample credentials

3. **Fix Authentication Middleware**:
   - Import verify_token from core.security
   - Validate tokens in middleware, not just check presence
   - Return 401 for invalid tokens
   - Keep public endpoints list minimal

4. **Configure CORS**:
   - Create environment-based CORS settings
   - Use explicit lists for methods and headers
   - Add CORS_ORIGINS to .env.example

## Testing

After each fix:
- Write unit tests in `/tests/backend/security/`
- Test manually with the frontend
- Ensure no breaking changes

## Important Guidelines

- NEVER log passwords or tokens
- Always handle errors gracefully  
- Maintain backward compatibility
- Update .env.example with new variables
- Create migration scripts for data changes

Please start by reading the existing security files to understand the current implementation, then proceed with implementing the credential encryption fix.
# Security Headers Implementation Guide

## Overview

This document describes the comprehensive security headers implementation for FossaWork V2, following OWASP security best practices.

## Implemented Security Headers

### 1. Content Security Policy (CSP)
**Purpose**: Prevents XSS attacks by controlling which resources can be loaded.

**Implementation**:
- **Development**: Permissive policy allowing localhost connections and eval (for HMR)
- **Staging**: Balanced policy with domain restrictions
- **Production**: Strict policy with upgrade-insecure-requests

**Key Directives**:
```
default-src 'self'
script-src 'self' [environment-specific sources]
style-src 'self' 'unsafe-inline'  # Required for React inline styles
img-src 'self' data: blob:       # Supports screenshots
connect-src 'self' [API domains] [WebSocket URLs]
frame-ancestors 'none'           # Clickjacking protection
```

### 2. X-Frame-Options
**Purpose**: Prevents clickjacking attacks.
**Value**: `DENY` (page cannot be framed)

### 3. X-Content-Type-Options
**Purpose**: Prevents MIME type sniffing.
**Value**: `nosniff`

### 4. Strict-Transport-Security (HSTS)
**Purpose**: Forces HTTPS connections.
**Values**:
- **Development**: Not set (allows HTTP)
- **Staging**: `max-age=86400; includeSubDomains` (1 day)
- **Production**: `max-age=31536000; includeSubDomains; preload` (1 year)

### 5. X-XSS-Protection
**Purpose**: Legacy XSS protection for older browsers.
**Value**: `1; mode=block`

### 6. Referrer-Policy
**Purpose**: Controls referrer information sent with requests.
**Value**: `strict-origin-when-cross-origin`

### 7. Permissions-Policy
**Purpose**: Controls browser feature access.
**Value**: Disables unnecessary features like geolocation, camera, etc.

## Implementation Details

### Middleware Location
- **File**: `backend/app/middleware/security_headers.py`
- **Configuration**: `backend/app/core/security_config.py`

### Environment-Specific Configuration

The security headers adapt based on the `ENVIRONMENT` variable:

#### Development (`ENVIRONMENT=development`)
- Allows `unsafe-eval` for hot module replacement
- Permits WebSocket connections to localhost
- No HSTS header (allows HTTP)
- Relaxed CSP for development tools

#### Staging (`ENVIRONMENT=staging`)
- Restricts connections to staging domain
- Enables HSTS with 1-day max-age
- Balanced security without breaking functionality

#### Production (`ENVIRONMENT=production`)
- Strictest CSP policy
- HSTS with preload flag
- Forces HTTPS for all requests
- Optional security reporting endpoint

### Integration with CORS

The security headers middleware works alongside CORS:
1. CORS middleware handles cross-origin requests
2. Security headers middleware adds security headers
3. Both respect each other's headers (no overwriting)

## Testing Security Headers

### Manual Testing
```bash
# Test with curl
curl -I http://localhost:8000/
curl -I http://localhost:8000/api/v1/status

# Check specific header
curl -I http://localhost:8000/ | grep -i "content-security-policy"
```

### Automated Testing
```bash
# Run security headers test script
cd scripts/testing
python test_security_headers.py
```

### Browser Testing
1. Open Developer Tools (F12)
2. Go to Network tab
3. Make a request to the application
4. Click on the request and view Response Headers
5. Verify all security headers are present

## Configuration

### Environment Variables
```bash
# .env file
ENVIRONMENT=production
STAGING_DOMAIN=staging.fossawork.com
PRODUCTION_DOMAIN=app.fossawork.com
SECURITY_REPORT_URI=https://your-report-endpoint.com/csp-reports
```

### Customizing Headers

To customize security headers for specific routes:

```python
from fastapi import Response
from app.core.security_config import get_api_security_headers

@router.get("/api/special-endpoint")
async def special_endpoint(response: Response):
    # Add custom headers
    custom_headers = get_api_security_headers()
    custom_headers["X-Custom-Header"] = "value"
    
    for header, value in custom_headers.items():
        response.headers[header] = value
    
    return {"data": "example"}
```

## Security Considerations

### React SPA Requirements
- `style-src 'unsafe-inline'` is required for React's inline styles
- Consider using CSS-in-JS libraries that support CSP nonces in the future

### WebSocket Support
- CSP includes `ws://` (development) and `wss://` (production) protocols
- Required for real-time features and hot module replacement

### External APIs
- WorkFossa API (`https://app.workfossa.com`) is whitelisted in connect-src
- Add other external APIs as needed in the configuration

### Image Handling
- `data:` and `blob:` URLs allowed for screenshot functionality
- Be cautious about user-uploaded content

## Monitoring and Reporting

### CSP Violation Reporting
In production, configure a CSP report endpoint:
1. Set `SECURITY_REPORT_URI` environment variable
2. Implement an endpoint to receive and log CSP violations
3. Monitor reports for potential attacks or misconfigurations

### Header Validation
Regular security audits should verify:
1. All headers are present on all endpoints
2. Header values match environment requirements
3. No security regressions in new deployments

## Future Enhancements

### 1. Nonce-Based CSP
Implement dynamic nonces for inline scripts:
- Generate unique nonce per request
- Inject into HTML responses
- Add to CSP header dynamically

### 2. Subresource Integrity (SRI)
Add integrity checks for external resources:
```html
<script src="https://cdn.example.com/lib.js" 
        integrity="sha384-..." 
        crossorigin="anonymous"></script>
```

### 3. Feature Policy → Permissions Policy Migration
Complete migration from Feature-Policy to Permissions-Policy syntax.

### 4. Security Headers for Static Files
Ensure static file serving includes appropriate headers.

## Troubleshooting

### Common Issues

1. **CSP Blocking Resources**
   - Check browser console for CSP violations
   - Update CSP configuration to include required sources
   - Use report-only mode for testing

2. **CORS Conflicts**
   - Ensure CORS origins match security policy
   - Check middleware order (CORS before security headers)

3. **Development Tools Breaking**
   - Verify `ENVIRONMENT=development` is set
   - Check that unsafe-eval is allowed in development CSP

### Debug Mode
Enable debug logging in the security headers middleware:
```python
# In security_headers.py
logger.setLevel(logging.DEBUG)
```

## Compliance

This implementation helps meet requirements for:
- OWASP Top 10 security risks
- PCI DSS security headers requirements
- General web security best practices
- GDPR technical measures (security by design)
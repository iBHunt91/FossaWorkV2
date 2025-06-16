# security-scan

Run a comprehensive security scan on the FossaWork V2 codebase to detect vulnerabilities, misconfigurations, and compliance issues.

## Usage
```
/security-scan [scope] [options]
```

## Scopes
- `full` - Complete security audit (default)
- `auth` - Authentication and authorization
- `crypto` - Encryption and credential storage
- `api` - API endpoints and CORS
- `deps` - Dependency vulnerabilities
- `config` - Configuration security

## Options
- `--fix` - Attempt to auto-fix issues
- `--report` - Generate detailed report
- `--ci` - CI-friendly output

## Security Checks Performed

### 1. Authentication & Authorization
- JWT token configuration
- Password policies
- Session management
- User isolation
- Permission checks

### 2. Cryptography
- Encryption algorithms
- Key management
- Certificate validation
- Secure random generation
- Hash functions

### 3. API Security
- Endpoint protection
- Input validation
- Output encoding
- CORS configuration
- Rate limiting

### 4. Dependency Analysis
- Known vulnerabilities (CVE database)
- Outdated packages
- License compliance
- Supply chain risks

### 5. Configuration
- Environment variables
- File permissions
- Logging configuration
- Debug mode detection
- Default credentials

### 6. Code Security
- SQL injection
- XSS vulnerabilities
- CSRF protection
- Path traversal
- Command injection

## Output Example
```
🔒 FossaWork V2 Security Scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Authentication: ✅ PASS (15/15 checks)
Cryptography: ✅ PASS (8/8 checks)
API Security: ⚠️ WARN (12/15 checks)
  - Missing rate limiting
  - CORS could be more restrictive
  - Some endpoints lack input validation
Dependencies: ✅ PASS (0 vulnerabilities)
Configuration: ✅ PASS (10/10 checks)
Code Security: ✅ PASS (25/25 checks)

Overall Score: 92/100 (A-)
Risk Level: LOW

3 issues found:
1. [MEDIUM] Rate limiting not implemented
2. [LOW] CORS allows all headers
3. [LOW] Input validation missing on 3 endpoints

Run with --report for detailed findings
```

## Integration with CI/CD

```yaml
# GitHub Actions example
- name: Security Scan
  run: |
    claude code /security-scan --ci
```

## Remediation Guidance

The scan provides:
- Specific file locations
- Code examples for fixes
- Security best practices
- Links to documentation
- Priority rankings

## Compliance Checks

Optionally check against:
- OWASP Top 10
- CWE/SANS Top 25
- PCI DSS (if applicable)
- GDPR requirements
- SOC 2 controls
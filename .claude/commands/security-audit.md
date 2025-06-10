# Security Audit

Perform comprehensive security analysis of the FossaWork codebase.

## Execution Steps

1. Scan for exposed credentials:
   - Search for API keys, passwords, tokens
   - Check .env files and configuration
   - Verify .gitignore coverage
   - Scan commit history
   - Check for hardcoded secrets
2. Analyze authentication:
   - Login implementation security
   - Session management
   - Token generation/validation
   - Password hashing methods
   - Multi-factor authentication
3. Verify input validation:
   - Form input sanitization
   - API parameter validation
   - File upload restrictions
   - SQL injection prevention
   - Command injection protection
4. Check for vulnerabilities:
   - XSS (Cross-Site Scripting)
   - CSRF (Cross-Site Request Forgery)
   - SSRF (Server-Side Request Forgery)
   - Path traversal
   - Insecure deserialization
5. Analyze dependencies:
   - Run npm audit
   - Check for known CVEs
   - Verify dependency licenses
   - Check for outdated packages
   - Review dependency tree
6. Review security headers:
   - Content Security Policy
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security
   - Referrer-Policy
7. Audit data handling:
   - Encryption at rest
   - Encryption in transit
   - PII data handling
   - Data retention policies
   - Backup security
8. Generate security report:
   - Critical vulnerabilities
   - High/Medium/Low risks
   - Remediation steps
   - Security scorecard

## Parameters
- `--deep`: Include dependency tree analysis
- `--fix`: Attempt automatic fixes
- `--compliance`: Check compliance standards
- `--pentest`: Simulate common attacks

## Example Usage

```
/security-audit --deep --fix
```

```
/security-audit --compliance=OWASP --pentest
```

## Critical Security Checks

### Credential Security
- No credentials in source code
- Environment variables properly used
- Secrets rotated regularly
- Access logs maintained

### Authentication Security
- Strong password requirements
- Account lockout policies
- Session timeout implementation
- Secure cookie settings

### Data Protection
- HTTPS enforcement
- Database encryption
- Secure file storage
- Audit trail maintenance

### Common Vulnerabilities
- Dependency vulnerabilities
- Injection attacks
- Broken authentication
- Sensitive data exposure
- XML external entities
- Broken access control
- Security misconfiguration
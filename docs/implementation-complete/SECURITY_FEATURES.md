# Security Features Configuration Guide

## Overview

FossaWork V2 includes comprehensive security features that can be enabled/disabled via environment variables. This guide explains how to configure and monitor these features.

## Security Features

### 1. Security Headers Middleware

**Always Enabled** - Adds OWASP-recommended security headers to all responses.

Headers added:
- `Content-Security-Policy` - Prevents XSS attacks
- `X-Frame-Options` - Prevents clickjacking
- `X-Content-Type-Options` - Prevents MIME sniffing
- `Strict-Transport-Security` - Forces HTTPS (production only)
- `X-XSS-Protection` - Legacy XSS protection
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser features

### 2. Security Migration Middleware

Monitors and optionally blocks legacy authentication patterns (user_id in query params).

**Environment Variables:**
```bash
# Enable/disable migration tracking (default: true)
ENABLE_SECURITY_MIGRATION=true

# Block legacy authentication patterns (default: false)
BLOCK_LEGACY_AUTH=false
```

**Features:**
- Tracks endpoints using legacy `user_id` query parameters
- Logs security violations for audit
- Can block requests to critical endpoints
- Provides migration progress reports

### 3. Query Profiler

Detects N+1 queries and performance issues.

**Environment Variables:**
```bash
# Enable query profiling (default: false)
ENABLE_QUERY_PROFILING=true

# Only enable in development mode
WORKFOSSA_DEV_MODE=true
```

**Features:**
- Detects N+1 query patterns
- Identifies slow queries (>100ms)
- Provides optimization recommendations
- Available via API endpoint

## API Endpoints

### Security Status
```
GET /api/v1/security/status
```
Public endpoint showing which security features are enabled.

**Response:**
```json
{
  "security_headers": "enabled",
  "migration_tracking": "enabled",
  "legacy_auth_blocking": "disabled",
  "query_profiling": "disabled",
  "recommendations": [...]
}
```

### Migration Report (Admin Only)
```
GET /api/v1/security/migration-report
```
Shows endpoints that need migration from legacy auth patterns.

**Response:**
```json
{
  "migration_start": "2025-01-13T10:00:00",
  "total_legacy_endpoints": 15,
  "total_violations": 234,
  "endpoints": [...],
  "recommendations": [...]
}
```

### Query Profile (Admin Only)
```
GET /api/v1/security/query-profile
```
Shows query performance analysis and N+1 detection.

**Response:**
```json
{
  "enabled": true,
  "analysis": {
    "total_queries": 150,
    "slow_queries": 5,
    "n_plus_one_candidates": 3
  },
  "recommendations": [...]
}
```

## Configuration Examples

### Development Environment
```bash
# .env.development
ENVIRONMENT=development
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=false  # Monitor but don't block
ENABLE_QUERY_PROFILING=true
WORKFOSSA_DEV_MODE=true
```

### Staging Environment
```bash
# .env.staging
ENVIRONMENT=staging
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=false  # Still monitoring
ENABLE_QUERY_PROFILING=false
CSP_REPORT_URI=https://your-csp-collector.com/report
```

### Production Environment
```bash
# .env.production
ENVIRONMENT=production
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=true  # Block legacy patterns
ENABLE_QUERY_PROFILING=false
CSP_REPORT_URI=https://your-csp-collector.com/report
```

## Rollout Strategy

### Phase 1: Monitoring (Week 1-2)
1. Enable security migration tracking
2. Keep legacy auth blocking disabled
3. Monitor logs for violations
4. Generate migration reports

### Phase 2: Warning (Week 3-4)
1. Add deprecation warnings to responses
2. Update frontend to stop using legacy patterns
3. Continue monitoring

### Phase 3: Enforcement (Week 5+)
1. Enable legacy auth blocking
2. Monitor for any issues
3. Remove migration middleware once complete

## Monitoring

### Log Patterns to Watch

Security migration events:
```
grep "SECURITY_MIGRATION" app.log
grep "CRITICAL_SECURITY" app.log
```

Security violations:
```
grep "ACCESS_DENIED" app.log
grep "SUSPICIOUS_ACTIVITY" app.log
```

Query performance:
```
grep "Slow query detected" app.log
grep "N+1 queries detected" app.log
```

### Metrics to Track

1. **Legacy Auth Usage**
   - Number of endpoints using user_id params
   - Frequency of legacy pattern usage
   - Which users/services still use legacy patterns

2. **Security Headers**
   - CSP violations reported
   - Headers properly set on all responses
   - No missing headers

3. **Query Performance**
   - Number of N+1 patterns detected
   - Slow query count
   - Average query time

## Troubleshooting

### Issue: Frontend breaks after enabling BLOCK_LEGACY_AUTH
**Solution:** Frontend is still using legacy patterns. Check migration report and update frontend code.

### Issue: CSP blocking legitimate resources
**Solution:** Update CSP directives in security_headers.py to whitelist required sources.

### Issue: Query profiling shows high memory usage
**Solution:** Disable in production, use only for development debugging.

### Issue: Too many security violation logs
**Solution:** Implement log aggregation or adjust logging levels.

## Best Practices

1. **Gradual Rollout**
   - Start with monitoring
   - Fix issues before enforcement
   - Communicate changes to team

2. **Regular Review**
   - Check migration reports weekly
   - Review security logs daily
   - Update CSP as needed

3. **Performance Impact**
   - Security headers: Minimal (<1ms)
   - Migration tracking: Minimal (<2ms)
   - Query profiling: Moderate (5-10ms) - dev only

4. **Documentation**
   - Document any CSP exceptions
   - Keep migration guide updated
   - Track security decisions

## Next Steps

1. Enable security features in development
2. Run security tests: `python scripts/test_security_headers.py`
3. Monitor logs for first 24 hours
4. Generate first migration report
5. Plan frontend updates based on report
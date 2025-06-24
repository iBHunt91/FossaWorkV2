# Security Deployment Guide
## FossaWork V2 - Production Rollout Process

**Version:** 1.0  
**Last Updated:** June 24, 2025  
**Deployment Team:** DevOps & Security Teams

---

## 🚀 Quick Start Checklist

```bash
□ Environment variables configured
□ Database backed up
□ Security features enabled
□ Monitoring configured
□ Load balancer ready
□ Rollback plan prepared
□ Team notified
□ Maintenance window scheduled
```

---

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration

#### Required Environment Variables
```bash
# Security Keys (REQUIRED - Generate new for production)
SECRET_KEY=<generate-with-openssl-rand-base64-64>
FOSSAWORK_MASTER_KEY=<generate-with-openssl-rand-base64-32>

# Database (REQUIRED)
DATABASE_URL=postgresql://user:pass@host:5432/fossawork_prod

# Security Features (REQUIRED)
ENVIRONMENT=production
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=false  # Enable after migration
ENABLE_QUERY_PROFILING=false  # Production should be false

# CORS Configuration (REQUIRED - Replace with your domains)
CORS_ALLOWED_ORIGINS=["https://yourdomain.com", "https://app.yourdomain.com"]

# Monitoring (RECOMMENDED)
CSP_REPORT_URI=https://your-csp-collector.com/report
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
ALERT_EMAIL=security@yourdomain.com
PUSHOVER_API_KEY=<your-pushover-key>

# Rate Limiting (OPTIONAL - Defaults are secure)
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_API=60/minute
RATE_LIMIT_AUTOMATION=10/minute
```

#### Generate Secure Keys
```bash
# Generate SECRET_KEY
openssl rand -base64 64 | tr -d '\n'

# Generate FOSSAWORK_MASTER_KEY
openssl rand -base64 32 | tr -d '\n'
```

### 2. Database Preparation

#### Backup Current Database
```bash
# PostgreSQL
pg_dump -h localhost -U fossawork -d fossawork_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# SQLite (if still using)
cp fossawork_v2.db fossawork_v2_backup_$(date +%Y%m%d_%H%M%S).db
```

#### Apply Performance Indexes
```bash
cd backend
python scripts/add_performance_indexes.py --check-first
```

#### Run Database Migrations
```bash
alembic upgrade head
```

### 3. Dependency Updates

#### Update Python Dependencies
```bash
cd backend
pip install -r requirements.txt --upgrade
```

#### Critical Security Updates
```bash
# Replace python-jose with PyJWT
pip uninstall python-jose
pip install "PyJWT[crypto]>=2.8.0"
```

### 4. Security Configuration Verification

#### Run Security Tests
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes
python tests/backend/security/comprehensive/run_security_tests.py

# Expected output:
# Security Score: 100% (All tests passed)
```

#### Verify Security Headers
```bash
curl -I https://staging.yourdomain.com/api/v1/health
# Check for security headers in response
```

---

## 🚢 Step-by-Step Deployment Process

### Phase 1: Monitoring Mode (Days 1-7)

#### 1. Deploy with Monitoring Enabled
```bash
# Deploy with security monitoring but not blocking
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=false
```

#### 2. Monitor Security Events
```bash
# Check security logs
tail -f logs/security.log | grep "SECURITY_MIGRATION"

# Generate migration report
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.yourdomain.com/api/v1/security/migration-report
```

#### 3. Identify Legacy Patterns
- Review which endpoints use user_id query parameters
- Identify which clients need updates
- Document required frontend changes

### Phase 2: Warning Mode (Days 8-14)

#### 1. Enable Deprecation Headers
```python
# In security_migration.py, add:
response.headers["X-Deprecated-Auth"] = "user_id query param will be blocked soon"
```

#### 2. Update Frontend Code
- Replace user_id query parameters with proper JWT auth
- Test all workflows with new authentication
- Deploy frontend updates

#### 3. Notify API Consumers
- Send deprecation notices
- Provide migration guide
- Set enforcement date

### Phase 3: Enforcement Mode (Day 15+)

#### 1. Enable Legacy Auth Blocking
```bash
# Update environment
BLOCK_LEGACY_AUTH=true
```

#### 2. Deploy in Stages
```bash
# 1. Deploy to canary (5% traffic)
kubectl set image deployment/api api=fossawork:v2-security --record

# 2. Monitor for 1 hour
watch kubectl logs -l app=api --tail=50

# 3. Deploy to 25% traffic
kubectl patch deployment api -p '{"spec":{"replicas":4}}'

# 4. Monitor for 2 hours

# 5. Full deployment
kubectl rollout restart deployment/api
```

#### 3. Monitor Error Rates
```bash
# Check for increased 401/403 errors
grep -c "401\|403" logs/access.log

# Monitor security violations
grep "ACCESS_DENIED" logs/security.log | wc -l
```

---

## 🔧 Configuration by Environment

### Development
```env
ENVIRONMENT=development
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=false
ENABLE_QUERY_PROFILING=true
CORS_ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
```

### Staging
```env
ENVIRONMENT=staging  
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=false
ENABLE_QUERY_PROFILING=false
CORS_ALLOWED_ORIGINS=["https://staging.yourdomain.com"]
CSP_REPORT_URI=https://csp-collector.yourdomain.com/staging
```

### Production
```env
ENVIRONMENT=production
ENABLE_SECURITY_MIGRATION=true
BLOCK_LEGACY_AUTH=true
ENABLE_QUERY_PROFILING=false
CORS_ALLOWED_ORIGINS=["https://yourdomain.com", "https://app.yourdomain.com"]
CSP_REPORT_URI=https://csp-collector.yourdomain.com/production
```

---

## 🧪 Testing Procedures

### 1. Pre-Deployment Tests

#### Authentication Tests
```bash
# Test without token (should fail)
curl https://api.staging.yourdomain.com/api/v1/work-orders
# Expected: 401 Unauthorized

# Test with valid token
curl -H "Authorization: Bearer $TOKEN" \
  https://api.staging.yourdomain.com/api/v1/work-orders
# Expected: 200 OK

# Test cross-user access (should fail)
curl -H "Authorization: Bearer $USER1_TOKEN" \
  https://api.staging.yourdomain.com/api/v1/work-orders?user_id=user2
# Expected: 403 Forbidden
```

#### Rate Limiting Tests
```bash
# Test auth endpoint rate limit (5/minute)
for i in {1..10}; do
  curl -X POST https://api.staging.yourdomain.com/api/v1/auth/login \
    -d '{"username":"test","password":"wrong"}'
done
# Expected: 429 Too Many Requests after 5 attempts
```

#### Security Headers Tests
```bash
# Check all security headers
curl -I https://api.staging.yourdomain.com/api/v1/health | grep -E \
  "X-Frame-Options|X-Content-Type-Options|Content-Security-Policy"
# Expected: All headers present
```

### 2. Load Testing

#### Prepare Load Test
```bash
# Install k6
brew install k6

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function() {
  let response = http.get('https://api.staging.yourdomain.com/api/v1/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF

# Run load test
k6 run load-test.js
```

### 3. Security Scanning

#### Run OWASP ZAP
```bash
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.staging.yourdomain.com
```

#### Check SSL/TLS
```bash
# Test SSL configuration
nmap --script ssl-enum-ciphers -p 443 api.yourdomain.com

# Check certificate
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com
```

---

## 🔄 Rollback Plan

### Automated Rollback Triggers
- Error rate > 5% for 5 minutes
- Response time > 2s for 50% of requests
- Security violation rate > 100/minute
- Database connection failures

### Manual Rollback Steps

#### 1. Kubernetes Rollback
```bash
# Check rollout history
kubectl rollout history deployment/api

# Rollback to previous version
kubectl rollout undo deployment/api

# Verify rollback
kubectl rollout status deployment/api
```

#### 2. Database Rollback
```bash
# Only if schema changed
alembic downgrade -1

# Restore from backup if needed
psql -h localhost -U fossawork -d fossawork_prod < backup_20250624_120000.sql
```

#### 3. Configuration Rollback
```bash
# Disable security features temporarily
BLOCK_LEGACY_AUTH=false
ENABLE_SECURITY_MIGRATION=false

# Restart services
kubectl rollout restart deployment/api
```

---

## 📊 Post-Deployment Monitoring

### Key Metrics to Monitor

#### 1. Security Metrics
```bash
# Authentication failures
grep "AUTH_FAILED" logs/security.log | wc -l

# Access denials  
grep "ACCESS_DENIED" logs/security.log | wc -l

# Security violations by IP
grep "SECURITY_EVENT" logs/security.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn
```

#### 2. Performance Metrics
```bash
# Average response time
grep "GET\|POST" logs/access.log | \
  awk '{sum+=$NF; count++} END {print sum/count}'

# Slow queries
grep "Slow query detected" logs/app.log

# Database connection pool
grep "connection pool" logs/app.log
```

#### 3. Error Rates
```bash
# HTTP error codes
grep -E "4[0-9]{2}|5[0-9]{2}" logs/access.log | \
  awk '{print $9}' | sort | uniq -c

# Application errors
grep "ERROR" logs/app.log | wc -l
```

### Monitoring Dashboard

Configure your monitoring tool (Datadog, New Relic, etc.) with:

1. **Security Dashboard**
   - Auth failure rate
   - Security violations/minute
   - Blocked IPs count
   - Rate limit hits

2. **Performance Dashboard**
   - Response time (p50, p95, p99)
   - Database query time
   - Request rate
   - Error rate

3. **Business Metrics**
   - Active users
   - Work orders processed
   - Automation success rate

### Alert Configuration

#### Critical Alerts (Page immediately)
- Authentication service down
- Database connection failures
- Security violation spike (>100/min)
- Error rate > 5%

#### Warning Alerts (Email/Slack)
- Slow query detected (>1s)
- Rate limit frequently hit
- Disk space < 20%
- Memory usage > 80%

---

## 🚨 Emergency Procedures

### Security Incident Response

#### 1. Detect
```bash
# Check for active attacks
tail -f logs/security.log | grep -E "CRITICAL|SUSPICIOUS"

# List blocked IPs
grep "IP_BLOCKED" logs/security.log | tail -20
```

#### 2. Respond
```bash
# Block attacking IP immediately
iptables -A INPUT -s $ATTACKER_IP -j DROP

# Or use cloud firewall
aws ec2 modify-security-group-rules --group-id $SG_ID \
  --security-group-rules "..."
```

#### 3. Investigate
```bash
# Analyze attack patterns
grep $ATTACKER_IP logs/*.log > attack_analysis.txt

# Check for data access
grep "CREDENTIAL_ACCESS" logs/security.log | grep $ATTACKER_IP
```

#### 4. Report
- Document incident timeline
- Identify affected users/data
- Prepare disclosure if required
- Update security rules

### Performance Degradation

#### Quick Fixes
```bash
# Clear query cache
redis-cli FLUSHDB

# Restart workers
kubectl rollout restart deployment/worker

# Scale up temporarily
kubectl scale deployment/api --replicas=10
```

---

## 📝 Deployment Checklist Summary

### Before Deployment
- [ ] Backup database
- [ ] Update dependencies  
- [ ] Configure environment variables
- [ ] Run security tests
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window
- [ ] Notify stakeholders

### During Deployment
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Check security headers
- [ ] Verify rate limiting
- [ ] Monitor error rates
- [ ] Deploy to production in stages
- [ ] Monitor all metrics

### After Deployment
- [ ] Verify all features working
- [ ] Check security logs
- [ ] Monitor performance
- [ ] Document any issues
- [ ] Update runbooks
- [ ] Schedule security review
- [ ] Plan next improvements

---

## 🆘 Support Contacts

- **Security Team:** security@yourdomain.com
- **DevOps On-Call:** +1-XXX-XXX-XXXX
- **Escalation Manager:** manager@yourdomain.com
- **24/7 NOC:** noc@yourdomain.com

---

## 📚 Additional Resources

- [OWASP Deployment Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [Security Headers Reference](https://securityheaders.com/)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

---

**Remember:** Security is not a one-time deployment. Continue monitoring, updating, and improving the security posture of FossaWork V2.
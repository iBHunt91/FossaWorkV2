# Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying FossaWork V2 across different environments (development, staging, production). It includes pre-deployment checks, deployment procedures, post-deployment validation, and rollback procedures.

## Deployment Types

### 1. Development Deployment
- **Frequency:** Continuous (with every commit)
- **Automation:** Fully automated
- **Validation:** Basic smoke tests
- **Rollback:** Git reset

### 2. Staging Deployment
- **Frequency:** Daily or on-demand
- **Automation:** Semi-automated with manual approval
- **Validation:** Full test suite
- **Rollback:** Automated rollback capability

### 3. Production Deployment
- **Frequency:** Weekly or emergency hotfixes
- **Automation:** Manual trigger, automated execution
- **Validation:** Comprehensive testing
- **Rollback:** Manual approval required

## Pre-Deployment Checklist

### Code Quality Verification

```bash
# Run all tests
cd /backend && python -m pytest tests/ -v
cd /frontend && npm test

# Code quality checks
cd /backend && flake8 app/
cd /frontend && npm run lint

# Security scan
python /tools/operations/security-scan.py --pre-deployment

# Dependency vulnerability check
cd /backend && safety check
cd /frontend && npm audit
```

### Environment Preparation

**Staging Environment:**
```bash
# Backup current staging data
python /tools/operations/backup-staging.py

# Update environment variables
cp .env.staging .env

# Verify resource availability
python /tools/operations/check-resources.py --staging
```

**Production Environment:**
```bash
# Create deployment backup
python /tools/operations/create-deployment-backup.py

# Verify maintenance window
python /tools/operations/verify-maintenance-window.py

# Check system resources
python /tools/operations/check-resources.py --production

# Verify external dependencies
python /tools/operations/check-external-deps.py
```

### Stakeholder Notification

**Pre-Deployment Communication:**
```bash
# Notify stakeholders
python /tools/operations/notify-deployment.py --pre-deployment \
  --environment=production \
  --estimated-downtime="15 minutes"
```

## Deployment Procedures

### Development Deployment

**Automated Workflow:**
```bash
#!/bin/bash
# /tools/operations/deploy-development.sh

set -e

echo "Starting development deployment..."

# Pull latest changes
git pull origin main

# Backend deployment
cd /backend
source venv/bin/activate
pip install -r requirements.txt
python -m pytest tests/ --tb=short
uvicorn app.main:app --reload --port 8000 &

# Frontend deployment
cd /frontend
npm install
npm run lint
npm run build
npm run dev &

echo "Development deployment completed"
```

### Staging Deployment

**Semi-Automated Workflow:**
```bash
#!/bin/bash
# /tools/operations/deploy-staging.sh

set -e

echo "Starting staging deployment..."

# Pre-deployment checks
python /tools/operations/pre-deployment-checks.py --staging

# Stop services
sudo systemctl stop fossawork-staging

# Backup current state
python /tools/operations/backup-staging.py

# Deploy new version
git checkout staging
git pull origin staging

# Backend deployment
cd /backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python -m pytest tests/ -v

# Frontend deployment
cd /frontend
npm install
npm run build:staging

# Start services
sudo systemctl start fossawork-staging

# Post-deployment validation
python /tools/operations/validate-deployment.py --staging

echo "Staging deployment completed"
```

### Production Deployment

**Manual Trigger, Automated Execution:**
```bash
#!/bin/bash
# /tools/operations/deploy-production.sh

set -e

echo "Starting production deployment..."

# Final verification
python /tools/operations/final-deployment-checks.py --production

# Enable maintenance mode
python /tools/operations/enable-maintenance-mode.py

# Create rollback point
python /tools/operations/create-rollback-point.py

# Stop services gracefully
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend

# Backup production data
python /tools/operations/backup-production.py

# Deploy new version
git checkout production
git pull origin production

# Database migration
cd /backend
source venv/bin/activate
python manage.py migrate --check
python manage.py migrate

# Backend deployment
pip install -r requirements.txt --no-deps
python -c "import app.main; print('Backend import successful')"

# Frontend deployment
cd /frontend
npm ci --production
npm run build:production

# Start services
sudo systemctl start fossawork-backend
sleep 10
sudo systemctl start fossawork-frontend

# Disable maintenance mode
python /tools/operations/disable-maintenance-mode.py

# Post-deployment validation
python /tools/operations/validate-deployment.py --production

echo "Production deployment completed"
```

## Database Migration Procedures

### Migration Safety Checks

```bash
# Verify migration scripts
python /backend/manage.py migrate --check

# Dry run migration
python /backend/manage.py migrate --dry-run

# Backup before migration
python /tools/operations/backup-database.py --pre-migration

# Execute migration with monitoring
python /tools/operations/migrate-with-monitoring.py
```

### Large Migration Handling

**For migrations affecting large datasets:**
```bash
# Estimate migration time
python /tools/operations/estimate-migration-time.py

# Schedule maintenance window
python /tools/operations/schedule-maintenance.py --duration=estimated_time

# Execute with progress monitoring
python /tools/operations/migrate-large-dataset.py --monitor --chunk-size=1000
```

## Post-Deployment Validation

### Automated Health Checks

```bash
#!/bin/bash
# /tools/operations/validate-deployment.py

set -e

echo "Starting post-deployment validation..."

# System health check
python /tools/operations/health-check.py --comprehensive

# Application functionality tests
python /tools/operations/smoke-tests.py

# Performance baseline verification
python /tools/operations/performance-baseline-check.py

# Security verification
python /tools/operations/security-post-deployment-check.py

# Database integrity check
python /tools/operations/verify-database-integrity.py

echo "Post-deployment validation completed"
```

### Manual Verification Steps

**Critical Path Testing:**
1. **Authentication Flow**
   - Login with valid credentials
   - Verify token generation
   - Test protected endpoints
   - Confirm logout functionality

2. **Core Functionality**
   - Work order creation/retrieval
   - Form automation execution
   - Data synchronization
   - Notification delivery

3. **Performance Verification**
   - Response time checks
   - Database query performance
   - Memory usage validation
   - Resource utilization review

4. **Security Validation**
   - SSL certificate verification
   - CORS policy enforcement
   - Rate limiting functionality
   - Input validation testing

### Monitoring Setup

```bash
# Enable enhanced monitoring
python /tools/operations/enable-post-deployment-monitoring.py

# Set deployment markers
python /tools/operations/mark-deployment.py --version=$(git rev-parse HEAD)

# Schedule health checks
python /tools/operations/schedule-health-checks.py --interval=5min --duration=24h
```

## Rollback Procedures

### Automatic Rollback Triggers

**Conditions for automatic rollback:**
- Health check failures for > 5 minutes
- Error rate > 10% for > 2 minutes
- Response time > 10 seconds for > 3 minutes
- Database connection failures

### Manual Rollback Decision

**Decision Matrix:**
| Issue | Severity | Time Limit | Action |
|-------|----------|------------|--------|
| Critical functionality broken | P1 | Immediate | Rollback |
| Performance degradation >50% | P2 | 15 minutes | Rollback if no fix |
| Minor feature issues | P3 | 2 hours | Fix forward |
| Cosmetic issues | P4 | Next deployment | Fix forward |

### Rollback Execution

**Development Rollback:**
```bash
# Simple git reset
git reset --hard HEAD~1
sudo systemctl restart fossawork-dev
```

**Staging Rollback:**
```bash
#!/bin/bash
# /tools/operations/rollback-staging.sh

echo "Starting staging rollback..."

# Stop services
sudo systemctl stop fossawork-staging

# Restore previous version
git checkout staging-previous
python /tools/operations/restore-staging-backup.py

# Restart services
sudo systemctl start fossawork-staging

# Verify rollback
python /tools/operations/validate-rollback.py --staging

echo "Staging rollback completed"
```

**Production Rollback:**
```bash
#!/bin/bash
# /tools/operations/rollback-production.sh

set -e

echo "PRODUCTION ROLLBACK INITIATED"

# Enable maintenance mode
python /tools/operations/enable-maintenance-mode.py

# Stop services
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend

# Restore from rollback point
python /tools/operations/restore-rollback-point.py

# Database rollback (if needed)
python /tools/operations/rollback-database.py --to-snapshot=pre-deployment

# Start services
sudo systemctl start fossawork-backend
sleep 10
sudo systemctl start fossawork-frontend

# Disable maintenance mode
python /tools/operations/disable-maintenance-mode.py

# Verify rollback
python /tools/operations/validate-rollback.py --production

echo "PRODUCTION ROLLBACK COMPLETED"
```

## Environment-Specific Configurations

### Development Environment

**Configuration:**
```yaml
# dev.config.yml
environment: development
debug: true
database_url: sqlite:///dev.db
log_level: DEBUG
cors_origins: ["http://localhost:3000", "http://localhost:5173"]
rate_limiting: disabled
```

**Deployment Commands:**
```bash
cd /backend && uvicorn app.main:app --reload --port 8000
cd /frontend && npm run dev
```

### Staging Environment

**Configuration:**
```yaml
# staging.config.yml
environment: staging
debug: false
database_url: postgresql://user:pass@staging-db:5432/fossawork_staging
log_level: INFO
cors_origins: ["https://staging.fossawork.com"]
rate_limiting: relaxed
```

**Deployment Commands:**
```bash
sudo systemctl restart fossawork-staging-backend
sudo systemctl restart fossawork-staging-frontend
```

### Production Environment

**Configuration:**
```yaml
# production.config.yml
environment: production
debug: false
database_url: postgresql://user:pass@prod-db:5432/fossawork_prod
log_level: WARNING
cors_origins: ["https://fossawork.com"]
rate_limiting: strict
security_headers: enabled
ssl_required: true
```

**Deployment Commands:**
```bash
sudo systemctl restart fossawork-backend
sudo systemctl restart fossawork-frontend
sudo systemctl restart nginx
```

## Maintenance Windows

### Scheduled Maintenance

**Planning:**
```bash
# Schedule maintenance window
python /tools/operations/schedule-maintenance.py \
  --start="2025-01-15 02:00:00" \
  --duration="2 hours" \
  --type="deployment"

# Notify users
python /tools/operations/notify-maintenance.py \
  --advance-notice="24 hours"
```

**Execution:**
```bash
# Enable maintenance mode
python /tools/operations/enable-maintenance-mode.py

# Perform deployment
bash /tools/operations/deploy-production.sh

# Disable maintenance mode
python /tools/operations/disable-maintenance-mode.py
```

### Emergency Maintenance

**Hotfix Deployment:**
```bash
#!/bin/bash
# /tools/operations/emergency-deployment.sh

set -e

echo "EMERGENCY DEPLOYMENT INITIATED"

# Skip normal approval process
export EMERGENCY_DEPLOYMENT=true

# Minimal validation
python /tools/operations/emergency-validation.py

# Deploy with minimal downtime
python /tools/operations/zero-downtime-deploy.py

# Enhanced monitoring
python /tools/operations/enable-emergency-monitoring.py

echo "EMERGENCY DEPLOYMENT COMPLETED"
```

## Security Considerations

### Deployment Security

**Secure Deployment Practices:**
```bash
# Verify deployment artifacts
python /tools/operations/verify-deployment-signatures.py

# Scan for vulnerabilities
python /tools/operations/security-scan-deployment.py

# Validate security configurations
python /tools/operations/validate-security-config.py
```

### Access Controls

**Deployment Permissions:**
- Development: All developers
- Staging: Senior developers + ops team
- Production: Ops team + approval required

**Audit Trail:**
```bash
# Log all deployment activities
python /tools/operations/log-deployment-activity.py \
  --user=$USER \
  --action="deployment" \
  --environment="production"
```

## Troubleshooting

### Common Deployment Issues

**Database Migration Failures:**
```bash
# Check migration status
python /backend/manage.py showmigrations

# Fix migration conflicts
python /tools/operations/fix-migration-conflicts.py

# Manual migration repair
python /tools/operations/repair-migration.py
```

**Service Startup Failures:**
```bash
# Check service status
sudo systemctl status fossawork-backend
sudo systemctl status fossawork-frontend

# View service logs
sudo journalctl -u fossawork-backend -f
sudo journalctl -u fossawork-frontend -f

# Restart services
sudo systemctl restart fossawork-backend
sudo systemctl restart fossawork-frontend
```

**Performance Issues Post-Deployment:**
```bash
# Performance analysis
python /tools/operations/analyze-performance.py --post-deployment

# Resource monitoring
python /tools/operations/monitor-resources.py --alert-threshold=80

# Database performance check
python /tools/operations/check-database-performance.py
```

## Documentation and Communication

### Deployment Documentation

**Required Documentation:**
- Pre-deployment checklist completion
- Deployment execution log
- Post-deployment validation results
- Any issues encountered and resolutions
- Performance metrics comparison

### Stakeholder Communication

**Communication Templates:**
```bash
# Pre-deployment notification
python /tools/operations/send-deployment-notice.py \
  --template="pre-deployment" \
  --environment="production" \
  --scheduled-time="2025-01-15 02:00 UTC"

# Deployment completion notification
python /tools/operations/send-deployment-notice.py \
  --template="deployment-complete" \
  --environment="production" \
  --status="successful"
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** DevOps Team
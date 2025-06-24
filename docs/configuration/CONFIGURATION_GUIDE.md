# FossaWork V2 Configuration Guide

## Table of Contents
1. [Overview](#overview)
2. [Environment Configuration](#environment-configuration)
3. [Configuration Files](#configuration-files)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Secret Management](#secret-management)
6. [Docker Configuration](#docker-configuration)
7. [Kubernetes Configuration](#kubernetes-configuration)
8. [Security Best Practices](#security-best-practices)
9. [Configuration Management](#configuration-management)
10. [Troubleshooting](#troubleshooting)

## Overview

FossaWork V2 uses a comprehensive configuration system that supports:
- Multiple environments (development, staging, production)
- External secret management providers
- Configuration validation and hot-reloading
- Docker and Kubernetes deployments
- Security-first design principles

### Configuration Hierarchy

1. **Default values** - Built into the application
2. **Configuration files** - `.env` files for each environment
3. **Environment variables** - Override file-based configuration
4. **Secret providers** - External secret management systems
5. **Runtime overrides** - Programmatic configuration changes

## Environment Configuration

### Development Environment

Located at: `/config/environments/development.env.template`

Key characteristics:
- Debug mode enabled
- Verbose logging
- CORS allows all origins
- Browser automation shows UI
- SQLite database
- Mock services available

```bash
# Copy and customize for development
cp config/environments/development.env.template backend/.env
```

### Staging Environment

Located at: `/config/environments/staging.env.template`

Key characteristics:
- Production-like setup
- PostgreSQL database
- Redis caching enabled
- SSL/TLS required
- Basic authentication
- Performance monitoring

```bash
# For staging deployment
cp config/environments/staging.env.template backend/.env.staging
```

### Production Environment

Located at: `/config/environments/production.env.template`

Key characteristics:
- Maximum security
- No debug information
- Strict CORS policies
- Full monitoring
- High availability
- Automated backups

```bash
# For production - use secret management
cp config/environments/production.env.template backend/.env.production
# DO NOT store actual secrets in this file
```

## Configuration Files

### Directory Structure

```
config/
├── environments/
│   ├── development.env.template
│   ├── staging.env.template
│   ├── production.env.template
│   └── security.env.template
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
└── kubernetes/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── secret.yaml
    └── ingress.yaml
```

### File Naming Convention

- `.env` - Default configuration
- `.env.{environment}` - Environment-specific configuration
- `.env.local` - Local overrides (never committed)
- `.env.{environment}.local` - Local environment overrides

## Environment Variables Reference

### Application Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `APP_NAME` | Application name | FossaWork V2 | No |
| `APP_VERSION` | Application version | 2.0.0 | No |
| `ENVIRONMENT` | Current environment | development | Yes |
| `DEBUG` | Debug mode | false | No |
| `LOG_LEVEL` | Logging level | INFO | No |

### API Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_HOST` | API bind host | 0.0.0.0 | No |
| `API_PORT` | API port | 8000 | No |
| `API_WORKERS` | Number of workers | 4 | No |
| `API_BASE_PATH` | API base path | /api | No |
| `API_DOCS_ENABLED` | Enable API docs | true | No |

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Database connection URL | - | Yes |
| `DATABASE_POOL_SIZE` | Connection pool size | 20 | No |
| `DATABASE_POOL_TIMEOUT` | Pool timeout (seconds) | 30 | No |
| `DATABASE_POOL_RECYCLE` | Connection recycle time | 1800 | No |

### Security Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | JWT signing key | - | Yes |
| `FOSSAWORK_MASTER_KEY` | Credential encryption key | - | Yes |
| `JWT_ALGORITHM` | JWT algorithm | HS256 | No |
| `JWT_EXPIRATION_HOURS` | Token expiration | 24 | No |

### Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_ENABLED` | Enable rate limiting | true | No |
| `AUTH_RATE_LIMIT_ATTEMPTS` | Auth attempts limit | 5 | No |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | Rate limit window | 15 | No |
| `API_RATE_LIMIT_PER_MINUTE` | API calls per minute | 100 | No |

### Browser Automation

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BROWSER_HEADLESS` | Run browser headless | true | No |
| `BROWSER_TIMEOUT` | Browser timeout (ms) | 30000 | No |
| `BROWSER_MAX_INSTANCES` | Max browser instances | 5 | No |
| `BROWSER_SCREENSHOT_DIR` | Screenshot directory | data/screenshots | No |

### Email Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SMTP_ENABLED` | Enable email sending | false | No |
| `SMTP_HOST` | SMTP server host | - | If enabled |
| `SMTP_PORT` | SMTP server port | 587 | No |
| `SMTP_USERNAME` | SMTP username | - | If enabled |
| `SMTP_PASSWORD` | SMTP password | - | If enabled |
| `SMTP_FROM` | From email address | noreply@fossawork.com | No |

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_BROWSER_AUTOMATION` | Browser automation feature | true |
| `ENABLE_EMAIL_NOTIFICATIONS` | Email notifications | true |
| `ENABLE_PUSHOVER_NOTIFICATIONS` | Pushover notifications | true |
| `ENABLE_SCHEDULE_DETECTION` | Schedule detection | true |
| `ENABLE_FILTER_CALCULATION` | Filter calculation | true |
| `ENABLE_SECURITY_MONITORING` | Security monitoring | true |
| `ENABLE_AUDIT_LOGGING` | Audit logging | true |

## Secret Management

### Local Development

For local development, use `.env` files with test values:

```bash
# Generate secure keys for development
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Production Secrets

**Never store production secrets in files!** Use one of these providers:

#### AWS Secrets Manager

```bash
# Store secrets
aws secretsmanager create-secret \
  --name fossawork/production \
  --secret-string '{
    "SECRET_KEY": "your-secret-key",
    "FOSSAWORK_MASTER_KEY": "your-master-key",
    "DATABASE_URL": "postgresql://..."
  }'

# Configure application
export SECRET_PROVIDER=aws_secrets_manager
export AWS_REGION=us-east-1
```

#### HashiCorp Vault

```bash
# Store secrets
vault kv put secret/fossawork/production \
  SECRET_KEY="your-secret-key" \
  FOSSAWORK_MASTER_KEY="your-master-key"

# Configure application
export SECRET_PROVIDER=hashicorp_vault
export VAULT_URL=https://vault.company.com
export VAULT_TOKEN=your-token
```

#### Kubernetes Secrets

```yaml
# Create secret
kubectl create secret generic fossawork-secrets \
  --from-literal=SECRET_KEY=your-secret-key \
  --from-literal=FOSSAWORK_MASTER_KEY=your-master-key \
  -n fossawork
```

### Secret Rotation

Enable automatic secret rotation:

```bash
export SECRET_ROTATION_ENABLED=true
export SECRET_ROTATION_INTERVAL_DAYS=90
```

## Docker Configuration

### Development Setup

```bash
# Start development environment
docker-compose -f config/docker/docker-compose.yml \
               -f config/docker/docker-compose.dev.yml \
               up -d

# View logs
docker-compose logs -f backend

# Access services
# - API: http://localhost:8000
# - Frontend: http://localhost:5173
# - MailHog: http://localhost:8025
# - pgAdmin: http://localhost:5050
```

### Production Deployment

```bash
# Build images
docker build -f config/docker/Dockerfile.backend -t fossawork/backend:v2.0.0 .
docker build -f config/docker/Dockerfile.frontend -t fossawork/frontend:v2.0.0 .

# Deploy with production config
docker-compose -f config/docker/docker-compose.yml \
               -f config/docker/docker-compose.prod.yml \
               up -d
```

### Docker Environment Variables

Pass environment variables to containers:

```yaml
# docker-compose.override.yml
services:
  backend:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SECRET_KEY_FILE=/run/secrets/secret_key
    secrets:
      - secret_key
```

## Kubernetes Configuration

### ConfigMap Setup

```bash
# Create ConfigMap from file
kubectl create configmap fossawork-config \
  --from-env-file=config/environments/production.env \
  -n fossawork

# Update ConfigMap
kubectl create configmap fossawork-config \
  --from-env-file=config/environments/production.env \
  -n fossawork \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Secret Management

```bash
# Create secrets (use external secret operator in production)
kubectl create secret generic fossawork-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=secret-key='...' \
  -n fossawork

# Using External Secrets Operator
kubectl apply -f config/kubernetes/external-secret.yaml
```

### Deployment

```bash
# Create namespace
kubectl create namespace fossawork

# Apply configurations
kubectl apply -f config/kubernetes/configmap.yaml
kubectl apply -f config/kubernetes/secret.yaml
kubectl apply -f config/kubernetes/deployment.yaml
kubectl apply -f config/kubernetes/service.yaml
kubectl apply -f config/kubernetes/ingress.yaml

# Check status
kubectl get all -n fossawork
```

## Security Best Practices

### 1. Secret Generation

Always use cryptographically secure methods:

```python
# Generate secure secrets
import secrets

# For SECRET_KEY and FOSSAWORK_MASTER_KEY
print(secrets.token_urlsafe(32))

# For API keys
print(secrets.token_hex(32))
```

### 2. Environment Isolation

- Never use production credentials in development
- Use separate databases for each environment
- Implement network segmentation
- Use least-privilege access controls

### 3. Configuration Validation

The application validates configuration on startup:

```python
# Automatic validation
- Debug mode disabled in production
- CORS properly configured
- Rate limiting enabled
- Strong secrets required
```

### 4. Secure Defaults

Production defaults are secure by design:
- HTTPS required
- Strict CSP headers
- Rate limiting enabled
- Audit logging active
- Security monitoring on

### 5. Access Control

Limit configuration access:
```bash
# File permissions
chmod 600 .env.production
chown app:app .env.production

# Kubernetes RBAC
kubectl create rolebinding config-reader \
  --clusterrole=view \
  --user=fossawork-app \
  -n fossawork
```

## Configuration Management

### Hot Reloading

Enable configuration hot-reloading:

```python
# In code
from app.core.config_manager import get_config_manager

config = get_config_manager()
config.watch_changes = True

# Via environment
export CONFIG_WATCH_CHANGES=true
```

### Runtime Updates

Update configuration at runtime:

```python
# Get configuration
config = get_config_manager()
settings = config.get_settings()

# Update value (not persisted)
config.set("log_level", "DEBUG")

# Reload from files
config.reload()
```

### Configuration Export

Export current configuration:

```python
# Export without secrets
config_dict = config.export_config(include_secrets=False)

# Health check
health = config.health_check()
```

## Troubleshooting

### Common Issues

#### 1. Missing Environment Variables

```bash
# Check current environment
printenv | grep FOSSAWORK

# Validate .env file
python -c "from app.core.config_manager import get_settings; print(get_settings())"
```

#### 2. Secret Loading Failures

```bash
# Test AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id fossawork/production

# Test Vault connection
vault kv get secret/fossawork/production
```

#### 3. Configuration Validation Errors

```python
# Debug validation
from app.core.config_manager import ConfigurationManager

try:
    config = ConfigurationManager()
except ValueError as e:
    print(f"Validation errors: {e}")
```

#### 4. Docker Environment Issues

```bash
# Inspect container environment
docker exec fossawork_backend env | sort

# Check mounted secrets
docker exec fossawork_backend ls -la /run/secrets/
```

### Debug Mode

Enable verbose configuration logging:

```bash
export LOG_LEVEL=DEBUG
export CONFIG_DEBUG=true
```

### Configuration Dumps

Generate configuration report:

```python
# Full configuration dump
from app.core.config_manager import get_config_manager
import json

config = get_config_manager()
report = {
    "environment": config.environment,
    "config_file": config.env_file,
    "settings": config.export_config(include_secrets=False),
    "health": config.health_check()
}

print(json.dumps(report, indent=2))
```

## Best Practices Summary

1. **Use environment-specific files** - Separate configuration for each environment
2. **Never commit secrets** - Use external secret management
3. **Validate early** - Catch configuration errors at startup
4. **Monitor configuration** - Log configuration changes
5. **Rotate secrets regularly** - Implement automated rotation
6. **Use secure defaults** - Make production secure by default
7. **Document everything** - Keep configuration documentation updated
8. **Test configuration** - Validate in staging before production
9. **Implement least privilege** - Limit access to configuration
10. **Audit configuration changes** - Track who changed what and when
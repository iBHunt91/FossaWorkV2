# FossaWork V2 CI/CD Pipeline Guide

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Security Gates](#security-gates)
4. [Deployment Strategies](#deployment-strategies)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Getting Started](#getting-started)
8. [Troubleshooting](#troubleshooting)

## Overview

This guide covers the comprehensive CI/CD pipeline implementation for FossaWork V2, featuring advanced security scanning, automated testing, and production-ready deployment strategies.

### Key Features

- **Multi-Platform Support**: GitHub Actions and Jenkins pipelines
- **Comprehensive Security**: SAST, DAST, dependency scanning, container security
- **Blue-Green Deployments**: Zero-downtime production deployments
- **Infrastructure as Code**: Terraform for AWS infrastructure
- **Configuration Management**: Ansible for application deployment
- **Monitoring Integration**: CloudWatch, Prometheus, and custom metrics

## Pipeline Architecture

### GitHub Actions Workflows

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Code Push     │───▶│  Security Scan  │───▶│   Test Suite    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Build & Push   │◄───│  Quality Gate   │◄───│  Code Quality   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Deploy Staging│───▶│   Deploy Prod   │───▶│   Post Deploy   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Jenkins Pipeline Stages

1. **Checkout**: Source code retrieval
2. **Validate**: Environment and dependency checks
3. **Quality Analysis**: Parallel SAST, linting, and complexity analysis
4. **Test**: Unit, integration, API, and security tests
5. **Build**: Docker image creation and registry push
6. **Security Scan**: Container and infrastructure scanning
7. **Quality Gate**: SonarQube quality validation
8. **Deploy**: Environment-specific deployment
9. **E2E Tests**: End-to-end validation
10. **Notifications**: Team alerts and reporting

## Security Gates

### Static Application Security Testing (SAST)

**Tools Integrated:**
- **Bandit**: Python security linter
- **Semgrep**: Multi-language static analysis
- **ESLint Security**: JavaScript/TypeScript security rules
- **CodeQL**: GitHub's semantic code analysis

**Configuration Example:**
```yaml
- name: Run Bandit Security Scanner
  run: |
    pip install bandit[toml]
    bandit -r backend/ -ll -f json -o bandit-report.json
```

### Dynamic Application Security Testing (DAST)

**Tools Integrated:**
- **OWASP ZAP**: Web application security scanner
- **Nuclei**: Fast vulnerability scanner

**Usage:**
```bash
# Start application in test mode
docker-compose -f docker-compose.test.yml up -d

# Run OWASP ZAP scan
docker run --rm -v $(pwd):/zap/wrk/:rw \
  --network=host \
  owasp/zap2docker-stable:latest \
  zap-baseline.py -t http://localhost:8000
```

### Dependency Vulnerability Scanning

**Python Dependencies:**
- **Safety**: Known vulnerability database
- **Pip-audit**: Python package auditing
- **Snyk**: Commercial vulnerability scanner

**JavaScript Dependencies:**
- **npm audit**: Built-in npm security auditing
- **Snyk**: Multi-language vulnerability scanning
- **RetireJS**: JavaScript library vulnerability scanner

### Container Security

**Tools:**
- **Trivy**: Comprehensive vulnerability scanner
- **Grype**: Container image vulnerability scanner
- **Docker Bench Security**: Docker security best practices

### Infrastructure Security

**Tools:**
- **Checkov**: Terraform/CloudFormation security scanner
- **Terrascan**: Infrastructure as Code security scanner
- **TruffleHog**: Secret detection
- **Gitleaks**: Git repository secret scanner

## Deployment Strategies

### Blue-Green Deployment

Blue-Green deployment ensures zero-downtime deployments by maintaining two identical production environments.

**Process:**
1. **Blue Environment**: Current production
2. **Green Environment**: New version deployment
3. **Switch Traffic**: Update load balancer to green
4. **Verification**: Health checks and monitoring
5. **Rollback**: Quick switch back to blue if issues

**Implementation:**
```bash
# Deploy to green environment
aws ecs update-service \
  --cluster fossawork-production-green \
  --service fossawork-api \
  --desired-count 3

# Switch traffic to green
aws elbv2 modify-listener \
  --listener-arn $ALB_LISTENER_ARN \
  --default-actions Type=forward,TargetGroupArn=$GREEN_TARGET_GROUP
```

### Canary Deployment

Gradual rollout strategy for risk mitigation.

**Configuration:**
```yaml
# Canary deployment with 10% traffic
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: fossawork-backend
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 5m}
      - setWeight: 50
      - pause: {duration: 10m}
      - setWeight: 100
```

### Rolling Deployment

Standard Kubernetes rolling update for non-critical updates.

**Configuration:**
```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## Rollback Procedures

### Automated Rollback Triggers

1. **Health Check Failures**: 3 consecutive failed health checks
2. **Error Rate Spike**: Error rate > 5% for 5 minutes
3. **Response Time Degradation**: P95 response time > 3 seconds
4. **Security Alert**: Critical security finding detected

### Manual Rollback Process

**Using CI Scripts:**
```bash
# Rollback to previous version
./ci/scripts/rollback-deployment.sh -e production -f

# Rollback to specific version
./ci/scripts/rollback-deployment.sh -e production -v v1.2.3
```

**Kubernetes Rollback:**
```bash
# Rollback deployment
kubectl rollout undo deployment/fossawork-backend -n production

# Rollback to specific revision
kubectl rollout undo deployment/fossawork-backend --to-revision=2 -n production
```

### Emergency Rollback

**Immediate Actions:**
1. **Stop Traffic**: Disable load balancer health checks
2. **Restore Previous**: Switch to previous known-good version
3. **Verify Health**: Confirm application stability
4. **Notify Team**: Alert all stakeholders
5. **Investigate**: Root cause analysis

## Monitoring & Alerting

### Key Metrics

**Application Metrics:**
- Response time (P50, P95, P99)
- Error rate (4xx, 5xx)
- Throughput (requests per second)
- Database connection pool usage
- Cache hit ratio

**Infrastructure Metrics:**
- CPU and memory utilization
- Disk I/O and network bandwidth
- Container resource usage
- Load balancer health

**Security Metrics:**
- Failed authentication attempts
- WAF blocked requests
- Security scan findings
- Certificate expiry dates

### Alert Configuration

**Critical Alerts (PagerDuty):**
```yaml
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    duration: "5m"
    severity: "critical"
  
  - name: "Service Down"
    condition: "up == 0"
    duration: "1m"
    severity: "critical"
```

**Warning Alerts (Slack):**
```yaml
alerts:
  - name: "High Response Time"
    condition: "response_time_p95 > 2s"
    duration: "10m"
    severity: "warning"
```

### Dashboards

**Application Dashboard:**
- Request volume and response times
- Error rates by endpoint
- Database performance metrics
- Cache performance

**Infrastructure Dashboard:**
- EKS cluster health
- Node resource utilization
- Load balancer metrics
- Database connections

**Security Dashboard:**
- WAF blocked requests
- Failed authentication attempts
- Security scan results
- Compliance status

## Getting Started

### Prerequisites

1. **AWS Account**: With appropriate permissions
2. **GitHub Account**: For Actions workflows
3. **Docker**: For local development and testing
4. **kubectl**: Kubernetes command-line tool
5. **Terraform**: Infrastructure provisioning
6. **Ansible**: Configuration management

### Initial Setup

1. **Clone Repository:**
```bash
git clone https://github.com/fossawork/fossawork-v2.git
cd fossawork-v2
```

2. **Configure AWS Credentials:**
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

3. **Deploy Infrastructure:**
```bash
cd deployment/terraform
terraform init
terraform plan -var-file="environments/staging.tfvars"
terraform apply
```

4. **Configure CI/CD Secrets:**

**GitHub Secrets:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
- `SONAR_TOKEN`
- `SNYK_TOKEN`

5. **First Deployment:**
```bash
# Trigger deployment via GitHub Actions
git tag v1.0.0
git push origin v1.0.0
```

### Environment Configuration

**Staging Environment:**
```bash
cd deployment/ansible
ansible-playbook -i inventory/staging.yml playbook-deploy.yml
```

**Production Environment:**
```bash
cd deployment/ansible
ansible-playbook -i inventory/production.yml playbook-deploy.yml
```

## Troubleshooting

### Common Issues

**1. Build Failures**
```bash
# Check build logs
kubectl logs -f deployment/fossawork-backend -n staging

# Verify image exists
docker pull ghcr.io/fossawork/backend:latest
```

**2. Security Scan Failures**
```bash
# Run security scan locally
./ci/scripts/run-security-scan.sh -t quick

# Check specific tool output
bandit -r backend/ -ll
```

**3. Deployment Failures**
```bash
# Check deployment status
kubectl get deployments -n staging
kubectl describe deployment fossawork-backend -n staging

# Verify service connectivity
kubectl get services -n staging
kubectl get endpoints -n staging
```

**4. Performance Issues**
```bash
# Check resource usage
kubectl top pods -n staging
kubectl top nodes

# Review metrics
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

### Debug Commands

**Application Logs:**
```bash
# Backend logs
kubectl logs -f deployment/fossawork-backend -n staging

# Frontend logs
kubectl logs -f deployment/fossawork-frontend -n staging

# Previous container logs
kubectl logs deployment/fossawork-backend -n staging --previous
```

**Network Debugging:**
```bash
# Test service connectivity
kubectl exec -it deployment/fossawork-backend -n staging -- curl http://fossawork-frontend
```

**Database Connectivity:**
```bash
# Test database connection
kubectl exec -it deployment/fossawork-backend -n staging -- \
  python -c "import psycopg2; conn = psycopg2.connect('$DATABASE_URL'); print('Connected')"
```

### Support Contacts

- **DevOps Team**: devops@fossawork.com
- **Security Team**: security@fossawork.com
- **On-Call Engineer**: +1-555-ON-CALL

### Additional Resources

- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Ansible Documentation](https://docs.ansible.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

*Last Updated: January 2025*
*Version: 2.0*
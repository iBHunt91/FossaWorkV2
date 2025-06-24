# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to security incidents in FossaWork V2. It covers detection, containment, investigation, recovery, and post-incident activities.

## Incident Classification

### Severity Levels

**P1 - Critical (Response Time: Immediate)**
- Active security breach
- System completely inaccessible
- Data corruption or loss
- Authentication system compromised
- Ransomware or malware detected

**P2 - High (Response Time: 15 minutes)**
- Suspicious authentication patterns
- Elevated privilege escalation attempts
- Performance severely degraded
- Partial system outage
- Failed backup validation

**P3 - Medium (Response Time: 1 hour)**
- Anomalous user behavior
- Non-critical security alerts
- Performance degradation
- Individual component failures
- Configuration drift detected

**P4 - Low (Response Time: 4 hours)**
- Security information events
- Maintenance notifications
- Performance warnings
- Non-critical errors

## Initial Response Procedures

### Step 1: Incident Detection and Verification

**Automated Detection Sources:**
- Security monitoring alerts
- Performance threshold violations
- Authentication failure spikes
- Error rate increases
- System health check failures

**Manual Detection Sources:**
- User reports
- Monitoring dashboard observations
- Log analysis findings
- External security notifications

**Verification Checklist:**
```bash
# Verify system accessibility
curl -f http://localhost:8000/api/health
curl -f http://localhost:5173/

# Check authentication system
python -c "
import requests
response = requests.post('http://localhost:8000/api/auth/login', 
    json={'username': 'test', 'password': 'test'})
print(f'Auth Status: {response.status_code}')
"

# Review recent logs
python /tools/operations/log-analyzer.py --errors --last-hour

# Check system resources
df -h
free -h
ps aux | head -20
```

### Step 2: Incident Declaration

**Decision Matrix:**
| Condition | Severity | Action |
|-----------|----------|--------|
| System completely down | P1 | Immediate escalation |
| Security breach confirmed | P1 | Security team activation |
| Data integrity compromised | P1 | Immediate containment |
| Performance >10s response | P2 | Investigation team |
| Individual user issues | P3 | Standard support |

**Declaration Actions:**
1. **Document Initial Findings**
   - Time of detection
   - Affected systems/users
   - Symptoms observed
   - Initial severity assessment

2. **Notify Stakeholders**
   - Security team (for security incidents)
   - Operations team (for system incidents)
   - Business stakeholders (for P1/P2)

3. **Create Incident Record**
   ```bash
   # Create incident log
   echo "$(date): INCIDENT DECLARED - [SEVERITY] - [DESCRIPTION]" >> /logs/incidents/incident-$(date +%Y%m%d-%H%M%S).log
   ```

## Security Incident Response

### Containment Procedures

**Immediate Actions (First 5 minutes):**

1. **Isolate Affected Systems**
   ```bash
   # Stop vulnerable services
   sudo systemctl stop fossawork-backend
   sudo systemctl stop fossawork-frontend
   
   # Block suspicious IPs (if applicable)
   sudo iptables -A INPUT -s [SUSPICIOUS_IP] -j DROP
   ```

2. **Preserve Evidence**
   ```bash
   # Create memory dump (if system accessible)
   sudo dd if=/dev/mem of=/tmp/memory-dump-$(date +%Y%m%d-%H%M%S).bin
   
   # Capture current state
   ps aux > /tmp/processes-$(date +%Y%m%d-%H%M%S).txt
   netstat -tulpn > /tmp/network-$(date +%Y%m%d-%H%M%S).txt
   
   # Backup logs before they rotate
   cp -r /logs /tmp/incident-logs-$(date +%Y%m%d-%H%M%S)/
   ```

3. **Secure Credentials**
   ```bash
   # Rotate JWT secret
   python /tools/operations/rotate-jwt-secret.py
   
   # Disable compromised accounts
   python /tools/operations/disable-accounts.py --compromised
   
   # Force re-authentication
   python /tools/operations/invalidate-all-tokens.py
   ```

### Investigation Procedures

**Evidence Collection:**

1. **Log Analysis**
   ```bash
   # Security events
   python /tools/operations/security-monitor.py --investigate --timerange="last-24h"
   
   # Authentication patterns
   grep -E "(login|auth|token)" /logs/backend/backend-*.jsonl | tail -100
   
   # Suspicious activities
   python /tools/operations/log-analyzer.py --suspicious --detailed
   ```

2. **System Forensics**
   ```bash
   # File integrity check
   find /backend -type f -name "*.py" -exec md5sum {} \; > /tmp/file-hashes.txt
   
   # Recent file modifications
   find /backend -type f -mtime -1 -ls
   
   # Network connections
   lsof -i -P -n
   ```

3. **Database Analysis**
   ```bash
   # Check for unauthorized data access
   python -c "
   from backend.app.database import get_db
   # Query access logs, user activities, data modifications
   "
   
   # Verify data integrity
   python /tools/operations/verify-data-integrity.py
   ```

### Recovery Procedures

**Clean Recovery Steps:**

1. **System Restoration**
   ```bash
   # Restore from clean backup
   python /tools/operations/restore-from-backup.py --timestamp=[CLEAN_BACKUP]
   
   # Verify system integrity
   python /tools/operations/health-check.py --comprehensive
   
   # Update all dependencies
   cd /backend && pip install -r requirements.txt --upgrade
   cd /frontend && npm update
   ```

2. **Security Hardening**
   ```bash
   # Apply security patches
   python /tools/operations/apply-security-patches.py
   
   # Reset all authentication
   python /tools/operations/reset-auth-system.py
   
   # Update security configurations
   python /tools/operations/update-security-config.py
   ```

3. **Monitoring Enhancement**
   ```bash
   # Increase monitoring sensitivity
   python /tools/operations/enhance-monitoring.py --incident-mode
   
   # Deploy additional security monitoring
   python /tools/operations/deploy-security-monitoring.py
   ```

## Communication Procedures

### Internal Communication

**Incident Commander Role:**
- Single point of coordination
- Decision-making authority
- Stakeholder communication
- Resource allocation

**Communication Channels:**
- **Primary:** Secure messaging platform
- **Secondary:** Email for documentation
- **Emergency:** Phone calls for P1 incidents

**Status Updates:**
- **P1:** Every 15 minutes
- **P2:** Every 30 minutes
- **P3:** Every 2 hours
- **Resolution:** Immediate notification

### External Communication

**Customer Notification:**
- **Timing:** Within 1 hour of incident declaration
- **Content:** Impact description, expected resolution time
- **Updates:** Every 2 hours until resolution

**Regulatory Notification:**
- **Data Breach:** Within 72 hours (if applicable)
- **Compliance:** As required by industry standards

## Post-Incident Activities

### Immediate Post-Resolution (Within 24 hours)

1. **System Verification**
   ```bash
   # Comprehensive health check
   python /tools/operations/health-check.py --full-verification
   
   # Performance validation
   python /tools/operations/performance-monitor.py --baseline
   
   # Security scan
   python /tools/operations/security-monitor.py --full-scan
   ```

2. **Evidence Preservation**
   ```bash
   # Archive incident data
   tar -czf /archives/incident-$(date +%Y%m%d-%H%M%S).tar.gz /tmp/incident-*
   
   # Document timeline
   echo "Incident Timeline: [DETAILS]" > /archives/incident-timeline-$(date +%Y%m%d).md
   ```

### Post-Incident Review (Within 1 week)

**Review Meeting Agenda:**
1. Incident timeline review
2. Response effectiveness analysis
3. Communication assessment
4. System vulnerability analysis
5. Process improvement identification

**Deliverables:**
- Post-incident report
- Lessons learned document
- Process improvement plan
- Security enhancement recommendations

### Long-term Follow-up (Within 1 month)

1. **Implement Improvements**
   - Update detection systems
   - Enhance monitoring
   - Improve response procedures
   - Strengthen security controls

2. **Training Updates**
   - Update incident response training
   - Conduct tabletop exercises
   - Refresh documentation
   - Test communication procedures

## Incident Response Tools

### Automated Response Scripts

**Emergency Shutdown:**
```bash
#!/bin/bash
# /tools/operations/emergency-shutdown.sh
echo "EMERGENCY SHUTDOWN INITIATED"
sudo systemctl stop fossawork-backend
sudo systemctl stop fossawork-frontend
sudo systemctl stop fossawork-database
echo "All services stopped"
```

**Evidence Collection:**
```bash
#!/bin/bash
# /tools/operations/collect-evidence.sh
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /tmp/evidence-$TIMESTAMP
cp -r /logs /tmp/evidence-$TIMESTAMP/
ps aux > /tmp/evidence-$TIMESTAMP/processes.txt
netstat -tulpn > /tmp/evidence-$TIMESTAMP/network.txt
echo "Evidence collected in /tmp/evidence-$TIMESTAMP/"
```

### Manual Response Checklists

**P1 Incident Checklist:**
- [ ] Verify incident severity
- [ ] Notify incident commander
- [ ] Isolate affected systems
- [ ] Preserve evidence
- [ ] Begin containment
- [ ] Communicate to stakeholders
- [ ] Document all actions

**Security Breach Checklist:**
- [ ] Stop the attack
- [ ] Preserve evidence
- [ ] Assess damage
- [ ] Contain the breach
- [ ] Eliminate vulnerabilities
- [ ] Recover and monitor
- [ ] Report and learn

## Contact Information

### Escalation Contacts

**Incident Commander:** [CONFIGURE]
- Primary: +1-XXX-XXX-XXXX
- Secondary: incident-commander@company.com

**Security Team Lead:** [CONFIGURE]
- Primary: +1-XXX-XXX-XXXX
- Secondary: security-lead@company.com

**System Administrator:** [CONFIGURE]
- Primary: +1-XXX-XXX-XXXX
- Secondary: sysadmin@company.com

### External Contacts

**Legal Counsel:** [CONFIGURE]
**Cyber Security Insurance:** [CONFIGURE]
**Law Enforcement (if required):** Local FBI Cyber Crime Unit

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Security Team
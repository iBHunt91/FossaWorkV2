#!/usr/bin/env python3
"""
FossaWork V2 Security Audit Logger
Real-time security event monitoring and compliance logging
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
import hashlib
import uuid
from enum import Enum
import sqlite3
import threading
from contextlib import contextmanager

class SecurityEventType(Enum):
    """Security event types for classification"""
    AUTHENTICATION_SUCCESS = "auth_success"
    AUTHENTICATION_FAILURE = "auth_failure"
    AUTHORIZATION_DENIED = "authz_denied"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    SECURITY_VIOLATION = "security_violation"
    SYSTEM_COMPROMISE = "system_compromise"
    COMPLIANCE_VIOLATION = "compliance_violation"
    CONFIGURATION_CHANGE = "config_change"
    FILE_ACCESS = "file_access"
    NETWORK_ACTIVITY = "network_activity"
    ERROR_EVENT = "error_event"
    AUDIT_EVENT = "audit_event"

class SecurityEventSeverity(Enum):
    """Security event severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class ComplianceStandard(Enum):
    """Compliance standards for audit logging"""
    GDPR = "gdpr"
    PCI_DSS = "pci_dss"
    SOC2 = "soc2"
    HIPAA = "hipaa"
    ISO27001 = "iso27001"
    NIST = "nist"

class SecurityAuditLogger:
    """Real-time security event monitoring and audit logging"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent.parent.parent.parent
        self.audit_dir = self.project_root / "security" / "audit_logs"
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize databases
        self.audit_db_path = self.audit_dir / "security_audit.db"
        self.compliance_db_path = self.audit_dir / "compliance_audit.db"
        
        self._init_databases()
        self._setup_logging()
        
        # Event tracking
        self.session_id = str(uuid.uuid4())
        self.event_queue = asyncio.Queue()
        self.monitoring_active = False
        self.lock = threading.Lock()
        
        # Compliance requirements
        self.compliance_rules = self._load_compliance_rules()
        
        # Suspicious activity detection
        self.failed_attempts = {}
        self.suspicious_patterns = {}
        
    def _init_databases(self):
        """Initialize audit databases"""
        # Security audit database
        with sqlite3.connect(self.audit_db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS security_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    session_id TEXT,
                    event_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    source TEXT,
                    user_id TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    endpoint TEXT,
                    method TEXT,
                    status_code INTEGER,
                    message TEXT,
                    details TEXT,
                    risk_score INTEGER,
                    compliance_standards TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS audit_trail (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    action TEXT NOT NULL,
                    resource TEXT,
                    old_value TEXT,
                    new_value TEXT,
                    user_id TEXT,
                    reason TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS suspicious_activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern_id TEXT NOT NULL,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL,
                    occurrence_count INTEGER DEFAULT 1,
                    source_ip TEXT,
                    user_agent TEXT,
                    pattern_type TEXT,
                    severity TEXT,
                    details TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
                CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
                CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp);
                CREATE INDEX IF NOT EXISTS idx_suspicious_activity_pattern ON suspicious_activity(pattern_id);
            """)
        
        # Compliance audit database
        with sqlite3.connect(self.compliance_db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS compliance_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    standard TEXT NOT NULL,
                    requirement TEXT NOT NULL,
                    status TEXT NOT NULL,
                    evidence TEXT,
                    details TEXT,
                    remediation TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS data_processing_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    data_subject_id TEXT,
                    processing_purpose TEXT,
                    data_categories TEXT,
                    legal_basis TEXT,
                    retention_period TEXT,
                    processor TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS consent_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    data_subject_id TEXT,
                    consent_type TEXT,
                    consent_status TEXT,
                    purpose TEXT,
                    withdrawn_date TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_compliance_events_standard ON compliance_events(standard);
                CREATE INDEX IF NOT EXISTS idx_compliance_events_timestamp ON compliance_events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_data_processing_timestamp ON data_processing_log(timestamp);
                CREATE INDEX IF NOT EXISTS idx_consent_log_subject ON consent_log(data_subject_id);
            """)
    
    def _setup_logging(self):
        """Setup audit logging configuration"""
        log_file = self.audit_dir / f"security_audit_{datetime.now().strftime('%Y%m%d')}.log"
        
        # Configure structured logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        self.logger = logging.getLogger("SecurityAuditLogger")
    
    def _load_compliance_rules(self) -> Dict[str, Any]:
        """Load compliance rules and requirements"""
        return {
            ComplianceStandard.GDPR.value: {
                "data_retention": 365,  # days
                "consent_required": True,
                "breach_notification": 72,  # hours
                "required_logs": ["data_access", "data_modification", "consent_changes"]
            },
            ComplianceStandard.PCI_DSS.value: {
                "log_retention": 365,  # days
                "access_monitoring": True,
                "change_tracking": True,
                "required_logs": ["authentication", "authorization", "data_access"]
            },
            ComplianceStandard.SOC2.value: {
                "monitoring_required": True,
                "incident_response": True,
                "access_reviews": True,
                "required_logs": ["security_events", "system_changes", "access_logs"]
            }
        }
    
    async def start_monitoring(self):
        """Start real-time security monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        
        # Start event processing task
        asyncio.create_task(self._process_event_queue())
        
        self.logger.info(f"Security monitoring started - Session: {self.session_id}")
        
        # Log monitoring start event
        await self.log_security_event(
            event_type=SecurityEventType.AUDIT_EVENT,
            severity=SecurityEventSeverity.INFO,
            message="Security monitoring started",
            details={"session_id": self.session_id}
        )
    
    async def stop_monitoring(self):
        """Stop security monitoring"""
        self.monitoring_active = False
        
        self.logger.info(f"Security monitoring stopped - Session: {self.session_id}")
        
        # Log monitoring stop event
        await self.log_security_event(
            event_type=SecurityEventType.AUDIT_EVENT,
            severity=SecurityEventSeverity.INFO,
            message="Security monitoring stopped",
            details={"session_id": self.session_id}
        )
    
    async def log_security_event(
        self,
        event_type: SecurityEventType,
        severity: SecurityEventSeverity,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[int] = None,
        compliance_standards: Optional[List[ComplianceStandard]] = None
    ) -> str:
        """Log a security event"""
        
        event_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Calculate risk score
        risk_score = self._calculate_risk_score(event_type, severity, details)
        
        # Prepare compliance standards
        compliance_list = []
        if compliance_standards:
            compliance_list = [std.value for std in compliance_standards]
        
        # Create event record
        event_record = {
            "event_id": event_id,
            "timestamp": timestamp,
            "session_id": self.session_id,
            "event_type": event_type.value,
            "severity": severity.value,
            "source": "FossaWork_V2",
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "message": message,
            "details": json.dumps(details) if details else None,
            "risk_score": risk_score,
            "compliance_standards": json.dumps(compliance_list)
        }
        
        # Store in database
        await self._store_security_event(event_record)
        
        # Log to file
        log_entry = {
            "event_id": event_id,
            "timestamp": timestamp,
            "type": event_type.value,
            "severity": severity.value,
            "message": message,
            "user_id": user_id,
            "ip_address": ip_address,
            "endpoint": endpoint
        }
        
        self.logger.info(f"SECURITY_EVENT: {json.dumps(log_entry)}")
        
        # Check for suspicious activity
        await self._detect_suspicious_activity(event_record)
        
        # Check compliance requirements
        await self._check_compliance_requirements(event_record)
        
        # Send alerts if necessary
        await self._send_security_alerts(event_record)
        
        return event_id
    
    async def log_audit_trail(
        self,
        action: str,
        resource: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        user_id: Optional[str] = None,
        reason: Optional[str] = None
    ) -> str:
        """Log an audit trail entry"""
        
        event_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        audit_record = {
            "event_id": event_id,
            "timestamp": timestamp,
            "action": action,
            "resource": resource,
            "old_value": old_value,
            "new_value": new_value,
            "user_id": user_id,
            "reason": reason
        }
        
        # Store in database
        with sqlite3.connect(self.audit_db_path) as conn:
            conn.execute("""
                INSERT INTO audit_trail 
                (event_id, timestamp, action, resource, old_value, new_value, user_id, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event_id, timestamp, action, resource, 
                old_value, new_value, user_id, reason
            ))
        
        self.logger.info(f"AUDIT_TRAIL: {json.dumps(audit_record)}")
        
        return event_id
    
    async def log_data_processing(
        self,
        data_subject_id: str,
        processing_purpose: str,
        data_categories: List[str],
        legal_basis: str,
        retention_period: str,
        processor: str
    ) -> str:
        """Log data processing for GDPR compliance"""
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        processing_record = {
            "timestamp": timestamp,
            "data_subject_id": data_subject_id,
            "processing_purpose": processing_purpose,
            "data_categories": json.dumps(data_categories),
            "legal_basis": legal_basis,
            "retention_period": retention_period,
            "processor": processor
        }
        
        # Store in compliance database
        with sqlite3.connect(self.compliance_db_path) as conn:
            cursor = conn.execute("""
                INSERT INTO data_processing_log 
                (timestamp, data_subject_id, processing_purpose, data_categories, 
                 legal_basis, retention_period, processor)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                timestamp, data_subject_id, processing_purpose, 
                json.dumps(data_categories), legal_basis, retention_period, processor
            ))
            record_id = cursor.lastrowid
        
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.DATA_ACCESS,
            severity=SecurityEventSeverity.INFO,
            message="Data processing logged for compliance",
            details=processing_record,
            compliance_standards=[ComplianceStandard.GDPR]
        )
        
        return str(record_id)
    
    async def log_consent_change(
        self,
        data_subject_id: str,
        consent_type: str,
        consent_status: str,
        purpose: str,
        withdrawn_date: Optional[str] = None
    ) -> str:
        """Log consent changes for GDPR compliance"""
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        consent_record = {
            "timestamp": timestamp,
            "data_subject_id": data_subject_id,
            "consent_type": consent_type,
            "consent_status": consent_status,
            "purpose": purpose,
            "withdrawn_date": withdrawn_date
        }
        
        # Store in compliance database
        with sqlite3.connect(self.compliance_db_path) as conn:
            cursor = conn.execute("""
                INSERT INTO consent_log 
                (timestamp, data_subject_id, consent_type, consent_status, purpose, withdrawn_date)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                timestamp, data_subject_id, consent_type, 
                consent_status, purpose, withdrawn_date
            ))
            record_id = cursor.lastrowid
        
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.COMPLIANCE_VIOLATION if consent_status == "withdrawn" else SecurityEventType.AUDIT_EVENT,
            severity=SecurityEventSeverity.MEDIUM if consent_status == "withdrawn" else SecurityEventSeverity.INFO,
            message=f"Consent {consent_status} for {purpose}",
            details=consent_record,
            compliance_standards=[ComplianceStandard.GDPR]
        )
        
        return str(record_id)
    
    def _calculate_risk_score(
        self, 
        event_type: SecurityEventType, 
        severity: SecurityEventSeverity, 
        details: Optional[Dict[str, Any]]
    ) -> int:
        """Calculate risk score for security event"""
        
        base_scores = {
            SecurityEventSeverity.CRITICAL: 90,
            SecurityEventSeverity.HIGH: 70,
            SecurityEventSeverity.MEDIUM: 50,
            SecurityEventSeverity.LOW: 30,
            SecurityEventSeverity.INFO: 10
        }
        
        event_multipliers = {
            SecurityEventType.SYSTEM_COMPROMISE: 1.5,
            SecurityEventType.PRIVILEGE_ESCALATION: 1.4,
            SecurityEventType.SECURITY_VIOLATION: 1.3,
            SecurityEventType.AUTHORIZATION_DENIED: 1.2,
            SecurityEventType.AUTHENTICATION_FAILURE: 1.1,
            SecurityEventType.SUSPICIOUS_ACTIVITY: 1.2
        }
        
        score = base_scores.get(severity, 50)
        multiplier = event_multipliers.get(event_type, 1.0)
        
        # Additional risk factors
        if details:
            if details.get("repeated_attempts", 0) > 5:
                multiplier += 0.2
            if details.get("admin_attempt", False):
                multiplier += 0.3
            if details.get("external_ip", False):
                multiplier += 0.1
        
        final_score = min(100, int(score * multiplier))
        return final_score
    
    async def _store_security_event(self, event_record: Dict[str, Any]):
        """Store security event in database"""
        with sqlite3.connect(self.audit_db_path) as conn:
            conn.execute("""
                INSERT INTO security_events 
                (event_id, timestamp, session_id, event_type, severity, source,
                 user_id, ip_address, user_agent, endpoint, method, status_code,
                 message, details, risk_score, compliance_standards)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event_record["event_id"], event_record["timestamp"], 
                event_record["session_id"], event_record["event_type"],
                event_record["severity"], event_record["source"],
                event_record["user_id"], event_record["ip_address"],
                event_record["user_agent"], event_record["endpoint"],
                event_record["method"], event_record["status_code"],
                event_record["message"], event_record["details"],
                event_record["risk_score"], event_record["compliance_standards"]
            ))
    
    async def _detect_suspicious_activity(self, event_record: Dict[str, Any]):
        """Detect suspicious activity patterns"""
        
        event_type = event_record["event_type"]
        ip_address = event_record.get("ip_address")
        user_agent = event_record.get("user_agent")
        
        # Track failed authentication attempts
        if event_type == SecurityEventType.AUTHENTICATION_FAILURE.value:
            key = f"failed_auth_{ip_address}"
            
            with self.lock:
                if key not in self.failed_attempts:
                    self.failed_attempts[key] = {"count": 0, "first_seen": datetime.now()}
                
                self.failed_attempts[key]["count"] += 1
                self.failed_attempts[key]["last_seen"] = datetime.now()
                
                # Alert on multiple failed attempts
                if self.failed_attempts[key]["count"] >= 5:
                    await self._log_suspicious_pattern(
                        pattern_id=f"brute_force_{ip_address}",
                        pattern_type="brute_force",
                        severity=SecurityEventSeverity.HIGH,
                        details={
                            "ip_address": ip_address,
                            "failed_attempts": self.failed_attempts[key]["count"],
                            "time_window": str(datetime.now() - self.failed_attempts[key]["first_seen"])
                        }
                    )
        
        # Detect unusual user agents
        if user_agent:
            suspicious_agents = ["sqlmap", "nikto", "nmap", "burp", "owasp"]
            if any(agent in user_agent.lower() for agent in suspicious_agents):
                await self._log_suspicious_pattern(
                    pattern_id=f"suspicious_agent_{hashlib.md5(user_agent.encode()).hexdigest()[:8]}",
                    pattern_type="suspicious_user_agent",
                    severity=SecurityEventSeverity.MEDIUM,
                    details={"user_agent": user_agent, "ip_address": ip_address}
                )
        
        # Detect privilege escalation attempts
        if event_type == SecurityEventType.AUTHORIZATION_DENIED.value:
            endpoint = event_record.get("endpoint", "")
            if any(admin_path in endpoint for admin_path in ["/admin", "/manage", "/config"]):
                await self._log_suspicious_pattern(
                    pattern_id=f"privilege_escalation_{ip_address}",
                    pattern_type="privilege_escalation",
                    severity=SecurityEventSeverity.HIGH,
                    details={"endpoint": endpoint, "ip_address": ip_address}
                )
    
    async def _log_suspicious_pattern(
        self,
        pattern_id: str,
        pattern_type: str,
        severity: SecurityEventSeverity,
        details: Dict[str, Any]
    ):
        """Log suspicious activity pattern"""
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Update or create suspicious activity record
        with sqlite3.connect(self.audit_db_path) as conn:
            # Check if pattern exists
            cursor = conn.execute(
                "SELECT id, occurrence_count FROM suspicious_activity WHERE pattern_id = ?",
                (pattern_id,)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Update existing pattern
                conn.execute("""
                    UPDATE suspicious_activity 
                    SET last_seen = ?, occurrence_count = occurrence_count + 1, details = ?
                    WHERE pattern_id = ?
                """, (timestamp, json.dumps(details), pattern_id))
            else:
                # Create new pattern
                conn.execute("""
                    INSERT INTO suspicious_activity 
                    (pattern_id, first_seen, last_seen, pattern_type, severity, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (pattern_id, timestamp, timestamp, pattern_type, severity.value, json.dumps(details)))
        
        # Log security event
        await self.log_security_event(
            event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
            severity=severity,
            message=f"Suspicious pattern detected: {pattern_type}",
            details=details
        )
    
    async def _check_compliance_requirements(self, event_record: Dict[str, Any]):
        """Check compliance requirements for event"""
        
        compliance_standards = json.loads(event_record.get("compliance_standards", "[]"))
        
        for standard in compliance_standards:
            if standard in self.compliance_rules:
                rules = self.compliance_rules[standard]
                
                # Check if event meets compliance requirements
                compliance_status = "compliant"
                evidence = {}
                remediation = None
                
                # Example compliance checks
                if standard == ComplianceStandard.GDPR.value:
                    if event_record["event_type"] == SecurityEventType.DATA_ACCESS.value:
                        # Check if consent exists
                        if not event_record.get("details", {}).get("consent_verified"):
                            compliance_status = "violation"
                            remediation = "Verify data subject consent before processing"
                
                # Log compliance event
                await self._log_compliance_event(
                    standard=standard,
                    requirement=f"{event_record['event_type']}_logging",
                    status=compliance_status,
                    evidence=evidence,
                    details=event_record,
                    remediation=remediation
                )
    
    async def _log_compliance_event(
        self,
        standard: str,
        requirement: str,
        status: str,
        evidence: Dict[str, Any],
        details: Dict[str, Any],
        remediation: Optional[str] = None
    ):
        """Log compliance event"""
        
        event_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        with sqlite3.connect(self.compliance_db_path) as conn:
            conn.execute("""
                INSERT INTO compliance_events 
                (event_id, timestamp, standard, requirement, status, evidence, details, remediation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event_id, timestamp, standard, requirement, status,
                json.dumps(evidence), json.dumps(details), remediation
            ))
    
    async def _send_security_alerts(self, event_record: Dict[str, Any]):
        """Send security alerts for high-risk events"""
        
        risk_score = event_record.get("risk_score", 0)
        severity = event_record.get("severity")
        
        # Send alerts for high-risk events
        if risk_score >= 80 or severity == SecurityEventSeverity.CRITICAL.value:
            alert_message = {
                "alert_type": "security_incident",
                "event_id": event_record["event_id"],
                "severity": severity,
                "risk_score": risk_score,
                "message": event_record["message"],
                "timestamp": event_record["timestamp"],
                "requires_immediate_attention": True
            }
            
            # In a real implementation, this would send to:
            # - SIEM system
            # - Security team notifications
            # - Incident response platform
            
            self.logger.critical(f"SECURITY_ALERT: {json.dumps(alert_message)}")
    
    async def _process_event_queue(self):
        """Process queued security events"""
        while self.monitoring_active:
            try:
                # Process events from queue if needed
                await asyncio.sleep(1)
            except Exception as e:
                self.logger.error(f"Error processing event queue: {e}")
    
    async def get_security_events(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Retrieve security events with filtering"""
        
        query = "SELECT * FROM security_events WHERE 1=1"
        params = []
        
        if start_date:
            query += " AND timestamp >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND timestamp <= ?"
            params.append(end_date)
        
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type)
        
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        with sqlite3.connect(self.audit_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, params)
            
            events = []
            for row in cursor.fetchall():
                event = dict(row)
                if event["details"]:
                    event["details"] = json.loads(event["details"])
                if event["compliance_standards"]:
                    event["compliance_standards"] = json.loads(event["compliance_standards"])
                events.append(event)
        
        return events
    
    async def get_audit_summary(self, days: int = 30) -> Dict[str, Any]:
        """Get audit summary for specified time period"""
        
        start_date = (datetime.now() - datetime.timedelta(days=days)).isoformat()
        
        with sqlite3.connect(self.audit_db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Event counts by type
            cursor = conn.execute("""
                SELECT event_type, COUNT(*) as count 
                FROM security_events 
                WHERE timestamp >= ? 
                GROUP BY event_type
            """, (start_date,))
            event_counts = dict(cursor.fetchall())
            
            # Severity breakdown
            cursor = conn.execute("""
                SELECT severity, COUNT(*) as count 
                FROM security_events 
                WHERE timestamp >= ? 
                GROUP BY severity
            """, (start_date,))
            severity_counts = dict(cursor.fetchall())
            
            # High-risk events
            cursor = conn.execute("""
                SELECT COUNT(*) as count 
                FROM security_events 
                WHERE timestamp >= ? AND risk_score >= 70
            """, (start_date,))
            high_risk_count = cursor.fetchone()["count"]
            
            # Suspicious activity
            cursor = conn.execute("""
                SELECT COUNT(*) as count 
                FROM suspicious_activity 
                WHERE first_seen >= ?
            """, (start_date,))
            suspicious_count = cursor.fetchone()["count"]
        
        return {
            "period_days": days,
            "event_counts": event_counts,
            "severity_breakdown": severity_counts,
            "high_risk_events": high_risk_count,
            "suspicious_activities": suspicious_count,
            "total_events": sum(event_counts.values())
        }
    
    async def export_audit_report(
        self, 
        output_path: str, 
        format: str = "json",
        days: int = 30
    ):
        """Export comprehensive audit report"""
        
        # Get events and summary
        events = await self.get_security_events(
            start_date=(datetime.now() - datetime.timedelta(days=days)).isoformat(),
            limit=10000
        )
        summary = await self.get_audit_summary(days)
        
        report = {
            "report_metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "period_days": days,
                "total_events": len(events),
                "report_format": format
            },
            "executive_summary": summary,
            "security_events": events,
            "compliance_status": await self._get_compliance_status(),
            "recommendations": await self._generate_security_recommendations(events)
        }
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        if format == "json":
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Audit report exported to {output_file}")
        return str(output_file)
    
    async def _get_compliance_status(self) -> Dict[str, Any]:
        """Get current compliance status"""
        
        with sqlite3.connect(self.compliance_db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Get compliance events by standard
            cursor = conn.execute("""
                SELECT standard, status, COUNT(*) as count 
                FROM compliance_events 
                GROUP BY standard, status
            """)
            
            compliance_status = {}
            for row in cursor.fetchall():
                standard = row["standard"]
                status = row["status"]
                count = row["count"]
                
                if standard not in compliance_status:
                    compliance_status[standard] = {}
                compliance_status[standard][status] = count
        
        return compliance_status
    
    async def _generate_security_recommendations(self, events: List[Dict[str, Any]]) -> List[str]:
        """Generate security recommendations based on events"""
        
        recommendations = []
        
        # Analyze event patterns
        event_types = {}
        severity_counts = {}
        
        for event in events:
            event_type = event.get("event_type", "unknown")
            severity = event.get("severity", "low")
            
            event_types[event_type] = event_types.get(event_type, 0) + 1
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Generate recommendations
        if event_types.get("authentication_failure", 0) > 10:
            recommendations.append("Consider implementing stronger authentication mechanisms")
        
        if event_types.get("authorization_denied", 0) > 5:
            recommendations.append("Review and update access control policies")
        
        if severity_counts.get("critical", 0) > 0:
            recommendations.append("Immediate investigation required for critical security events")
        
        if severity_counts.get("high", 0) > 10:
            recommendations.append("Implement additional security monitoring and alerting")
        
        return recommendations

# Singleton instance for global access
audit_logger = None

def get_audit_logger(project_root: str = None) -> SecurityAuditLogger:
    """Get singleton audit logger instance"""
    global audit_logger
    
    if audit_logger is None:
        audit_logger = SecurityAuditLogger(project_root)
    
    return audit_logger

# Decorator for automatic audit logging
def audit_endpoint(
    event_type: SecurityEventType = SecurityEventType.AUDIT_EVENT,
    severity: SecurityEventSeverity = SecurityEventSeverity.INFO
):
    """Decorator to automatically audit API endpoints"""
    
    def decorator(func):
        async def wrapper(*args, **kwargs):
            logger = get_audit_logger()
            
            # Extract request information
            # This would need to be adapted based on the framework (FastAPI, Flask, etc.)
            
            try:
                result = await func(*args, **kwargs)
                
                # Log successful operation
                await logger.log_security_event(
                    event_type=event_type,
                    severity=severity,
                    message=f"API endpoint accessed: {func.__name__}",
                    endpoint=func.__name__,
                    method="GET"  # Would extract from request
                )
                
                return result
                
            except Exception as e:
                # Log error
                await logger.log_security_event(
                    event_type=SecurityEventType.ERROR_EVENT,
                    severity=SecurityEventSeverity.HIGH,
                    message=f"API endpoint error: {func.__name__} - {str(e)}",
                    endpoint=func.__name__,
                    details={"error": str(e)}
                )
                raise
        
        return wrapper
    return decorator
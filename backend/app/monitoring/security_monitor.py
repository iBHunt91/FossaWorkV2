"""
Security monitoring system for detecting and responding to security events
"""

import time
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timedelta
from collections import defaultdict, deque
from ipaddress import ip_address, ip_network
import re

from app.services.logging_service import get_logger
logger = get_logger("monitoring.security_monitor")
from app.monitoring.metrics_collector import metrics_collector
from app.monitoring.alert_manager import AlertRule, alert_manager


class SecurityPattern:
    """Defines patterns for detecting security threats"""
    
    def __init__(self, name: str, pattern: str, severity: str, threshold: int = 1):
        self.name = name
        self.pattern = re.compile(pattern, re.IGNORECASE)
        self.severity = severity
        self.threshold = threshold


class SecurityMonitor:
    """Monitors and analyzes security events"""
    
    def __init__(self):
        self.ip_tracker = defaultdict(lambda: {
            "requests": deque(maxlen=1000),
            "auth_failures": deque(maxlen=100),
            "suspicious_activities": deque(maxlen=100),
            "blocked_until": None
        })
        self.blocked_ips: Set[str] = set()
        self.security_patterns = self._initialize_patterns()
        self.incident_log = deque(maxlen=1000)
        self._setup_security_alerts()
    
    def _initialize_patterns(self) -> List[SecurityPattern]:
        """Initialize security threat patterns"""
        return [
            # SQL Injection patterns
            SecurityPattern(
                name="sql_injection",
                pattern=r"(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|into|table|database)\b|'.*or.*'.*=|;.*--;)",
                severity="critical",
                threshold=1
            ),
            
            # XSS patterns
            SecurityPattern(
                name="xss_attempt",
                pattern=r"(<script|javascript:|onerror=|onload=|<iframe|<object|<embed|<svg)",
                severity="high",
                threshold=1
            ),
            
            # Path traversal
            SecurityPattern(
                name="path_traversal",
                pattern=r"(\.\./|\.\.\\|%2e%2e%2f|%252e%252e%252f)",
                severity="high",
                threshold=1
            ),
            
            # Command injection
            SecurityPattern(
                name="command_injection",
                pattern=r"(;|\||`|\$\(|&&|\|\|).*?(ls|cat|wget|curl|bash|sh|cmd|powershell)",
                severity="critical",
                threshold=1
            ),
            
            # Authentication bypass attempts
            SecurityPattern(
                name="auth_bypass",
                pattern=r"(admin'--|' or|admin.*--)",
                severity="critical",
                threshold=1
            ),
        ]
    
    def _setup_security_alerts(self):
        """Set up security-specific alert rules"""
        # Brute force detection
        alert_manager.add_rule(AlertRule(
            name="Brute Force Attack",
            condition=lambda m: any(
                len(data["auth_failures"]) > 10
                for data in self.ip_tracker.values()
            ),
            severity="critical",
            cooldown_minutes=15,
            message_template="Brute force attack detected from IP",
            channels=["log", "email", "pushover"]
        ))
        
        # Multiple blocked IPs
        alert_manager.add_rule(AlertRule(
            name="Multiple IPs Blocked",
            condition=lambda m: len(self.blocked_ips) > 10,
            severity="critical",
            cooldown_minutes=30,
            message_template="Multiple IPs have been blocked: {count}",
            channels=["log", "email"]
        ))
        
        # Critical security pattern detected
        alert_manager.add_rule(AlertRule(
            name="Critical Security Pattern",
            condition=lambda m: any(
                incident["severity"] == "critical"
                for incident in list(self.incident_log)[-10:]
            ),
            severity="critical",
            cooldown_minutes=10,
            message_template="Critical security pattern detected",
            channels=["log", "email", "pushover"]
        ))
    
    def track_request(
        self,
        ip: str,
        endpoint: str,
        method: str,
        user_agent: str,
        status_code: int,
        request_data: Optional[Dict[str, Any]] = None
    ):
        """Track and analyze incoming requests for security threats"""
        timestamp = time.time()
        
        # Check if IP is blocked
        if self._is_ip_blocked(ip):
            logger.warning(f"Blocked IP {ip} attempted to access {endpoint}")
            metrics_collector.record_security_event("blocked_ip_attempt", "warning", {
                "ip": ip,
                "endpoint": endpoint
            })
            return False
        
        # Record request
        self.ip_tracker[ip]["requests"].append({
            "timestamp": timestamp,
            "endpoint": endpoint,
            "method": method,
            "user_agent": user_agent,
            "status_code": status_code
        })
        
        # Check for suspicious patterns
        if request_data:
            self._check_request_patterns(ip, endpoint, request_data)
        
        # Track authentication failures
        if status_code == 401:
            self._track_auth_failure(ip, endpoint)
        
        # Analyze request rate
        self._analyze_request_rate(ip)
        
        return True
    
    def _is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is currently blocked"""
        if ip in self.blocked_ips:
            blocked_until = self.ip_tracker[ip].get("blocked_until")
            if blocked_until and datetime.utcnow() < blocked_until:
                return True
            else:
                # Unblock if time has passed
                self.blocked_ips.discard(ip)
                self.ip_tracker[ip]["blocked_until"] = None
        return False
    
    def _check_request_patterns(self, ip: str, endpoint: str, request_data: Dict[str, Any]):
        """Check request data for malicious patterns"""
        # Convert request data to string for pattern matching
        request_str = str(request_data)
        
        for pattern in self.security_patterns:
            if pattern.pattern.search(request_str):
                self._record_security_incident(ip, endpoint, pattern.name, pattern.severity)
                
                # Block IP for critical threats
                if pattern.severity == "critical":
                    self._block_ip(ip, hours=24)
    
    def _track_auth_failure(self, ip: str, endpoint: str):
        """Track authentication failures"""
        timestamp = time.time()
        self.ip_tracker[ip]["auth_failures"].append({
            "timestamp": timestamp,
            "endpoint": endpoint
        })
        
        # Check for brute force
        recent_failures = [
            f for f in self.ip_tracker[ip]["auth_failures"]
            if f["timestamp"] > timestamp - 300  # Last 5 minutes
        ]
        
        if len(recent_failures) > 5:
            self._record_security_incident(ip, endpoint, "brute_force", "high")
            self._block_ip(ip, hours=1)
            
        metrics_collector.record_security_event("auth_failure", "warning", {
            "ip": ip,
            "endpoint": endpoint,
            "recent_failures": len(recent_failures)
        })
    
    def _analyze_request_rate(self, ip: str):
        """Analyze request rate for DDoS detection"""
        timestamp = time.time()
        recent_requests = [
            r for r in self.ip_tracker[ip]["requests"]
            if r["timestamp"] > timestamp - 60  # Last minute
        ]
        
        # Excessive requests detection
        if len(recent_requests) > 100:
            self._record_security_incident(ip, "multiple", "ddos_attempt", "high")
            self._block_ip(ip, hours=1)
            
            metrics_collector.record_security_event("rate_limit", "high", {
                "ip": ip,
                "requests_per_minute": len(recent_requests)
            })
    
    def _record_security_incident(self, ip: str, endpoint: str, incident_type: str, severity: str):
        """Record a security incident"""
        incident = {
            "timestamp": datetime.utcnow().isoformat(),
            "ip": ip,
            "endpoint": endpoint,
            "type": incident_type,
            "severity": severity
        }
        
        self.incident_log.append(incident)
        self.ip_tracker[ip]["suspicious_activities"].append(incident)
        
        logger.warning(f"Security incident: {incident_type} from {ip} on {endpoint}")
        
        metrics_collector.record_security_event("security_incident", severity, incident)
    
    def _block_ip(self, ip: str, hours: int = 1):
        """Block an IP address for specified hours"""
        self.blocked_ips.add(ip)
        self.ip_tracker[ip]["blocked_until"] = datetime.utcnow() + timedelta(hours=hours)
        
        logger.warning(f"IP {ip} blocked for {hours} hours")
        
        metrics_collector.record_security_event("ip_blocked", "high", {
            "ip": ip,
            "hours": hours,
            "reason": "security_threat"
        })
    
    def get_security_status(self) -> Dict[str, Any]:
        """Get current security status summary"""
        current_time = time.time()
        hour_ago = current_time - 3600
        
        # Count recent incidents by type
        recent_incidents = defaultdict(int)
        for incident in self.incident_log:
            if datetime.fromisoformat(incident["timestamp"]).timestamp() > hour_ago:
                recent_incidents[incident["type"]] += 1
        
        # Get top threatening IPs
        threat_ips = []
        for ip, data in self.ip_tracker.items():
            threat_score = (
                len(data["auth_failures"]) * 10 +
                len(data["suspicious_activities"]) * 20 +
                (100 if ip in self.blocked_ips else 0)
            )
            if threat_score > 0:
                threat_ips.append({
                    "ip": ip,
                    "threat_score": threat_score,
                    "blocked": ip in self.blocked_ips
                })
        
        threat_ips.sort(key=lambda x: x["threat_score"], reverse=True)
        
        return {
            "blocked_ips_count": len(self.blocked_ips),
            "recent_incidents": dict(recent_incidents),
            "total_incidents_last_hour": sum(recent_incidents.values()),
            "top_threat_ips": threat_ips[:10],
            "security_level": self._calculate_security_level(recent_incidents)
        }
    
    def _calculate_security_level(self, recent_incidents: Dict[str, int]) -> str:
        """Calculate overall security threat level"""
        critical_count = sum(
            count for incident_type, count in recent_incidents.items()
            if incident_type in ["sql_injection", "command_injection", "auth_bypass"]
        )
        
        total_incidents = sum(recent_incidents.values())
        
        if critical_count > 5 or total_incidents > 50:
            return "critical"
        elif critical_count > 0 or total_incidents > 20:
            return "high"
        elif total_incidents > 10:
            return "medium"
        else:
            return "low"
    
    def is_ip_whitelisted(self, ip: str) -> bool:
        """Check if IP is in whitelist"""
        # Local IPs are always whitelisted
        try:
            ip_obj = ip_address(ip)
            return ip_obj.is_private or ip_obj.is_loopback
        except:
            return False
    
    def add_ip_whitelist(self, ip: str):
        """Add IP to whitelist (would be stored in config/db)"""
        # Implementation would store in persistent storage
        pass
    
    def get_incident_report(self, hours: int = 24) -> Dict[str, Any]:
        """Generate detailed incident report"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        incidents_by_type = defaultdict(list)
        incidents_by_ip = defaultdict(list)
        incidents_by_severity = defaultdict(int)
        
        for incident in self.incident_log:
            incident_time = datetime.fromisoformat(incident["timestamp"])
            if incident_time > cutoff_time:
                incidents_by_type[incident["type"]].append(incident)
                incidents_by_ip[incident["ip"]].append(incident)
                incidents_by_severity[incident["severity"]] += 1
        
        return {
            "report_period_hours": hours,
            "total_incidents": sum(incidents_by_severity.values()),
            "incidents_by_severity": dict(incidents_by_severity),
            "incidents_by_type": {k: len(v) for k, v in incidents_by_type.items()},
            "top_offending_ips": sorted(
                [(ip, len(incidents)) for ip, incidents in incidents_by_ip.items()],
                key=lambda x: x[1],
                reverse=True
            )[:10],
            "blocked_ips": list(self.blocked_ips),
            "recommendation": self._generate_security_recommendation(incidents_by_severity)
        }
    
    def _generate_security_recommendation(self, severity_counts: Dict[str, int]) -> str:
        """Generate security recommendations based on incidents"""
        if severity_counts.get("critical", 0) > 0:
            return "CRITICAL: Immediate action required. Review logs and consider additional security measures."
        elif severity_counts.get("high", 0) > 5:
            return "HIGH: Multiple high-severity incidents detected. Review security policies and monitoring."
        elif sum(severity_counts.values()) > 20:
            return "MEDIUM: Elevated security activity. Monitor closely and review access patterns."
        else:
            return "LOW: Normal security status. Continue routine monitoring."


# Global security monitor instance
security_monitor = SecurityMonitor()
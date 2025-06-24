#!/usr/bin/env python3
"""
FossaWork V2 Security Monitor

Real-time security monitoring and threat detection system.
Monitors authentication events, detects suspicious activities, and generates security alerts.

Features:
- Real-time authentication monitoring
- Brute force attack detection
- Anomaly detection
- Rate limiting monitoring
- Security event correlation
- Automated threat response

Usage:
    python security-monitor.py [options]
    
Examples:
    python security-monitor.py --scan --last-24h
    python security-monitor.py --monitor --realtime
    python security-monitor.py --investigate --suspicious
"""

import argparse
import json
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass
import ipaddress
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class SecurityEvent:
    """Security event data structure"""
    timestamp: datetime
    event_type: str
    severity: str
    source_ip: Optional[str]
    user: Optional[str]
    endpoint: Optional[str]
    details: Dict[str, Any]
    raw_data: Dict[str, Any]

@dataclass
class ThreatIndicator:
    """Threat indicator for correlation"""
    indicator_type: str
    value: str
    confidence: float
    first_seen: datetime
    last_seen: datetime
    count: int

class SecurityMonitor:
    def __init__(self, logs_dir: str = "/logs"):
        self.logs_dir = Path(logs_dir)
        
        # Security event patterns
        self.event_patterns = {
            'failed_login': [
                r'authentication.*failed',
                r'login.*failed',
                r'invalid.*credentials',
                r'unauthorized.*access'
            ],
            'suspicious_request': [
                r'(union.*select|drop.*table)',  # SQL injection
                r'(<script|javascript:)',        # XSS
                r'(\.\./|\.\.\\)',              # Directory traversal
                r'(eval\(|exec\()',             # Code injection
            ],
            'rate_limit_hit': [
                r'rate.*limit.*exceeded',
                r'too.*many.*requests',
                r'request.*throttled'
            ],
            'privilege_escalation': [
                r'unauthorized.*admin',
                r'privilege.*escalation',
                r'access.*denied.*admin'
            ],
            'data_access_anomaly': [
                r'unusual.*data.*access',
                r'bulk.*data.*download',
                r'suspicious.*query'
            ]
        }
        
        # Threat detection rules
        self.threat_rules = {
            'brute_force': {
                'failed_attempts_threshold': 5,
                'time_window': timedelta(minutes=15),
                'severity': 'high'
            },
            'distributed_attack': {
                'unique_ips_threshold': 10,
                'time_window': timedelta(minutes=30),
                'severity': 'high'
            },
            'rate_abuse': {
                'requests_threshold': 100,
                'time_window': timedelta(minutes=5),
                'severity': 'medium'
            },
            'anomalous_access': {
                'off_hours_threshold': 10,  # Outside 9-5
                'geographical_anomaly': True,
                'severity': 'medium'
            }
        }
        
        # Active monitoring state
        self.active_sessions = {}
        self.threat_indicators = defaultdict(list)
        self.recent_events = deque(maxlen=1000)
        self.ip_reputation = {}
        
        # Known bad patterns
        self.malicious_patterns = [
            r'sqlmap',
            r'nikto',
            r'nmap',
            r'burpsuite',
            r'havij',
            r'acunetix'
        ]

    def parse_security_event(self, log_entry: Dict[str, Any], source_file: str) -> Optional[SecurityEvent]:
        """Parse log entry into security event"""
        try:
            # Extract timestamp
            timestamp_str = log_entry.get('timestamp', log_entry.get('time', ''))
            if timestamp_str:
                try:
                    if 'T' in timestamp_str:
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                except:
                    timestamp = datetime.utcnow()
            else:
                timestamp = datetime.utcnow()
            
            message = log_entry.get('message', '').lower()
            
            # Determine event type
            event_type = 'unknown'
            for pattern_type, patterns in self.event_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, message, re.IGNORECASE):
                        event_type = pattern_type
                        break
                if event_type != 'unknown':
                    break
            
            # Determine severity
            severity = 'low'
            if event_type in ['failed_login', 'suspicious_request']:
                severity = 'medium'
            elif 'critical' in message or 'security' in message:
                severity = 'high'
            
            return SecurityEvent(
                timestamp=timestamp,
                event_type=event_type,
                severity=severity,
                source_ip=log_entry.get('ip', log_entry.get('client_ip')),
                user=log_entry.get('user', log_entry.get('username')),
                endpoint=log_entry.get('endpoint', log_entry.get('path')),
                details={
                    'method': log_entry.get('method'),
                    'status_code': log_entry.get('status_code'),
                    'user_agent': log_entry.get('user_agent'),
                    'referer': log_entry.get('referer')
                },
                raw_data=log_entry
            )
            
        except Exception as e:
            logger.warning(f"Error parsing security event: {e}")
            return None

    def read_security_logs(self, timeframe: Optional[timedelta] = None) -> List[SecurityEvent]:
        """Read and parse security-related logs"""
        events = []
        cutoff_time = datetime.utcnow() - timeframe if timeframe else None
        
        # Security-related log patterns
        security_patterns = [
            "backend*error*.jsonl",
            "backend*api*.jsonl", 
            "frontend*error*.jsonl",
            "authentication*.jsonl",
            "security*.jsonl"
        ]
        
        for pattern in security_patterns:
            for log_file in self.logs_dir.rglob(pattern):
                try:
                    # Skip if file is too old
                    if cutoff_time and datetime.fromtimestamp(log_file.stat().st_mtime) < cutoff_time:
                        continue
                    
                    with open(log_file, 'r') as f:
                        for line in f:
                            try:
                                entry = json.loads(line.strip())
                                event = self.parse_security_event(entry, str(log_file))
                                if event and (not cutoff_time or event.timestamp > cutoff_time):
                                    events.append(event)
                            except json.JSONDecodeError:
                                continue
                            except Exception as e:
                                continue
                                
                except Exception as e:
                    logger.warning(f"Error reading security log {log_file}: {e}")
        
        return sorted(events, key=lambda x: x.timestamp)

    def detect_brute_force_attacks(self, events: List[SecurityEvent]) -> List[Dict[str, Any]]:
        """Detect brute force authentication attacks"""
        attacks = []
        failed_attempts = defaultdict(list)
        
        # Group failed login attempts by IP
        for event in events:
            if event.event_type == 'failed_login' and event.source_ip:
                failed_attempts[event.source_ip].append(event)
        
        # Analyze each IP for brute force patterns
        for ip, attempts in failed_attempts.items():
            if len(attempts) >= self.threat_rules['brute_force']['failed_attempts_threshold']:
                # Check if attempts are within time window
                time_window = self.threat_rules['brute_force']['time_window']
                recent_attempts = [a for a in attempts if a.timestamp > datetime.utcnow() - time_window]
                
                if len(recent_attempts) >= self.threat_rules['brute_force']['failed_attempts_threshold']:
                    attacks.append({
                        'type': 'brute_force_attack',
                        'source_ip': ip,
                        'attempts': len(recent_attempts),
                        'time_span': f"{recent_attempts[0].timestamp} to {recent_attempts[-1].timestamp}",
                        'targeted_users': list(set([a.user for a in recent_attempts if a.user])),
                        'severity': 'high',
                        'confidence': min(0.9, len(recent_attempts) / 20.0),
                        'recommendation': f"Block IP {ip} and review authentication logs"
                    })
        
        return attacks

    def detect_distributed_attacks(self, events: List[SecurityEvent]) -> List[Dict[str, Any]]:
        """Detect distributed attacks from multiple IPs"""
        attacks = []
        
        # Group events by time window
        time_window = self.threat_rules['distributed_attack']['time_window']
        current_time = datetime.utcnow()
        
        recent_events = [e for e in events if e.timestamp > current_time - time_window]
        failed_logins = [e for e in recent_events if e.event_type == 'failed_login']
        
        # Count unique IPs with failed login attempts
        unique_ips = set([e.source_ip for e in failed_logins if e.source_ip])
        
        if len(unique_ips) >= self.threat_rules['distributed_attack']['unique_ips_threshold']:
            attacks.append({
                'type': 'distributed_attack',
                'unique_ips': len(unique_ips),
                'total_attempts': len(failed_logins),
                'time_window': str(time_window),
                'sample_ips': list(unique_ips)[:10],
                'severity': 'high',
                'confidence': min(0.95, len(unique_ips) / 50.0),
                'recommendation': "Implement geographic filtering and enhanced rate limiting"
            })
        
        return attacks

    def detect_suspicious_patterns(self, events: List[SecurityEvent]) -> List[Dict[str, Any]]:
        """Detect suspicious request patterns"""
        suspicious = []
        
        for event in events:
            if event.event_type == 'suspicious_request':
                # Check user agent for known malicious tools
                user_agent = event.details.get('user_agent', '').lower()
                is_malicious_tool = any(pattern in user_agent for pattern in self.malicious_patterns)
                
                # Check for SQL injection patterns
                message = event.raw_data.get('message', '').lower()
                has_sql_injection = any(pattern in message for pattern in [
                    'union select', 'drop table', '1=1', 'or 1=1'
                ])
                
                # Check for XSS patterns
                has_xss = any(pattern in message for pattern in [
                    '<script>', 'javascript:', 'onerror=', 'onload='
                ])
                
                confidence = 0.5
                if is_malicious_tool:
                    confidence += 0.3
                if has_sql_injection:
                    confidence += 0.4
                if has_xss:
                    confidence += 0.3
                
                suspicious.append({
                    'type': 'suspicious_request',
                    'timestamp': event.timestamp.isoformat(),
                    'source_ip': event.source_ip,
                    'endpoint': event.endpoint,
                    'user_agent': event.details.get('user_agent'),
                    'attack_vectors': {
                        'malicious_tool': is_malicious_tool,
                        'sql_injection': has_sql_injection,
                        'xss_attempt': has_xss
                    },
                    'confidence': min(confidence, 1.0),
                    'severity': 'high' if confidence > 0.7 else 'medium',
                    'recommendation': f"Investigate request from {event.source_ip} and consider blocking"
                })
        
        return suspicious

    def analyze_access_patterns(self, events: List[SecurityEvent]) -> List[Dict[str, Any]]:
        """Analyze access patterns for anomalies"""
        anomalies = []
        
        # Group events by user and IP
        user_events = defaultdict(list)
        ip_events = defaultdict(list)
        
        for event in events:
            if event.user:
                user_events[event.user].append(event)
            if event.source_ip:
                ip_events[event.source_ip].append(event)
        
        # Analyze user behavior anomalies
        for user, user_event_list in user_events.items():
            # Check for off-hours access (assuming business hours 9-17)
            off_hours_events = []
            for event in user_event_list:
                hour = event.timestamp.hour
                if hour < 9 or hour > 17:
                    off_hours_events.append(event)
            
            if len(off_hours_events) > self.threat_rules['anomalous_access']['off_hours_threshold']:
                anomalies.append({
                    'type': 'off_hours_access',
                    'user': user,
                    'off_hours_events': len(off_hours_events),
                    'total_events': len(user_event_list),
                    'sample_times': [e.timestamp.isoformat() for e in off_hours_events[:5]],
                    'severity': 'medium',
                    'confidence': min(0.8, len(off_hours_events) / 20.0),
                    'recommendation': f"Review access patterns for user {user}"
                })
            
            # Check for multiple IP addresses for same user
            user_ips = set([e.source_ip for e in user_event_list if e.source_ip])
            if len(user_ips) > 5:  # Multiple IPs threshold
                anomalies.append({
                    'type': 'multiple_ip_access',
                    'user': user,
                    'unique_ips': len(user_ips),
                    'ip_list': list(user_ips),
                    'severity': 'medium',
                    'confidence': min(0.7, len(user_ips) / 10.0),
                    'recommendation': f"Verify legitimate access for user {user} from multiple IPs"
                })
        
        return anomalies

    def generate_security_report(self, events: List[SecurityEvent]) -> Dict[str, Any]:
        """Generate comprehensive security analysis report"""
        # Run all detection algorithms
        brute_force = self.detect_brute_force_attacks(events)
        distributed = self.detect_distributed_attacks(events)
        suspicious = self.detect_suspicious_patterns(events)
        anomalies = self.analyze_access_patterns(events)
        
        # Calculate threat score
        threat_score = 0
        if brute_force:
            threat_score += len(brute_force) * 20
        if distributed:
            threat_score += len(distributed) * 30
        if suspicious:
            threat_score += len(suspicious) * 10
        if anomalies:
            threat_score += len(anomalies) * 5
        
        threat_level = "low"
        if threat_score > 50:
            threat_level = "high"
        elif threat_score > 20:
            threat_level = "medium"
        
        # Event statistics
        event_stats = defaultdict(int)
        for event in events:
            event_stats[event.event_type] += 1
        
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'analysis_period': f"{events[0].timestamp.isoformat()} to {events[-1].timestamp.isoformat()}" if events else "No events",
            'total_events': len(events),
            'threat_score': threat_score,
            'threat_level': threat_level,
            'event_statistics': dict(event_stats),
            'threats_detected': {
                'brute_force_attacks': brute_force,
                'distributed_attacks': distributed,
                'suspicious_requests': suspicious,
                'access_anomalies': anomalies
            },
            'summary': {
                'brute_force_attacks': len(brute_force),
                'distributed_attacks': len(distributed),
                'suspicious_requests': len(suspicious),
                'access_anomalies': len(anomalies),
                'unique_source_ips': len(set([e.source_ip for e in events if e.source_ip])),
                'unique_users': len(set([e.user for e in events if e.user]))
            },
            'recommendations': self.generate_recommendations(brute_force, distributed, suspicious, anomalies)
        }
        
        return report

    def generate_recommendations(self, brute_force, distributed, suspicious, anomalies) -> List[str]:
        """Generate security recommendations based on detected threats"""
        recommendations = []
        
        if brute_force:
            recommendations.extend([
                "Implement account lockout policies",
                "Enable CAPTCHA for repeated failed logins",
                "Consider IP-based blocking for persistent attackers"
            ])
        
        if distributed:
            recommendations.extend([
                "Implement geographic IP filtering",
                "Enable advanced rate limiting",
                "Consider using a Web Application Firewall (WAF)"
            ])
        
        if suspicious:
            recommendations.extend([
                "Review and strengthen input validation",
                "Implement SQL injection protection",
                "Enable XSS filtering",
                "Monitor for known malicious tools"
            ])
        
        if anomalies:
            recommendations.extend([
                "Review user access patterns",
                "Implement anomaly detection alerting",
                "Consider multi-factor authentication",
                "Monitor off-hours access"
            ])
        
        # Generic recommendations
        if not any([brute_force, distributed, suspicious, anomalies]):
            recommendations = [
                "Continue monitoring security events",
                "Maintain current security measures",
                "Regular security assessment recommended"
            ]
        
        return list(set(recommendations))  # Remove duplicates

    def monitor_realtime(self, interval: int = 60):
        """Real-time security monitoring"""
        logger.info("Starting real-time security monitoring...")
        
        while True:
            try:
                # Analyze recent events
                timeframe = timedelta(seconds=interval * 2)  # Look back 2 intervals
                events = self.read_security_logs(timeframe)
                
                if events:
                    # Quick threat detection
                    recent_brute_force = self.detect_brute_force_attacks(events)
                    recent_suspicious = self.detect_suspicious_patterns(events)
                    
                    if recent_brute_force or recent_suspicious:
                        alert = {
                            'timestamp': datetime.utcnow().isoformat(),
                            'type': 'security_alert',
                            'brute_force_attacks': len(recent_brute_force),
                            'suspicious_requests': len(recent_suspicious),
                            'details': {
                                'brute_force': recent_brute_force,
                                'suspicious': recent_suspicious
                            }
                        }
                        
                        # Log alert
                        alert_file = self.logs_dir / 'security-alerts.jsonl'
                        alert_file.parent.mkdir(parents=True, exist_ok=True)
                        with open(alert_file, 'a') as f:
                            f.write(json.dumps(alert) + '\n')
                        
                        logger.warning(f"SECURITY ALERT: {alert}")
                
                time.sleep(interval)
                
            except KeyboardInterrupt:
                logger.info("Real-time security monitoring stopped")
                break
            except Exception as e:
                logger.error(f"Error in security monitoring: {e}")
                time.sleep(interval)

def main():
    parser = argparse.ArgumentParser(description='FossaWork V2 Security Monitor')
    
    # Analysis options
    parser.add_argument('--scan', action='store_true', help='Scan logs for security events')
    parser.add_argument('--investigate', action='store_true', help='Investigate suspicious activities')
    parser.add_argument('--monitor', action='store_true', help='Real-time monitoring mode')
    
    # Time range options
    parser.add_argument('--last-hour', action='store_true', help='Analyze last hour')
    parser.add_argument('--last-24h', action='store_true', help='Analyze last 24 hours')
    parser.add_argument('--last-week', action='store_true', help='Analyze last week')
    
    # Focus options
    parser.add_argument('--suspicious', action='store_true', help='Focus on suspicious activities')
    parser.add_argument('--brute-force', action='store_true', help='Focus on brute force detection')
    parser.add_argument('--anomalies', action='store_true', help='Focus on access anomalies')
    
    # Output options
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    parser.add_argument('--report', action='store_true', help='Generate detailed report')
    parser.add_argument('--output', type=str, help='Output file path')
    
    # Configuration
    parser.add_argument('--logs-dir', type=str, default='/logs', help='Logs directory path')
    parser.add_argument('--interval', type=int, default=60, help='Monitoring interval in seconds')
    
    args = parser.parse_args()
    
    # Create security monitor
    monitor = SecurityMonitor(args.logs_dir)
    
    # Determine timeframe
    timeframe = None
    timeframe_str = "all time"
    
    if args.last_hour:
        timeframe = timedelta(hours=1)
        timeframe_str = "last hour"
    elif args.last_24h:
        timeframe = timedelta(hours=24)
        timeframe_str = "last 24 hours"
    elif args.last_week:
        timeframe = timedelta(days=7)
        timeframe_str = "last week"
    
    # Real-time monitoring mode
    if args.monitor:
        monitor.monitor_realtime(args.interval)
        return 0
    
    # Read and analyze security events
    logger.info(f"Reading security logs from {timeframe_str}")
    events = monitor.read_security_logs(timeframe)
    
    if not events:
        print("No security events found for the specified timeframe")
        return 0
    
    logger.info(f"Analyzing {len(events)} security events")
    
    # Generate report
    if args.report:
        report = monitor.generate_security_report(events)
        
        if args.json:
            output = json.dumps(report, indent=2)
        else:
            output = format_security_report(report)
    else:
        # Focused analysis
        results = {}
        
        if args.brute_force or not any([args.suspicious, args.anomalies]):
            results['brute_force'] = monitor.detect_brute_force_attacks(events)
        
        if args.suspicious:
            results['suspicious'] = monitor.detect_suspicious_patterns(events)
        
        if args.anomalies:
            results['anomalies'] = monitor.analyze_access_patterns(events)
        
        if args.json:
            output = json.dumps(results, indent=2, default=str)
        else:
            output = format_focused_results(results)
    
    # Save or print output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        logger.info(f"Results saved to {args.output}")
    else:
        print(output)
    
    return 0

def format_security_report(report: Dict[str, Any]) -> str:
    """Format security report for human-readable output"""
    output = []
    output.append("🔒" * 20 + " SECURITY ANALYSIS REPORT " + "🔒" * 20)
    output.append(f"Generated: {report['timestamp']}")
    output.append(f"Analysis Period: {report['analysis_period']}")
    output.append(f"Total Events: {report['total_events']}")
    output.append(f"Threat Level: {report['threat_level'].upper()}")
    output.append(f"Threat Score: {report['threat_score']}/100")
    output.append("")
    
    # Summary
    summary = report['summary']
    output.append("📊 THREAT SUMMARY:")
    output.append(f"  Brute Force Attacks: {summary['brute_force_attacks']}")
    output.append(f"  Distributed Attacks: {summary['distributed_attacks']}")
    output.append(f"  Suspicious Requests: {summary['suspicious_requests']}")
    output.append(f"  Access Anomalies: {summary['access_anomalies']}")
    output.append(f"  Unique Source IPs: {summary['unique_source_ips']}")
    output.append(f"  Unique Users: {summary['unique_users']}")
    output.append("")
    
    # Detailed threats
    threats = report['threats_detected']
    
    if threats['brute_force_attacks']:
        output.append("🚨 BRUTE FORCE ATTACKS:")
        for attack in threats['brute_force_attacks']:
            output.append(f"  Source IP: {attack['source_ip']}")
            output.append(f"  Attempts: {attack['attempts']}")
            output.append(f"  Confidence: {attack['confidence']:.2f}")
            output.append(f"  Recommendation: {attack['recommendation']}")
            output.append("")
    
    if threats['suspicious_requests']:
        output.append("⚠️  SUSPICIOUS REQUESTS:")
        for req in threats['suspicious_requests'][:5]:  # Show first 5
            output.append(f"  IP: {req['source_ip']} -> {req['endpoint']}")
            output.append(f"  Confidence: {req['confidence']:.2f}")
            output.append(f"  Attack Vectors: {', '.join([k for k, v in req['attack_vectors'].items() if v])}")
            output.append("")
    
    # Recommendations
    if report['recommendations']:
        output.append("💡 SECURITY RECOMMENDATIONS:")
        for i, rec in enumerate(report['recommendations'], 1):
            output.append(f"  {i}. {rec}")
    
    return "\n".join(output)

def format_focused_results(results: Dict[str, Any]) -> str:
    """Format focused analysis results"""
    output = []
    
    for category, items in results.items():
        if items:
            output.append(f"🔍 {category.upper().replace('_', ' ')} DETECTED:")
            for item in items:
                if category == 'brute_force':
                    output.append(f"  • IP {item['source_ip']}: {item['attempts']} attempts")
                elif category == 'suspicious':
                    output.append(f"  • {item['source_ip']} -> {item['endpoint']} (confidence: {item['confidence']:.2f})")
                elif category == 'anomalies':
                    output.append(f"  • {item['type']}: {item.get('user', item.get('source_ip', 'unknown'))}")
            output.append("")
    
    if not any(results.values()):
        output.append("✅ No security threats detected")
    
    return "\n".join(output)

if __name__ == '__main__':
    exit(main())
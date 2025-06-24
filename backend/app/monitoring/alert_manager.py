"""
Alert management system for sending notifications about critical events
"""

import smtplib
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from collections import defaultdict
import json

from app.services.logging_service import get_logger
logger = get_logger("monitoring.alert_manager")
from app.services.notification_service import NotificationService


class AlertRule:
    """Defines conditions for triggering alerts"""
    
    def __init__(
        self,
        name: str,
        condition: Callable[[Dict[str, Any]], bool],
        severity: str = "warning",
        cooldown_minutes: int = 30,
        message_template: str = "Alert: {name}",
        channels: List[str] = None
    ):
        self.name = name
        self.condition = condition
        self.severity = severity
        self.cooldown_minutes = cooldown_minutes
        self.message_template = message_template
        self.channels = channels or ["log"]
        self.last_triggered = None
    
    def should_trigger(self, metrics: Dict[str, Any]) -> bool:
        """Check if alert should be triggered"""
        # Check cooldown
        if self.last_triggered:
            cooldown_time = self.last_triggered + timedelta(minutes=self.cooldown_minutes)
            if datetime.utcnow() < cooldown_time:
                return False
        
        # Check condition
        try:
            return self.condition(metrics)
        except Exception as e:
            logger.error(f"Error checking alert condition {self.name}: {e}")
            return False


class AlertManager:
    """Manages alert rules and notifications"""
    
    def __init__(self, notification_service: Optional[NotificationService] = None):
        self.notification_service = notification_service
        self.rules: List[AlertRule] = []
        self.alert_history = defaultdict(list)
        self.initialize_default_rules()
    
    def initialize_default_rules(self):
        """Set up default alert rules"""
        
        # High CPU usage
        self.add_rule(AlertRule(
            name="High CPU Usage",
            condition=lambda m: m.get("system", {}).get("cpu_percent", 0) > 90,
            severity="warning",
            cooldown_minutes=15,
            message_template="CPU usage is critically high: {cpu_percent}%",
            channels=["log", "email"]
        ))
        
        # High memory usage
        self.add_rule(AlertRule(
            name="High Memory Usage",
            condition=lambda m: m.get("system", {}).get("memory_percent", 0) > 90,
            severity="warning",
            cooldown_minutes=15,
            message_template="Memory usage is critically high: {memory_percent}%",
            channels=["log", "email"]
        ))
        
        # High error rate
        self.add_rule(AlertRule(
            name="High Error Rate",
            condition=lambda m: m.get("application", {}).get("error_rate_percent", 0) > 10,
            severity="critical",
            cooldown_minutes=30,
            message_template="Error rate is above threshold: {error_rate}%",
            channels=["log", "email", "pushover"]
        ))
        
        # Database connection pool exhausted
        self.add_rule(AlertRule(
            name="Database Pool Exhausted",
            condition=lambda m: (
                m.get("database", {}).get("connection_pool", {}).get("checked_out", 0) >=
                m.get("database", {}).get("connection_pool", {}).get("size", 1) * 0.9
            ),
            severity="critical",
            cooldown_minutes=10,
            message_template="Database connection pool is nearly exhausted",
            channels=["log", "email"]
        ))
        
        # Security events spike
        self.add_rule(AlertRule(
            name="Security Events Spike",
            condition=lambda m: m.get("security", {}).get("total_security_events", 0) > 100,
            severity="critical",
            cooldown_minutes=60,
            message_template="Abnormal number of security events detected: {count} in last hour",
            channels=["log", "email", "pushover"]
        ))
        
        # Authentication failures
        self.add_rule(AlertRule(
            name="Authentication Failures",
            condition=lambda m: m.get("security", {}).get("events_last_hour", {}).get("auth_failure", 0) > 50,
            severity="critical",
            cooldown_minutes=30,
            message_template="High number of authentication failures: {count}",
            channels=["log", "email", "pushover"]
        ))
        
        # Rate limiting triggered
        self.add_rule(AlertRule(
            name="Rate Limiting Active",
            condition=lambda m: m.get("security", {}).get("events_last_hour", {}).get("rate_limit", 0) > 100,
            severity="warning",
            cooldown_minutes=60,
            message_template="Rate limiting is being triggered frequently: {count} times",
            channels=["log", "email"]
        ))
        
        # Slow response times
        self.add_rule(AlertRule(
            name="Slow Response Times",
            condition=lambda m: m.get("application", {}).get("average_response_time_ms", 0) > 1000,
            severity="warning",
            cooldown_minutes=30,
            message_template="API response times are slow: {avg_time}ms average",
            channels=["log", "email"]
        ))
        
        # Disk space low
        self.add_rule(AlertRule(
            name="Low Disk Space",
            condition=lambda m: m.get("system", {}).get("disk_percent", 0) > 90,
            severity="critical",
            cooldown_minutes=60,
            message_template="Disk space is critically low: {disk_percent}% used",
            channels=["log", "email", "pushover"]
        ))
        
        # Application restart (low uptime)
        self.add_rule(AlertRule(
            name="Application Restarted",
            condition=lambda m: m.get("application", {}).get("uptime_seconds", float('inf')) < 300,
            severity="info",
            cooldown_minutes=5,
            message_template="Application was recently restarted",
            channels=["log"]
        ))
    
    def add_rule(self, rule: AlertRule):
        """Add a new alert rule"""
        self.rules.append(rule)
        logger.info(f"Added alert rule: {rule.name}")
    
    def remove_rule(self, name: str):
        """Remove an alert rule by name"""
        self.rules = [r for r in self.rules if r.name != name]
    
    async def check_alerts(self, metrics: Dict[str, Any]):
        """Check all alert rules against current metrics"""
        triggered_alerts = []
        
        for rule in self.rules:
            if rule.should_trigger(metrics):
                rule.last_triggered = datetime.utcnow()
                triggered_alerts.append(rule)
                
                # Record in history
                self.alert_history[rule.name].append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "severity": rule.severity,
                    "metrics_snapshot": metrics
                })
        
        # Send notifications for triggered alerts
        for alert in triggered_alerts:
            await self.send_alert(alert, metrics)
    
    async def send_alert(self, rule: AlertRule, metrics: Dict[str, Any]):
        """Send alert notifications through configured channels"""
        # Format message
        message_data = self._extract_message_data(rule, metrics)
        message = rule.message_template.format(**message_data)
        
        # Log alert
        if "log" in rule.channels:
            log_method = getattr(logger, rule.severity, logger.warning)
            log_method(f"ALERT: {rule.name} - {message}")
        
        # Send through notification service if available
        if self.notification_service and any(ch in ["email", "pushover", "desktop"] for ch in rule.channels):
            notification_data = {
                "subject": f"[{rule.severity.upper()}] {rule.name}",
                "message": message,
                "priority": self._severity_to_priority(rule.severity),
                "metadata": {
                    "alert_name": rule.name,
                    "severity": rule.severity,
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": message_data
                }
            }
            
            if "email" in rule.channels:
                await self.notification_service.send_email_notification(
                    notification_data["subject"],
                    self._format_email_body(rule, message, metrics),
                    notification_data["metadata"]
                )
            
            if "pushover" in rule.channels:
                await self.notification_service.send_pushover_notification(
                    notification_data["subject"],
                    message,
                    notification_data["priority"]
                )
            
            if "desktop" in rule.channels:
                await self.notification_service.send_desktop_notification(
                    notification_data["subject"],
                    message
                )
    
    def _extract_message_data(self, rule: AlertRule, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Extract relevant data for message formatting"""
        data = {}
        
        # System metrics
        if "system" in metrics:
            data.update({
                "cpu_percent": metrics["system"].get("cpu_percent", "N/A"),
                "memory_percent": metrics["system"].get("memory_percent", "N/A"),
                "disk_percent": metrics["system"].get("disk_percent", "N/A"),
            })
        
        # Application metrics
        if "application" in metrics:
            data.update({
                "error_rate": metrics["application"].get("error_rate_percent", "N/A"),
                "avg_time": metrics["application"].get("average_response_time_ms", "N/A"),
                "request_rate": metrics["application"].get("request_rate_per_minute", "N/A"),
            })
        
        # Security metrics
        if "security" in metrics:
            events = metrics["security"].get("events_last_hour", {})
            data.update({
                "count": metrics["security"].get("total_security_events", "N/A"),
                "auth_failures": events.get("auth_failure", "N/A"),
                "rate_limits": events.get("rate_limit", "N/A"),
            })
        
        return data
    
    def _severity_to_priority(self, severity: str) -> int:
        """Convert severity to notification priority"""
        mapping = {
            "info": 0,
            "warning": 1,
            "critical": 2,
        }
        return mapping.get(severity, 1)
    
    def _format_email_body(self, rule: AlertRule, message: str, metrics: Dict[str, Any]) -> str:
        """Format detailed email body with metrics"""
        body = f"""
FossaWork V2 Alert Notification

Alert: {rule.name}
Severity: {rule.severity.upper()}
Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}

{message}

Current Metrics:
===============

System:
-------
CPU Usage: {metrics.get('system', {}).get('cpu_percent', 'N/A')}%
Memory Usage: {metrics.get('system', {}).get('memory_percent', 'N/A')}%
Disk Usage: {metrics.get('system', {}).get('disk_percent', 'N/A')}%

Application:
------------
Uptime: {metrics.get('application', {}).get('uptime_hours', 'N/A'):.2f} hours
Request Rate: {metrics.get('application', {}).get('request_rate_per_minute', 'N/A')} req/min
Average Response Time: {metrics.get('application', {}).get('average_response_time_ms', 'N/A'):.2f} ms
Error Rate: {metrics.get('application', {}).get('error_rate_percent', 'N/A'):.2f}%

Security Events (Last Hour):
---------------------------
Authentication Failures: {metrics.get('security', {}).get('events_last_hour', {}).get('auth_failure', 0)}
Access Denied: {metrics.get('security', {}).get('events_last_hour', {}).get('access_denied', 0)}
Rate Limits: {metrics.get('security', {}).get('events_last_hour', {}).get('rate_limit', 0)}

This is an automated alert from the FossaWork V2 monitoring system.
"""
        return body
    
    def get_alert_history(self, hours: int = 24) -> Dict[str, List[Dict[str, Any]]]:
        """Get alert history for the specified time period"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        filtered_history = {}
        for alert_name, events in self.alert_history.items():
            filtered_events = [
                event for event in events
                if datetime.fromisoformat(event["timestamp"]) > cutoff_time
            ]
            if filtered_events:
                filtered_history[alert_name] = filtered_events
        
        return filtered_history


# Global alert manager instance
alert_manager = AlertManager()
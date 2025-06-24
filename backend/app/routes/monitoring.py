"""
Monitoring and health check API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, Optional
from datetime import datetime

from app.core.security_deps import require_admin
from app.monitoring.health_check import health_checker
from app.monitoring.metrics_collector import metrics_collector
from app.monitoring.alert_manager import alert_manager
from app.monitoring.security_monitor import security_monitor
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check():
    """Public health check endpoint for load balancers"""
    health_status = await health_checker.check_health()
    
    # Return simplified status for public endpoint
    if health_status["status"] == "healthy":
        return {"status": "ok", "timestamp": health_status["timestamp"]}
    else:
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable"
        )


@router.get("/health/detailed")
async def detailed_health_check(current_user=Depends(require_admin)):
    """Detailed health check with full diagnostics (admin only)"""
    return await health_checker.check_health()


@router.get("/metrics")
async def get_metrics(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Get comprehensive application metrics (admin only)"""
    return metrics_collector.get_all_metrics(db)


@router.get("/metrics/application")
async def get_application_metrics(current_user=Depends(require_admin)):
    """Get application-specific metrics"""
    return metrics_collector.get_application_metrics()


@router.get("/metrics/system")
async def get_system_metrics(current_user=Depends(require_admin)):
    """Get system resource metrics"""
    return metrics_collector.get_system_metrics()


@router.get("/metrics/security")
async def get_security_metrics(current_user=Depends(require_admin)):
    """Get security-related metrics"""
    return metrics_collector.get_security_metrics()


@router.get("/alerts/history")
async def get_alert_history(
    hours: int = 24,
    current_user=Depends(require_admin)
):
    """Get alert history for specified time period"""
    return alert_manager.get_alert_history(hours)


@router.get("/security/status")
async def get_security_status(current_user=Depends(require_admin)):
    """Get current security status and threat level"""
    return security_monitor.get_security_status()


@router.get("/security/incidents")
async def get_security_incidents(
    hours: int = 24,
    current_user=Depends(require_admin)
):
    """Get detailed security incident report"""
    return security_monitor.get_incident_report(hours)


@router.post("/security/block-ip")
async def block_ip(
    ip: str,
    hours: int = 24,
    current_user=Depends(require_admin)
):
    """Manually block an IP address"""
    security_monitor._block_ip(ip, hours)
    return {"message": f"IP {ip} blocked for {hours} hours"}


@router.post("/security/unblock-ip")
async def unblock_ip(
    ip: str,
    current_user=Depends(require_admin)
):
    """Manually unblock an IP address"""
    security_monitor.blocked_ips.discard(ip)
    if ip in security_monitor.ip_tracker:
        security_monitor.ip_tracker[ip]["blocked_until"] = None
    return {"message": f"IP {ip} unblocked"}


@router.get("/status")
async def overall_status():
    """Get overall system status (public endpoint)"""
    health_status = await health_checker.check_health()
    security_status = security_monitor.get_security_status()
    app_metrics = metrics_collector.get_application_metrics()
    
    # Determine overall health
    overall_health = "healthy"
    if health_status["status"] != "healthy":
        overall_health = health_status["status"]
    elif security_status["security_level"] in ["critical", "high"]:
        overall_health = "degraded"
    elif app_metrics.get("error_rate_percent", 0) > 5:
        overall_health = "degraded"
    
    return {
        "status": overall_health,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_hours": app_metrics.get("uptime_hours", 0),
        "health": health_status["status"],
        "security_level": security_status["security_level"],
        "error_rate": app_metrics.get("error_rate_percent", 0),
        "request_rate": app_metrics.get("request_rate_per_minute", 0),
        "version": "2.0.0"  # Would be from config
    }


@router.get("/dashboard")
async def monitoring_dashboard(current_user=Depends(require_admin)):
    """Get dashboard data for monitoring UI"""
    health_status = await health_checker.check_health()
    metrics = metrics_collector.get_all_metrics()
    security_status = security_monitor.get_security_status()
    alert_history = alert_manager.get_alert_history(24)
    
    return {
        "health": health_status,
        "metrics": metrics,
        "security": security_status,
        "alerts": {
            "recent_count": sum(len(alerts) for alerts in alert_history.values()),
            "critical_count": sum(
                1 for alerts in alert_history.values()
                for alert in alerts
                if alert["severity"] == "critical"
            )
        },
        "summary": {
            "overall_health": health_status["status"],
            "security_threat_level": security_status["security_level"],
            "active_blocked_ips": security_status["blocked_ips_count"],
            "uptime_hours": metrics["application"]["uptime_hours"],
            "error_rate": metrics["application"]["error_rate_percent"],
            "cpu_usage": metrics["system"]["cpu_percent"],
            "memory_usage": metrics["system"]["memory_percent"]
        }
    }
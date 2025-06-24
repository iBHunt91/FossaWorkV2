"""
Migration v006: Add Monitoring and Metrics Tables

Adds tables for system monitoring, performance metrics, and health checks.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

# Migration metadata
description = "Add monitoring, metrics, and system health tables"
dependencies = ["v001_initial_schema"]


def upgrade(session: Session, engine: Engine):
    """Create monitoring tables"""
    logger.info("Creating monitoring tables...")
    
    # Create system_metrics table for performance tracking
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS system_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_name VARCHAR(100) NOT NULL,
            metric_type VARCHAR(50) NOT NULL,
            value FLOAT NOT NULL,
            unit VARCHAR(20),
            tags TEXT,
            source VARCHAR(100),
            environment VARCHAR(50),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT
        )
    """))
    
    # Create health_checks table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS health_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_name VARCHAR(100) NOT NULL,
            check_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL,
            response_time_ms INTEGER,
            details TEXT,
            last_healthy_at TIMESTAMP,
            consecutive_failures INTEGER DEFAULT 0,
            checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create error_tracking table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS error_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            error_id VARCHAR(100) NOT NULL,
            error_type VARCHAR(100) NOT NULL,
            error_message TEXT NOT NULL,
            stack_trace TEXT,
            user_id VARCHAR(32),
            session_id VARCHAR(100),
            request_id VARCHAR(100),
            endpoint VARCHAR(255),
            user_agent TEXT,
            ip_address VARCHAR(45),
            severity VARCHAR(20),
            frequency INTEGER DEFAULT 1,
            first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved BOOLEAN DEFAULT FALSE,
            resolved_at TIMESTAMP,
            resolution_notes TEXT,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create performance_logs table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS performance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_type VARCHAR(100) NOT NULL,
            operation_name VARCHAR(255) NOT NULL,
            duration_ms INTEGER NOT NULL,
            success BOOLEAN NOT NULL,
            user_id VARCHAR(32),
            endpoint VARCHAR(255),
            method VARCHAR(10),
            status_code INTEGER,
            request_size INTEGER,
            response_size INTEGER,
            database_queries INTEGER,
            database_time_ms INTEGER,
            external_api_calls INTEGER,
            external_api_time_ms INTEGER,
            memory_used_mb FLOAT,
            cpu_percent FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create uptime_monitoring table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS uptime_monitoring (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_name VARCHAR(100) NOT NULL,
            status VARCHAR(20) NOT NULL,
            uptime_seconds INTEGER,
            downtime_seconds INTEGER,
            availability_percent FLOAT,
            last_downtime TIMESTAMP,
            downtime_reason TEXT,
            checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create resource_usage table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS resource_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type VARCHAR(50) NOT NULL,
            resource_name VARCHAR(100),
            usage_value FLOAT NOT NULL,
            usage_percent FLOAT,
            limit_value FLOAT,
            unit VARCHAR(20),
            warning_threshold FLOAT,
            critical_threshold FLOAT,
            alert_sent BOOLEAN DEFAULT FALSE,
            measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create alert_history table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type VARCHAR(100) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT,
            source VARCHAR(100),
            metric_value FLOAT,
            threshold_value FLOAT,
            recipients TEXT,
            sent_via TEXT,
            acknowledged BOOLEAN DEFAULT FALSE,
            acknowledged_by VARCHAR(255),
            acknowledged_at TIMESTAMP,
            resolved BOOLEAN DEFAULT FALSE,
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT
        )
    """))
    
    # Create background_jobs table for job monitoring
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS background_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id VARCHAR(100) NOT NULL UNIQUE,
            job_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL,
            progress INTEGER,
            total_items INTEGER,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            next_retry_at TIMESTAMP,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            error_message TEXT,
            result_data TEXT,
            created_by VARCHAR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT
        )
    """))
    
    # Create database_stats table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS database_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name VARCHAR(100) NOT NULL,
            row_count INTEGER,
            size_bytes INTEGER,
            index_count INTEGER,
            last_vacuum TIMESTAMP,
            last_analyze TIMESTAMP,
            fragmentation_percent FLOAT,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create api_endpoint_stats table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS api_endpoint_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(10) NOT NULL,
            total_calls INTEGER DEFAULT 0,
            successful_calls INTEGER DEFAULT 0,
            failed_calls INTEGER DEFAULT 0,
            avg_response_time_ms FLOAT,
            p95_response_time_ms FLOAT,
            p99_response_time_ms FLOAT,
            last_called TIMESTAMP,
            period_start TIMESTAMP,
            period_end TIMESTAMP
        )
    """))
    
    # Create indexes
    session.execute(text("CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name)"))
    session.execute(text("CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp)"))
    session.execute(text("CREATE INDEX idx_health_checks_service ON health_checks(service_name)"))
    session.execute(text("CREATE INDEX idx_health_checks_status ON health_checks(status)"))
    session.execute(text("CREATE INDEX idx_error_tracking_type ON error_tracking(error_type)"))
    session.execute(text("CREATE INDEX idx_error_tracking_user ON error_tracking(user_id)"))
    session.execute(text("CREATE INDEX idx_error_tracking_unresolved ON error_tracking(resolved, last_seen)"))
    session.execute(text("CREATE INDEX idx_performance_logs_operation ON performance_logs(operation_type)"))
    session.execute(text("CREATE INDEX idx_performance_logs_duration ON performance_logs(duration_ms)"))
    session.execute(text("CREATE INDEX idx_performance_logs_created ON performance_logs(created_at)"))
    session.execute(text("CREATE INDEX idx_resource_usage_type ON resource_usage(resource_type)"))
    session.execute(text("CREATE INDEX idx_alert_history_type ON alert_history(alert_type)"))
    session.execute(text("CREATE INDEX idx_alert_history_severity ON alert_history(severity)"))
    session.execute(text("CREATE INDEX idx_alert_history_unresolved ON alert_history(resolved, created_at)"))
    session.execute(text("CREATE INDEX idx_background_jobs_status ON background_jobs(status)"))
    session.execute(text("CREATE INDEX idx_background_jobs_type ON background_jobs(job_type)"))
    session.execute(text("CREATE INDEX idx_api_endpoint_stats_endpoint ON api_endpoint_stats(endpoint, method)"))
    
    # Create composite indexes for common queries
    session.execute(text("""
        CREATE INDEX idx_system_metrics_name_time 
        ON system_metrics(metric_name, timestamp DESC)
    """))
    
    session.execute(text("""
        CREATE INDEX idx_performance_logs_user_time 
        ON performance_logs(user_id, created_at DESC)
    """))
    
    logger.info("Monitoring tables created successfully")


def downgrade(session: Session, engine: Engine):
    """Drop monitoring tables"""
    logger.warning("Dropping monitoring tables...")
    
    # Drop indexes
    indexes = [
        "idx_system_metrics_name", "idx_system_metrics_timestamp", "idx_system_metrics_name_time",
        "idx_health_checks_service", "idx_health_checks_status",
        "idx_error_tracking_type", "idx_error_tracking_user", "idx_error_tracking_unresolved",
        "idx_performance_logs_operation", "idx_performance_logs_duration", 
        "idx_performance_logs_created", "idx_performance_logs_user_time",
        "idx_resource_usage_type",
        "idx_alert_history_type", "idx_alert_history_severity", "idx_alert_history_unresolved",
        "idx_background_jobs_status", "idx_background_jobs_type",
        "idx_api_endpoint_stats_endpoint"
    ]
    
    for index in indexes:
        try:
            session.execute(text(f"DROP INDEX IF EXISTS {index}"))
        except Exception as e:
            logger.warning(f"Failed to drop index {index}: {e}")
    
    # Drop tables
    tables = [
        "api_endpoint_stats", "database_stats", "background_jobs",
        "alert_history", "resource_usage", "uptime_monitoring",
        "performance_logs", "error_tracking", "health_checks",
        "system_metrics"
    ]
    
    for table in tables:
        session.execute(text(f"DROP TABLE IF EXISTS {table}"))
    
    logger.info("Monitoring tables dropped")
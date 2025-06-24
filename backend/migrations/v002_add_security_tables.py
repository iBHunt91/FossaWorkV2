"""
Migration v002: Add Security Tables

Adds comprehensive security event logging and tracking tables.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

# Migration metadata
description = "Add security event logging and audit tables"
dependencies = ["v001_initial_schema"]


def upgrade(session: Session, engine: Engine):
    """Create security-related tables"""
    logger.info("Creating security tables...")
    
    # Create security_events table for tracking all security-related events
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS security_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            user_id VARCHAR(32),
            ip_address VARCHAR(45),
            user_agent TEXT,
            endpoint VARCHAR(255),
            method VARCHAR(10),
            status_code INTEGER,
            request_data TEXT,
            response_data TEXT,
            error_message TEXT,
            stack_trace TEXT,
            session_id VARCHAR(100),
            correlation_id VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create failed_login_attempts table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS failed_login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            failure_reason VARCHAR(100),
            attempt_count INTEGER DEFAULT 1,
            locked_until TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create api_access_logs table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS api_access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32),
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(10) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            request_headers TEXT,
            request_body TEXT,
            response_status INTEGER,
            response_time_ms INTEGER,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create suspicious_activities table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS suspicious_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_type VARCHAR(100) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            user_id VARCHAR(32),
            ip_address VARCHAR(45),
            details TEXT,
            detection_method VARCHAR(100),
            action_taken VARCHAR(100),
            resolved BOOLEAN DEFAULT FALSE,
            resolved_by VARCHAR(255),
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create data_access_audit table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS data_access_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32) NOT NULL,
            resource_type VARCHAR(100) NOT NULL,
            resource_id VARCHAR(100),
            action VARCHAR(50) NOT NULL,
            old_value TEXT,
            new_value TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create session_tokens table for better token management
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS session_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32) NOT NULL,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            token_type VARCHAR(20) DEFAULT 'access',
            expires_at TIMESTAMP NOT NULL,
            revoked BOOLEAN DEFAULT FALSE,
            revoked_at TIMESTAMP,
            revoked_reason VARCHAR(255),
            ip_address VARCHAR(45),
            user_agent TEXT,
            last_used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create indexes for performance
    session.execute(text("CREATE INDEX idx_security_events_type ON security_events(event_type)"))
    session.execute(text("CREATE INDEX idx_security_events_user ON security_events(user_id)"))
    session.execute(text("CREATE INDEX idx_security_events_created ON security_events(created_at)"))
    session.execute(text("CREATE INDEX idx_failed_login_email ON failed_login_attempts(email)"))
    session.execute(text("CREATE INDEX idx_failed_login_ip ON failed_login_attempts(ip_address)"))
    session.execute(text("CREATE INDEX idx_api_access_user ON api_access_logs(user_id)"))
    session.execute(text("CREATE INDEX idx_api_access_endpoint ON api_access_logs(endpoint)"))
    session.execute(text("CREATE INDEX idx_suspicious_user ON suspicious_activities(user_id)"))
    session.execute(text("CREATE INDEX idx_suspicious_type ON suspicious_activities(activity_type)"))
    session.execute(text("CREATE INDEX idx_data_audit_user ON data_access_audit(user_id)"))
    session.execute(text("CREATE INDEX idx_data_audit_resource ON data_access_audit(resource_type, resource_id)"))
    session.execute(text("CREATE INDEX idx_session_tokens_user ON session_tokens(user_id)"))
    session.execute(text("CREATE INDEX idx_session_tokens_hash ON session_tokens(token_hash)"))
    
    logger.info("Security tables created successfully")


def downgrade(session: Session, engine: Engine):
    """Drop security tables"""
    logger.warning("Dropping security tables...")
    
    # Drop indexes first
    indexes = [
        "idx_security_events_type", "idx_security_events_user", "idx_security_events_created",
        "idx_failed_login_email", "idx_failed_login_ip",
        "idx_api_access_user", "idx_api_access_endpoint",
        "idx_suspicious_user", "idx_suspicious_type",
        "idx_data_audit_user", "idx_data_audit_resource",
        "idx_session_tokens_user", "idx_session_tokens_hash"
    ]
    
    for index in indexes:
        try:
            session.execute(text(f"DROP INDEX IF EXISTS {index}"))
        except Exception as e:
            logger.warning(f"Failed to drop index {index}: {e}")
    
    # Drop tables
    tables = [
        "session_tokens", "data_access_audit", "suspicious_activities",
        "api_access_logs", "failed_login_attempts", "security_events"
    ]
    
    for table in tables:
        session.execute(text(f"DROP TABLE IF EXISTS {table}"))
    
    logger.info("Security tables dropped")
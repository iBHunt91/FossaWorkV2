"""
Migration v005: Add Comprehensive Audit Tables

Adds detailed audit trail tables for compliance and security monitoring.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

# Migration metadata
description = "Add comprehensive audit trail and compliance tables"
dependencies = ["v001_initial_schema", "v002_add_security_tables"]


def upgrade(session: Session, engine: Engine):
    """Create audit tables"""
    logger.info("Creating audit tables...")
    
    # Create audit_trail table for all system changes
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS audit_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audit_id VARCHAR(100) NOT NULL UNIQUE,
            table_name VARCHAR(100) NOT NULL,
            record_id VARCHAR(100),
            action VARCHAR(20) NOT NULL,
            user_id VARCHAR(32),
            ip_address VARCHAR(45),
            user_agent TEXT,
            changes_json TEXT,
            before_json TEXT,
            after_json TEXT,
            reason TEXT,
            tags TEXT,
            session_id VARCHAR(100),
            request_id VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create compliance_logs table for regulatory compliance
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS compliance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            compliance_type VARCHAR(100) NOT NULL,
            regulation VARCHAR(100),
            user_id VARCHAR(32),
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(100),
            resource_id VARCHAR(100),
            data_classification VARCHAR(50),
            retention_period_days INTEGER,
            deletion_scheduled_at TIMESTAMP,
            deleted_at TIMESTAMP,
            audit_notes TEXT,
            metadata_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create data_retention_policies table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS data_retention_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            policy_name VARCHAR(100) NOT NULL UNIQUE,
            data_type VARCHAR(100) NOT NULL,
            retention_days INTEGER NOT NULL,
            deletion_strategy VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            legal_basis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create privacy_requests table for GDPR/CCPA requests
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS privacy_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id VARCHAR(100) NOT NULL UNIQUE,
            user_id VARCHAR(32) NOT NULL,
            request_type VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            processed_by VARCHAR(255),
            data_exported TEXT,
            deletion_confirmed BOOLEAN DEFAULT FALSE,
            notes TEXT,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create configuration_audit table for system config changes
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS configuration_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key VARCHAR(255) NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_by VARCHAR(32),
            change_reason TEXT,
            environment VARCHAR(50),
            service_name VARCHAR(100),
            rollback_value TEXT,
            rolled_back BOOLEAN DEFAULT FALSE,
            rolled_back_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (changed_by) REFERENCES users(id)
        )
    """))
    
    # Create access_control_audit table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS access_control_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32) NOT NULL,
            resource_type VARCHAR(100) NOT NULL,
            resource_id VARCHAR(100),
            permission VARCHAR(100) NOT NULL,
            granted BOOLEAN NOT NULL,
            grant_reason TEXT,
            granted_by VARCHAR(32),
            expires_at TIMESTAMP,
            revoked BOOLEAN DEFAULT FALSE,
            revoked_at TIMESTAMP,
            revoked_by VARCHAR(32),
            revoke_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (granted_by) REFERENCES users(id),
            FOREIGN KEY (revoked_by) REFERENCES users(id)
        )
    """))
    
    # Create file_access_audit table for sensitive file access
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS file_access_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32),
            file_path TEXT NOT NULL,
            file_type VARCHAR(50),
            action VARCHAR(50) NOT NULL,
            success BOOLEAN NOT NULL,
            error_message TEXT,
            file_size INTEGER,
            checksum VARCHAR(64),
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create export_audit table for data export tracking
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS export_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32) NOT NULL,
            export_type VARCHAR(100) NOT NULL,
            format VARCHAR(50),
            filters_applied TEXT,
            record_count INTEGER,
            file_size INTEGER,
            destination VARCHAR(255),
            purpose TEXT,
            expires_at TIMESTAMP,
            deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Insert default retention policies
    default_policies = [
        ("user_activity_logs", "user_activities", 365, "archive"),
        ("security_events", "security_events", 730, "archive"),
        ("api_access_logs", "api_access_logs", 90, "delete"),
        ("failed_logins", "failed_login_attempts", 180, "delete"),
        ("audit_trail", "audit_trail", 2555, "archive"),  # 7 years
        ("compliance_logs", "compliance_logs", 2555, "archive"),
        ("session_data", "user_sessions", 30, "delete"),
        ("temporary_files", "temp_files", 7, "delete")
    ]
    
    for policy in default_policies:
        session.execute(text("""
            INSERT INTO data_retention_policies 
            (policy_name, data_type, retention_days, deletion_strategy)
            VALUES (:name, :type, :days, :strategy)
        """), {
            'name': policy[0],
            'type': policy[1],
            'days': policy[2],
            'strategy': policy[3]
        })
    
    # Create indexes
    session.execute(text("CREATE INDEX idx_audit_trail_table ON audit_trail(table_name)"))
    session.execute(text("CREATE INDEX idx_audit_trail_user ON audit_trail(user_id)"))
    session.execute(text("CREATE INDEX idx_audit_trail_created ON audit_trail(created_at)"))
    session.execute(text("CREATE INDEX idx_audit_trail_action ON audit_trail(action)"))
    session.execute(text("CREATE INDEX idx_compliance_logs_type ON compliance_logs(compliance_type)"))
    session.execute(text("CREATE INDEX idx_compliance_logs_user ON compliance_logs(user_id)"))
    session.execute(text("CREATE INDEX idx_privacy_requests_user ON privacy_requests(user_id)"))
    session.execute(text("CREATE INDEX idx_privacy_requests_status ON privacy_requests(status)"))
    session.execute(text("CREATE INDEX idx_config_audit_key ON configuration_audit(config_key)"))
    session.execute(text("CREATE INDEX idx_access_control_user ON access_control_audit(user_id)"))
    session.execute(text("CREATE INDEX idx_access_control_resource ON access_control_audit(resource_type, resource_id)"))
    session.execute(text("CREATE INDEX idx_file_access_user ON file_access_audit(user_id)"))
    session.execute(text("CREATE INDEX idx_export_audit_user ON export_audit(user_id)"))
    
    logger.info("Audit tables created successfully")


def downgrade(session: Session, engine: Engine):
    """Drop audit tables"""
    logger.warning("Dropping audit tables...")
    
    # Drop indexes
    indexes = [
        "idx_audit_trail_table", "idx_audit_trail_user", "idx_audit_trail_created", "idx_audit_trail_action",
        "idx_compliance_logs_type", "idx_compliance_logs_user",
        "idx_privacy_requests_user", "idx_privacy_requests_status",
        "idx_config_audit_key",
        "idx_access_control_user", "idx_access_control_resource",
        "idx_file_access_user",
        "idx_export_audit_user"
    ]
    
    for index in indexes:
        try:
            session.execute(text(f"DROP INDEX IF EXISTS {index}"))
        except Exception as e:
            logger.warning(f"Failed to drop index {index}: {e}")
    
    # Drop tables
    tables = [
        "export_audit", "file_access_audit", "access_control_audit",
        "configuration_audit", "privacy_requests", "data_retention_policies",
        "compliance_logs", "audit_trail"
    ]
    
    for table in tables:
        session.execute(text(f"DROP TABLE IF EXISTS {table}"))
    
    logger.info("Audit tables dropped")
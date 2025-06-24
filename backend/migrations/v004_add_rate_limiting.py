"""
Migration v004: Add Rate Limiting Tables

Adds tables for API rate limiting and throttling.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

# Migration metadata
description = "Add rate limiting and API throttling tables"
dependencies = ["v001_initial_schema", "v002_add_security_tables"]


def upgrade(session: Session, engine: Engine):
    """Create rate limiting tables"""
    logger.info("Creating rate limiting tables...")
    
    # Create rate_limit_rules table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS rate_limit_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL UNIQUE,
            endpoint_pattern VARCHAR(255),
            method VARCHAR(10),
            max_requests INTEGER NOT NULL,
            window_seconds INTEGER NOT NULL,
            burst_size INTEGER,
            applies_to VARCHAR(50) DEFAULT 'all',
            user_tier VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    # Create rate_limit_buckets table for token bucket algorithm
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS rate_limit_buckets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bucket_key VARCHAR(255) NOT NULL UNIQUE,
            rule_id INTEGER NOT NULL,
            tokens FLOAT NOT NULL,
            last_refill TIMESTAMP NOT NULL,
            total_requests INTEGER DEFAULT 0,
            total_rejected INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rule_id) REFERENCES rate_limit_rules(id)
        )
    """))
    
    # Create rate_limit_violations table
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS rate_limit_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32),
            ip_address VARCHAR(45) NOT NULL,
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(10),
            rule_id INTEGER,
            requests_made INTEGER,
            limit_exceeded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            blocked_until TIMESTAMP,
            violation_count INTEGER DEFAULT 1,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (rule_id) REFERENCES rate_limit_rules(id)
        )
    """))
    
    # Create api_quotas table for user/tier-based quotas
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS api_quotas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(32),
            tier VARCHAR(50) DEFAULT 'free',
            endpoint_group VARCHAR(100),
            daily_limit INTEGER,
            monthly_limit INTEGER,
            daily_used INTEGER DEFAULT 0,
            monthly_used INTEGER DEFAULT 0,
            reset_daily_at TIMESTAMP,
            reset_monthly_at TIMESTAMP,
            overage_allowed BOOLEAN DEFAULT FALSE,
            overage_rate FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create throttle_events table for tracking throttling events
    session.execute(text("""
        CREATE TABLE IF NOT EXISTS throttle_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type VARCHAR(50) NOT NULL,
            user_id VARCHAR(32),
            ip_address VARCHAR(45),
            endpoint VARCHAR(255),
            reason VARCHAR(255),
            duration_seconds INTEGER,
            requests_dropped INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Insert default rate limit rules
    default_rules = [
        # Authentication endpoints - strict limits
        ("login_attempt", "/api/auth/login", "POST", 5, 300, 2, "ip", None),
        ("password_reset", "/api/auth/reset-password", "POST", 3, 3600, 1, "ip", None),
        ("register", "/api/auth/register", "POST", 3, 3600, 1, "ip", None),
        
        # API endpoints - per user limits
        ("api_general", "/api/*", None, 100, 60, 20, "user", "free"),
        ("api_premium", "/api/*", None, 1000, 60, 100, "user", "premium"),
        ("api_enterprise", "/api/*", None, 10000, 60, 500, "user", "enterprise"),
        
        # Specific resource-intensive endpoints
        ("scraping", "/api/scraping/*", None, 10, 300, 2, "user", None),
        ("automation", "/api/automation/*", None, 20, 300, 5, "user", None),
        ("bulk_operations", "/api/bulk/*", None, 5, 600, 1, "user", None),
        
        # Public endpoints - very strict
        ("public_api", "/api/public/*", None, 10, 3600, 2, "ip", None)
    ]
    
    for rule in default_rules:
        session.execute(text("""
            INSERT INTO rate_limit_rules 
            (name, endpoint_pattern, method, max_requests, window_seconds, burst_size, applies_to, user_tier)
            VALUES (:name, :endpoint, :method, :max_req, :window, :burst, :applies, :tier)
        """), {
            'name': rule[0],
            'endpoint': rule[1],
            'method': rule[2],
            'max_req': rule[3],
            'window': rule[4],
            'burst': rule[5],
            'applies': rule[6],
            'tier': rule[7]
        })
    
    # Create indexes
    session.execute(text("CREATE INDEX idx_rate_limit_buckets_key ON rate_limit_buckets(bucket_key)"))
    session.execute(text("CREATE INDEX idx_rate_limit_violations_user ON rate_limit_violations(user_id)"))
    session.execute(text("CREATE INDEX idx_rate_limit_violations_ip ON rate_limit_violations(ip_address)"))
    session.execute(text("CREATE INDEX idx_rate_limit_violations_time ON rate_limit_violations(limit_exceeded_at)"))
    session.execute(text("CREATE INDEX idx_api_quotas_user ON api_quotas(user_id)"))
    session.execute(text("CREATE INDEX idx_throttle_events_user ON throttle_events(user_id)"))
    session.execute(text("CREATE INDEX idx_throttle_events_created ON throttle_events(created_at)")
    
    logger.info("Rate limiting tables created successfully")


def downgrade(session: Session, engine: Engine):
    """Drop rate limiting tables"""
    logger.warning("Dropping rate limiting tables...")
    
    # Drop indexes
    indexes = [
        "idx_rate_limit_buckets_key",
        "idx_rate_limit_violations_user", "idx_rate_limit_violations_ip", "idx_rate_limit_violations_time",
        "idx_api_quotas_user",
        "idx_throttle_events_user", "idx_throttle_events_created"
    ]
    
    for index in indexes:
        try:
            session.execute(text(f"DROP INDEX IF EXISTS {index}"))
        except Exception as e:
            logger.warning(f"Failed to drop index {index}: {e}")
    
    # Drop tables in correct order due to foreign keys
    tables = [
        "throttle_events", "api_quotas", "rate_limit_violations",
        "rate_limit_buckets", "rate_limit_rules"
    ]
    
    for table in tables:
        session.execute(text(f"DROP TABLE IF EXISTS {table}"))
    
    logger.info("Rate limiting tables dropped")
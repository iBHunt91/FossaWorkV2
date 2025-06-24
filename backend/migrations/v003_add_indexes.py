"""
Migration v003: Add Performance Indexes

Adds comprehensive indexes for optimal query performance.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

# Migration metadata
description = "Add performance indexes to all tables"
dependencies = ["v001_initial_schema", "v002_add_security_tables"]


def upgrade(session: Session, engine: Engine):
    """Create performance indexes"""
    logger.info("Creating performance indexes...")
    
    # User-related indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email))"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_users_last_used ON users(last_used)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_user_preferences_updated ON user_preferences(updated_at)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_user_activities_created_desc ON user_activities(created_at DESC)"))
    
    # Work order indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_user_status ON work_orders(user_id, status)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled ON work_orders(scheduled_date)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_external ON work_orders(external_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_store ON work_orders(store_number)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_service ON work_orders(service_code)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_work_orders_visit ON work_orders(visit_number)"))
    
    # Dispenser indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_dispensers_work_order_number ON dispensers(work_order_id, dispenser_number)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_dispensers_status ON dispensers(status)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_dispensers_automation ON dispensers(automation_completed)"))
    
    # Automation job indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_automation_jobs_user_status ON automation_jobs(user_id, status)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_automation_jobs_created ON automation_jobs(created_at DESC)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_automation_jobs_type ON automation_jobs(job_type)"))
    
    # Scraping schedule indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_scraping_schedules_user_active ON scraping_schedules(user_id, is_active)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_scraping_schedules_next_run ON scraping_schedules(next_run)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_scraping_schedules_type ON scraping_schedules(schedule_type)"))
    
    # Notification indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type)"))
    
    # Filter inventory indexes
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_filter_inventory_user ON filter_inventory(user_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_filter_calc_user ON filter_calculations(user_id)"))
    session.execute(text("CREATE INDEX IF NOT EXISTS idx_filter_calc_created ON filter_calculations(created_at DESC)"))
    
    # Composite indexes for common queries
    session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_work_orders_user_scheduled_status 
        ON work_orders(user_id, scheduled_date, status)
    """))
    
    session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_dispensers_work_order_status_automation 
        ON dispensers(work_order_id, status, automation_completed)
    """))
    
    session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_user_activities_user_type_created 
        ON user_activities(user_id, activity_type, created_at DESC)
    """))
    
    # Full-text search indexes (if supported)
    try:
        # For SQLite, we can create FTS virtual tables for search
        session.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS work_orders_fts USING fts5(
                site_name, address, notes, instructions,
                content='work_orders',
                content_rowid='rowid'
            )
        """))
        
        # Trigger to keep FTS in sync
        session.execute(text("""
            CREATE TRIGGER IF NOT EXISTS work_orders_fts_insert 
            AFTER INSERT ON work_orders BEGIN
                INSERT INTO work_orders_fts(rowid, site_name, address, notes, instructions)
                VALUES (new.rowid, new.site_name, new.address, new.notes, new.instructions);
            END
        """))
        
        session.execute(text("""
            CREATE TRIGGER IF NOT EXISTS work_orders_fts_update 
            AFTER UPDATE ON work_orders BEGIN
                UPDATE work_orders_fts 
                SET site_name = new.site_name, 
                    address = new.address,
                    notes = new.notes,
                    instructions = new.instructions
                WHERE rowid = new.rowid;
            END
        """))
        
        session.execute(text("""
            CREATE TRIGGER IF NOT EXISTS work_orders_fts_delete 
            AFTER DELETE ON work_orders BEGIN
                DELETE FROM work_orders_fts WHERE rowid = old.rowid;
            END
        """))
        
        logger.info("Full-text search indexes created")
    except Exception as e:
        logger.warning(f"Could not create FTS indexes (may not be supported): {e}")
    
    logger.info("Performance indexes created successfully")


def downgrade(session: Session, engine: Engine):
    """Drop performance indexes"""
    logger.warning("Dropping performance indexes...")
    
    # List of all indexes to drop
    indexes = [
        # User indexes
        "idx_users_email_lower", "idx_users_last_used",
        "idx_user_preferences_updated", "idx_user_activities_created_desc",
        
        # Work order indexes
        "idx_work_orders_user_status", "idx_work_orders_scheduled",
        "idx_work_orders_external", "idx_work_orders_store",
        "idx_work_orders_service", "idx_work_orders_visit",
        
        # Dispenser indexes
        "idx_dispensers_work_order_number", "idx_dispensers_status",
        "idx_dispensers_automation",
        
        # Automation indexes
        "idx_automation_jobs_user_status", "idx_automation_jobs_created",
        "idx_automation_jobs_type",
        
        # Scraping indexes
        "idx_scraping_schedules_user_active", "idx_scraping_schedules_next_run",
        "idx_scraping_schedules_type",
        
        # Notification indexes
        "idx_notifications_user_read", "idx_notifications_created",
        "idx_notifications_type",
        
        # Filter indexes
        "idx_filter_inventory_user", "idx_filter_calc_user",
        "idx_filter_calc_created",
        
        # Composite indexes
        "idx_work_orders_user_scheduled_status",
        "idx_dispensers_work_order_status_automation",
        "idx_user_activities_user_type_created"
    ]
    
    for index in indexes:
        try:
            session.execute(text(f"DROP INDEX IF EXISTS {index}"))
        except Exception as e:
            logger.warning(f"Failed to drop index {index}: {e}")
    
    # Drop FTS tables and triggers
    try:
        session.execute(text("DROP TRIGGER IF EXISTS work_orders_fts_insert"))
        session.execute(text("DROP TRIGGER IF EXISTS work_orders_fts_update"))
        session.execute(text("DROP TRIGGER IF EXISTS work_orders_fts_delete"))
        session.execute(text("DROP TABLE IF EXISTS work_orders_fts"))
    except Exception as e:
        logger.warning(f"Failed to drop FTS: {e}")
    
    logger.info("Performance indexes dropped")
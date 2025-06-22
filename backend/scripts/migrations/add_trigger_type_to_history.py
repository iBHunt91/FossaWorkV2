#!/usr/bin/env python3
"""
Add trigger_type column to scraping_history table
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models.scraping_models import ScrapingHistory
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_trigger_type_column():
    """Add trigger_type column to scraping_history table"""
    
    logger.info("Starting migration: Adding trigger_type column to scraping_history")
    
    # Create connection
    with engine.connect() as conn:
        try:
            # Check if column already exists
            result = conn.execute(text(
                "SELECT COUNT(*) FROM pragma_table_info('scraping_history') WHERE name='trigger_type'"
            ))
            column_exists = result.scalar() > 0
            
            if column_exists:
                logger.info("Column 'trigger_type' already exists, skipping migration")
                return
            
            # Add the column
            logger.info("Adding trigger_type column...")
            conn.execute(text(
                "ALTER TABLE scraping_history ADD COLUMN trigger_type VARCHAR DEFAULT 'scheduled'"
            ))
            conn.commit()
            
            logger.info("Successfully added trigger_type column")
            
            # Update existing records based on patterns
            logger.info("Updating existing records...")
            
            # Mark all existing records as 'scheduled' (default is already set)
            # In the future, we could analyze patterns to identify manual runs
            
            logger.info("Migration completed successfully!")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            conn.rollback()
            raise


def verify_migration():
    """Verify the migration was successful"""
    db = SessionLocal()
    try:
        # Try to query with the new column
        sample = db.query(ScrapingHistory).first()
        if sample:
            trigger_type = getattr(sample, 'trigger_type', None)
            logger.info(f"Verification: Found record with trigger_type = {trigger_type}")
        else:
            logger.info("No records found to verify")
        
        # Check column info
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT * FROM pragma_table_info('scraping_history') WHERE name='trigger_type'"
            ))
            col_info = result.fetchone()
            if col_info:
                logger.info(f"Column info found: trigger_type column exists")
            else:
                logger.error("Column not found in table info!")
                
    finally:
        db.close()


if __name__ == "__main__":
    try:
        add_trigger_type_column()
        verify_migration()
    except Exception as e:
        logger.error(f"Migration script failed: {e}")
        sys.exit(1)
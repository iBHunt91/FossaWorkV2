#!/usr/bin/env python3
"""
Database migration to add new work order fields
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_new_columns():
    """Add new columns to work_orders table"""
    engine = create_engine(DATABASE_URL)
    
    new_columns = [
        ("service_name", "VARCHAR(200)"),
        ("service_items", "TEXT"),  # Will store JSON array as text
        ("street", "VARCHAR(500)"),
        ("city_state", "VARCHAR(200)"),
        ("county", "VARCHAR(100)"),
        ("created_date", "DATETIME"),
        ("created_by", "VARCHAR(200)"),
        ("customer_url", "TEXT")
    ]
    
    with engine.connect() as conn:
        # Check which columns already exist
        result = conn.execute(text("PRAGMA table_info(work_orders)"))
        existing_columns = [row[1] for row in result]
        
        # Add missing columns
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE work_orders ADD COLUMN {column_name} {column_type}"
                    conn.execute(text(alter_sql))
                    conn.commit()
                    logger.info(f"✅ Added column: {column_name}")
                except Exception as e:
                    if "duplicate column name" in str(e).lower():
                        logger.info(f"⏭️  Column {column_name} already exists")
                    else:
                        logger.error(f"❌ Error adding column {column_name}: {e}")
            else:
                logger.info(f"⏭️  Column {column_name} already exists")
        
        logger.info("✅ Migration completed")

if __name__ == "__main__":
    logger.info("Starting database migration...")
    add_new_columns()
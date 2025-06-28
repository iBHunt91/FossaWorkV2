#!/usr/bin/env python3
"""
Add performance indexes to the database to optimize query performance

This script adds indexes to commonly queried columns to prevent full table scans
and improve query performance, especially for N+1 query patterns.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError
import logging
from datetime import datetime
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Index definitions
INDEXES = [
    # Work Orders - Most critical for performance
    {
        'table': 'work_orders',
        'name': 'idx_work_orders_user_id',
        'columns': ['user_id'],
        'reason': 'Speed up user-specific work order queries'
    },
    {
        'table': 'work_orders',
        'name': 'idx_work_orders_scheduled_date',
        'columns': ['scheduled_date'],
        'reason': 'Speed up date-based sorting and filtering'
    },
    {
        'table': 'work_orders',
        'name': 'idx_work_orders_status',
        'columns': ['status'],
        'reason': 'Speed up status filtering'
    },
    {
        'table': 'work_orders',
        'name': 'idx_work_orders_service_code',
        'columns': ['service_code'],
        'reason': 'Speed up service code filtering'
    },
    {
        'table': 'work_orders',
        'name': 'idx_work_orders_user_status',
        'columns': ['user_id', 'status'],
        'reason': 'Composite index for common query pattern'
    },
    
    # Dispensers - Fix N+1 queries
    {
        'table': 'dispensers',
        'name': 'idx_dispensers_work_order_id',
        'columns': ['work_order_id'],
        'reason': 'Critical for fixing N+1 queries when loading dispensers'
    },
    {
        'table': 'dispensers',
        'name': 'idx_dispensers_dispenser_number',
        'columns': ['dispenser_number'],
        'reason': 'Speed up dispenser lookups by number'
    },
    
    # Users
    {
        'table': 'users',
        'name': 'idx_users_username',
        'columns': ['username'],
        'unique': True,
        'reason': 'Speed up login queries'
    },
    {
        'table': 'users',
        'name': 'idx_users_email',
        'columns': ['email'],
        'unique': True,
        'reason': 'Speed up email lookups'
    },
    
    # Scraping Schedules
    {
        'table': 'scraping_schedules',
        'name': 'idx_scraping_schedules_user_id',
        'columns': ['user_id'],
        'reason': 'Speed up user schedule queries'
    },
    {
        'table': 'scraping_schedules',
        'name': 'idx_scraping_schedules_is_active',
        'columns': ['is_active'],
        'reason': 'Speed up active schedule queries'
    },
    
    # Filter Inventory
    {
        'table': 'filter_inventory',
        'name': 'idx_filter_inventory_user_id',
        'columns': ['user_id'],
        'reason': 'Speed up user filter queries'
    },
    
    # Automation Tasks
    {
        'table': 'batch_automation_tasks',
        'name': 'idx_batch_automation_user_id',
        'columns': ['user_id'],
        'reason': 'Speed up user automation task queries'
    },
    {
        'table': 'batch_automation_tasks',
        'name': 'idx_batch_automation_status',
        'columns': ['status'],
        'reason': 'Speed up status filtering'
    }
]

def create_index(engine, index_def):
    """Create a single index"""
    table = index_def['table']
    name = index_def['name']
    columns = index_def['columns']
    unique = index_def.get('unique', False)
    reason = index_def['reason']
    
    try:
        # Check if index already exists
        inspector = inspect(engine)
        existing_indexes = inspector.get_indexes(table)
        existing_names = [idx['name'] for idx in existing_indexes]
        
        if name in existing_names:
            logger.info(f"✓ Index {name} already exists on {table}")
            return True
        
        # Build CREATE INDEX statement
        unique_clause = "UNIQUE " if unique else ""
        columns_str = ", ".join(columns)
        sql = f"CREATE {unique_clause}INDEX {name} ON {table} ({columns_str})"
        
        # Execute
        with engine.connect() as conn:
            logger.info(f"Creating index {name} on {table}.{columns_str}")
            logger.info(f"  Reason: {reason}")
            
            start_time = datetime.now()
            conn.execute(text(sql))
            conn.commit()
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"✓ Index {name} created successfully in {elapsed:.2f}s")
            
        return True
        
    except OperationalError as e:
        if "already exists" in str(e):
            logger.info(f"✓ Index {name} already exists")
            return True
        else:
            logger.error(f"✗ Failed to create index {name}: {e}")
            return False
    except Exception as e:
        logger.error(f"✗ Unexpected error creating index {name}: {e}")
        return False

def analyze_tables(engine):
    """Run ANALYZE on tables to update statistics"""
    tables = set(idx['table'] for idx in INDEXES)
    
    logger.info("\nUpdating table statistics...")
    
    for table in tables:
        try:
            with engine.connect() as conn:
                # SQLite uses ANALYZE, PostgreSQL uses ANALYZE
                if 'sqlite' in engine.dialect.name:
                    conn.execute(text(f"ANALYZE {table}"))
                else:
                    conn.execute(text(f"ANALYZE {table}"))
                conn.commit()
                logger.info(f"✓ Analyzed table {table}")
        except Exception as e:
            logger.warning(f"Could not analyze table {table}: {e}")

def check_database_size(engine):
    """Check database size and table row counts"""
    logger.info("\nDatabase Statistics:")
    
    try:
        with engine.connect() as conn:
            # Get table sizes
            for table in ['work_orders', 'dispensers', 'users']:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                logger.info(f"  {table}: {count:,} rows")
                
    except Exception as e:
        logger.warning(f"Could not get database statistics: {e}")

def main():
    """Main function to create all indexes"""
    logger.info("🚀 Performance Index Creation Script")
    logger.info("=" * 50)
    
    # Create database engine
    database_url = settings.DATABASE_URL
    if not database_url:
        database_url = "sqlite:///./fossawork_v2.db"
    
    logger.info(f"Database: {database_url}")
    engine = create_engine(database_url)
    
    # Check database size
    check_database_size(engine)
    
    # Create indexes
    logger.info("\nCreating indexes...")
    success_count = 0
    total_count = len(INDEXES)
    
    for index_def in INDEXES:
        if create_index(engine, index_def):
            success_count += 1
    
    # Analyze tables
    analyze_tables(engine)
    
    # Summary
    logger.info("\n" + "=" * 50)
    logger.info(f"Summary: {success_count}/{total_count} indexes created/verified")
    
    if success_count == total_count:
        logger.info("✅ All indexes are in place!")
        logger.info("\nExpected Performance Improvements:")
        logger.info("- User work order queries: 10-100x faster")
        logger.info("- Dispenser loading (N+1 fix): 50-500x faster") 
        logger.info("- Login queries: 10-50x faster")
        logger.info("- Filter queries: 20-100x faster")
    else:
        logger.warning(f"⚠️  {total_count - success_count} indexes could not be created")
        logger.warning("Please check the errors above and run again")
    
    logger.info("\n💡 Next Steps:")
    logger.info("1. Run the query profiler to measure improvements")
    logger.info("2. Monitor slow query logs")
    logger.info("3. Consider adding more indexes based on actual query patterns")

if __name__ == "__main__":
    main()
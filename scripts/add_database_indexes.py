#!/usr/bin/env python3
"""
Add database indexes to improve query performance and fix N+1 issues
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from app.database import SQLALCHEMY_DATABASE_URL
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_indexes():
    """Create database indexes for performance optimization"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    indexes = [
        # Primary lookups
        {
            "name": "idx_work_orders_user_id",
            "table": "work_orders",
            "columns": ["user_id"],
            "description": "Speed up work order lookups by user"
        },
        {
            "name": "idx_work_orders_user_scheduled",
            "table": "work_orders",
            "columns": ["user_id", "scheduled_date DESC", "created_at DESC"],
            "description": "Speed up paginated work order queries"
        },
        {
            "name": "idx_dispensers_work_order_id",
            "table": "dispensers",
            "columns": ["work_order_id"],
            "description": "Speed up dispenser lookups by work order (fix N+1)"
        },
        
        # Foreign key lookups
        {
            "name": "idx_work_orders_external_id",
            "table": "work_orders",
            "columns": ["external_id"],
            "description": "Speed up lookups by WorkFossa ID"
        },
        {
            "name": "idx_work_orders_visit_id",
            "table": "work_orders",
            "columns": ["visit_id"],
            "description": "Speed up lookups by visit ID"
        },
        {
            "name": "idx_work_orders_store_number",
            "table": "work_orders",
            "columns": ["store_number"],
            "description": "Speed up lookups by store number"
        },
        
        # Status and filtering
        {
            "name": "idx_work_orders_status",
            "table": "work_orders",
            "columns": ["status"],
            "description": "Speed up filtering by status"
        },
        {
            "name": "idx_dispensers_status",
            "table": "dispensers",
            "columns": ["status"],
            "description": "Speed up filtering dispensers by status"
        },
        
        # Composite indexes for common queries
        {
            "name": "idx_work_orders_user_status",
            "table": "work_orders",
            "columns": ["user_id", "status"],
            "description": "Speed up user work orders filtered by status"
        },
        {
            "name": "idx_dispensers_work_order_status",
            "table": "dispensers",
            "columns": ["work_order_id", "status"],
            "description": "Speed up dispenser queries with status filter"
        },
        
        # Date-based queries
        {
            "name": "idx_work_orders_scheduled_date",
            "table": "work_orders",
            "columns": ["scheduled_date"],
            "description": "Speed up date-based queries"
        },
        {
            "name": "idx_work_orders_created_at",
            "table": "work_orders",
            "columns": ["created_at"],
            "description": "Speed up recent work order queries"
        },
        
        # User table indexes
        {
            "name": "idx_users_username",
            "table": "users",
            "columns": ["username"],
            "unique": True,
            "description": "Speed up user lookups by username"
        },
        {
            "name": "idx_users_email",
            "table": "users",
            "columns": ["email"],
            "unique": True,
            "description": "Speed up user lookups by email"
        }
    ]
    
    with engine.connect() as conn:
        created_count = 0
        skipped_count = 0
        
        for index in indexes:
            index_name = index["name"]
            table_name = index["table"]
            columns = index["columns"]
            is_unique = index.get("unique", False)
            
            # Check if index already exists
            if engine.dialect.name == 'sqlite':
                # SQLite check
                result = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='index' AND name=:name"),
                    {"name": index_name}
                ).fetchone()
            else:
                # PostgreSQL/MySQL check
                result = conn.execute(
                    text("""
                        SELECT indexname 
                        FROM pg_indexes 
                        WHERE tablename = :table AND indexname = :name
                    """),
                    {"table": table_name, "name": index_name}
                ).fetchone()
            
            if result:
                logger.info(f"Index {index_name} already exists, skipping...")
                skipped_count += 1
                continue
            
            # Create index
            try:
                columns_str = ", ".join(columns) if isinstance(columns, list) else columns
                unique_str = "UNIQUE " if is_unique else ""
                
                create_sql = f"CREATE {unique_str}INDEX {index_name} ON {table_name} ({columns_str})"
                
                logger.info(f"Creating index: {index_name}")
                logger.info(f"  Description: {index['description']}")
                logger.info(f"  SQL: {create_sql}")
                
                conn.execute(text(create_sql))
                conn.commit()
                created_count += 1
                logger.info(f"✓ Index {index_name} created successfully")
                
            except OperationalError as e:
                logger.error(f"✗ Failed to create index {index_name}: {str(e)}")
                continue
        
        logger.info(f"\nIndex creation complete:")
        logger.info(f"  Created: {created_count}")
        logger.info(f"  Skipped: {skipped_count}")
        
        # Analyze tables to update statistics
        if engine.dialect.name == 'sqlite':
            logger.info("\nRunning ANALYZE to update query planner statistics...")
            conn.execute(text("ANALYZE"))
            conn.commit()
        elif engine.dialect.name == 'postgresql':
            logger.info("\nRunning ANALYZE to update query planner statistics...")
            for table in ['work_orders', 'dispensers', 'users']:
                conn.execute(text(f"ANALYZE {table}"))
                conn.commit()


def drop_indexes():
    """Drop all custom indexes (for testing/reset purposes)"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    index_names = [
        "idx_work_orders_user_id",
        "idx_work_orders_user_scheduled",
        "idx_dispensers_work_order_id",
        "idx_work_orders_external_id",
        "idx_work_orders_visit_id",
        "idx_work_orders_store_number",
        "idx_work_orders_status",
        "idx_dispensers_status",
        "idx_work_orders_user_status",
        "idx_dispensers_work_order_status",
        "idx_work_orders_scheduled_date",
        "idx_work_orders_created_at",
        "idx_users_username",
        "idx_users_email"
    ]
    
    with engine.connect() as conn:
        dropped_count = 0
        
        for index_name in index_names:
            try:
                # Try to drop index
                if engine.dialect.name == 'sqlite':
                    conn.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
                else:
                    # PostgreSQL syntax
                    conn.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
                
                conn.commit()
                dropped_count += 1
                logger.info(f"Dropped index: {index_name}")
                
            except Exception as e:
                logger.error(f"Failed to drop index {index_name}: {str(e)}")
                continue
        
        logger.info(f"\nDropped {dropped_count} indexes")


def show_current_indexes():
    """Show all current indexes in the database"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as conn:
        if engine.dialect.name == 'sqlite':
            # SQLite query
            result = conn.execute(
                text("""
                    SELECT name, tbl_name, sql 
                    FROM sqlite_master 
                    WHERE type='index' 
                    ORDER BY tbl_name, name
                """)
            ).fetchall()
            
            logger.info("\nCurrent indexes in SQLite database:")
            current_table = None
            for row in result:
                if row.tbl_name != current_table:
                    current_table = row.tbl_name
                    logger.info(f"\nTable: {current_table}")
                logger.info(f"  - {row.name}")
                if row.sql:
                    logger.info(f"    SQL: {row.sql}")
                    
        else:
            # PostgreSQL query
            result = conn.execute(
                text("""
                    SELECT 
                        tablename,
                        indexname,
                        indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                    ORDER BY tablename, indexname
                """)
            ).fetchall()
            
            logger.info("\nCurrent indexes in PostgreSQL database:")
            current_table = None
            for row in result:
                if row.tablename != current_table:
                    current_table = row.tablename
                    logger.info(f"\nTable: {current_table}")
                logger.info(f"  - {row.indexname}")
                logger.info(f"    Definition: {row.indexdef}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Manage database indexes")
    parser.add_argument(
        "action",
        choices=["create", "drop", "show"],
        help="Action to perform"
    )
    
    args = parser.parse_args()
    
    if args.action == "create":
        logger.info("Creating database indexes...")
        create_indexes()
    elif args.action == "drop":
        logger.info("Dropping database indexes...")
        response = input("Are you sure you want to drop all custom indexes? (yes/no): ")
        if response.lower() == "yes":
            drop_indexes()
        else:
            logger.info("Operation cancelled")
    elif args.action == "show":
        show_current_indexes()
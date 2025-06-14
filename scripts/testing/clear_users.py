#!/usr/bin/env python3
"""
Script to clear all users from the database for testing
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clear_all_users():
    """Clear all users and related data from the database"""
    
    # Database configuration
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")
    
    # Create engine and session
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        logger.info("🧹 Starting user cleanup...")
        
        # Get current user count first
        result = db.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        logger.info(f"📊 Current users in database: {user_count}")
        
        if user_count == 0:
            logger.info("✅ No users found in database - already clean!")
            return
        
        # List current users
        logger.info("📋 Current users:")
        result = db.execute(text("SELECT id, email, label, created_at FROM users"))
        users = result.fetchall()
        for i, user in enumerate(users, 1):
            logger.info(f"  {i}. ID: {user[0][:8]}... | Email: {user[1]} | Name: {user[2]} | Created: {user[3]}")
        
        # Clear all user-related tables in proper order (to handle foreign keys)
        tables_to_clear = [
            'user_activities',
            'user_preferences', 
            'user_dispenser_data',
            'user_scraped_content',
            'user_sessions',
            'prover_settings',
            'user_credentials',
            'work_orders',
            'automation_jobs',
            'user_completed_jobs',
            'user_schedule_changes',
            'user_batch_history',
            'user_change_history',
            'users'  # Users table last due to foreign key constraints
        ]
        
        logger.info("🗑️ Clearing user data from all tables...")
        
        for table in tables_to_clear:
            try:
                # Check if table exists first
                result = db.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"))
                if result.fetchone():
                    # Get count before deletion
                    result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    
                    if count > 0:
                        # Delete all records
                        db.execute(text(f"DELETE FROM {table}"))
                        logger.info(f"  ✅ Cleared {count} records from {table}")
                    else:
                        logger.info(f"  ✅ Table {table} was already empty")
                else:
                    logger.info(f"  ⚠️ Table {table} does not exist - skipping")
            except Exception as e:
                logger.warning(f"  ⚠️ Error clearing {table}: {e}")
        
        # Commit all changes
        db.commit()
        logger.info("💾 All changes committed to database")
        
        # Verify cleanup
        result = db.execute(text("SELECT COUNT(*) FROM users"))
        final_count = result.scalar()
        logger.info(f"📊 Final user count: {final_count}")
        
        if final_count == 0:
            logger.info("🎉 SUCCESS: All users have been cleared from the database!")
            logger.info("🧪 The database is now ready for testing the duplicate user fix")
        else:
            logger.error(f"❌ ERROR: {final_count} users still remain in database")
            
    except Exception as e:
        logger.error(f"❌ Error during cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()
        logger.info("🔒 Database connection closed")

if __name__ == "__main__":
    print("🚀 User Database Cleanup Script")
    print("=" * 50)
    
    # Change to backend directory for database access
    backend_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'backend')
    os.chdir(backend_dir)
    
    try:
        clear_all_users()
        print("\n✅ User cleanup completed successfully!")
        print("🧪 You can now test the login flow to verify no duplicate users are created")
    except Exception as e:
        print(f"\n❌ User cleanup failed: {e}")
        sys.exit(1)
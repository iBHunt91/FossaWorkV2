#!/usr/bin/env python3
"""
Database migration to add visit_number column to work_orders table.
This migration can be run safely multiple times - it will only add the column if it doesn't exist.
"""

import sys
import os
from sqlalchemy import create_engine, text, inspect
from pathlib import Path

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

def run_migration():
    """Add visit_number column to work_orders table if it doesn't exist"""
    
    # Get database path
    db_path = Path(__file__).parent.parent.parent / "fossawork_v2.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return False
    
    print(f"📁 Using database: {db_path}")
    
    # Create engine
    engine = create_engine(f"sqlite:///{db_path}")
    
    # Check if column already exists
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('work_orders')]
    
    if 'visit_number' in columns:
        print("✅ Column 'visit_number' already exists in work_orders table")
        return True
    
    print("➕ Adding 'visit_number' column to work_orders table...")
    
    try:
        with engine.connect() as conn:
            # Add the column
            conn.execute(text("""
                ALTER TABLE work_orders 
                ADD COLUMN visit_number VARCHAR(50)
            """))
            conn.commit()
            
        print("✅ Successfully added 'visit_number' column")
        
        # Verify the column was added
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('work_orders')]
        
        if 'visit_number' in columns:
            print("✅ Verified: Column exists in database")
            return True
        else:
            print("❌ Error: Column was not added successfully")
            return False
            
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
"""
Run the database migration to add new dispenser fields
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

def run_migration():
    """Add new columns to dispensers table"""
    print("🔄 Running migration to add new dispenser fields...")
    
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )
    
    # Check if columns already exist
    with engine.connect() as conn:
        # Check existing columns
        result = conn.execute(text("PRAGMA table_info(dispensers)"))
        existing_columns = {row[1] for row in result}
        
        print(f"Existing columns: {existing_columns}")
        
        # Add new columns if they don't exist
        new_columns = [
            ("make", "VARCHAR(100)"),
            ("model", "VARCHAR(100)"),
            ("serial_number", "VARCHAR(100)"),
            ("meter_type", "VARCHAR(100)"),
            ("number_of_nozzles", "VARCHAR(20)")
        ]
        
        for col_name, col_type in new_columns:
            if col_name not in existing_columns:
                try:
                    conn.execute(text(f"ALTER TABLE dispensers ADD COLUMN {col_name} {col_type}"))
                    print(f"✅ Added column: {col_name}")
                except Exception as e:
                    print(f"❌ Error adding column {col_name}: {e}")
            else:
                print(f"⏭️ Column already exists: {col_name}")
        
        conn.commit()
    
    print("✅ Migration complete!")

if __name__ == "__main__":
    run_migration()
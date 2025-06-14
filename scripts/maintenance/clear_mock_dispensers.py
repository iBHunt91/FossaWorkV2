#!/usr/bin/env python3
"""
Clear mock dispenser data from the database
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def clear_mock_dispensers():
    """Remove all dispensers with mock data patterns"""
    # Create database connection
    db_path = backend_dir / "fossawork_v2.db"
    engine = create_engine(f"sqlite:///{db_path}")
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Find and delete dispensers with mock types using raw SQL
        mock_types = ["Wayne 300", "Gilbarco Encore", "Dresser", "Tokheim"]
        
        print("🔍 Searching for mock dispensers...")
        
        # First count how many we have
        count_query = text("""
            SELECT COUNT(*) FROM dispensers 
            WHERE dispenser_type IN ('Wayne 300', 'Gilbarco Encore', 'Dresser', 'Tokheim')
        """)
        result = db.execute(count_query)
        count = result.scalar()
        
        if count > 0:
            print(f"Found {count} mock dispensers to remove")
            
            # Get details before deleting
            select_query = text("""
                SELECT dispenser_number, dispenser_type, work_order_id 
                FROM dispensers 
                WHERE dispenser_type IN ('Wayne 300', 'Gilbarco Encore', 'Dresser', 'Tokheim')
            """)
            dispensers = db.execute(select_query).fetchall()
            
            for d in dispensers:
                print(f"  - Dispenser #{d[0]} ({d[1]}) from Work Order {d[2]}")
            
            # Delete them
            delete_query = text("""
                DELETE FROM dispensers 
                WHERE dispenser_type IN ('Wayne 300', 'Gilbarco Encore', 'Dresser', 'Tokheim')
            """)
            db.execute(delete_query)
            
            db.commit()
            print(f"✅ Removed {count} mock dispensers")
        else:
            print("✅ No mock dispensers found in database")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_mock_dispensers()
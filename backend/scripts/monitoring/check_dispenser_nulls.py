#!/usr/bin/env python3
"""Check for NULL values in dispenser fields"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

def check_dispenser_nulls():
    """Check for NULL values in dispenser table"""
    
    print("=" * 80)
    print("DISPENSER NULL VALUE CHECK")
    print("=" * 80)
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Get total count
        total = conn.execute(text("SELECT COUNT(*) FROM dispensers")).scalar()
        print(f"\nTotal dispensers: {total}")
        
        # Check each field for NULLs
        fields = [
            'work_order_id',
            'dispenser_number', 
            'dispenser_type',
            'fuel_grades',
            'status',
            'progress_percentage',
            'form_data',
            'automation_completed',
            'testing_requirements'
        ]
        
        print("\nChecking for NULL values:")
        print("-" * 60)
        
        for field in fields:
            null_count = conn.execute(text(f"SELECT COUNT(*) FROM dispensers WHERE {field} IS NULL")).scalar()
            not_null = total - null_count
            percentage = (not_null / total * 100) if total > 0 else 0
            
            # Special handling for JSON fields that might be empty objects/arrays
            if field in ['fuel_grades', 'form_data', 'testing_requirements']:
                empty_count = conn.execute(text(f"""
                    SELECT COUNT(*) FROM dispensers 
                    WHERE {field} = '{{}}' OR {field} = '[]'
                """)).scalar()
                if empty_count > 0:
                    print(f"{field:<25}: {not_null}/{total} populated ({percentage:.0f}%) - {empty_count} empty")
                else:
                    print(f"{field:<25}: {not_null}/{total} populated ({percentage:.0f}%)")
            else:
                print(f"{field:<25}: {not_null}/{total} populated ({percentage:.0f}%)")
        
        # Check dispenser_type values
        print("\n\nDispenser Type Distribution:")
        print("-" * 60)
        type_dist = conn.execute(text("""
            SELECT dispenser_type, COUNT(*) as count 
            FROM dispensers 
            GROUP BY dispenser_type 
            ORDER BY count DESC
        """)).fetchall()
        
        for row in type_dist:
            dtype = row.dispenser_type or "NULL"
            print(f"{dtype:<30}: {row.count} dispensers")
        
        # Check status values
        print("\n\nStatus Distribution:")
        print("-" * 60)
        status_dist = conn.execute(text("""
            SELECT status, COUNT(*) as count 
            FROM dispensers 
            GROUP BY status 
            ORDER BY count DESC
        """)).fetchall()
        
        for row in status_dist:
            status = row.status or "NULL"
            print(f"{status:<30}: {row.count} dispensers")
        
        # Check automation_completed
        print("\n\nAutomation Status:")
        print("-" * 60)
        auto_true = conn.execute(text("SELECT COUNT(*) FROM dispensers WHERE automation_completed = 1")).scalar()
        auto_false = conn.execute(text("SELECT COUNT(*) FROM dispensers WHERE automation_completed = 0")).scalar()
        auto_null = conn.execute(text("SELECT COUNT(*) FROM dispensers WHERE automation_completed IS NULL")).scalar()
        
        print(f"Completed: {auto_true}")
        print(f"Not Completed: {auto_false}")
        print(f"NULL: {auto_null}")
        
        print("\n" + "=" * 80)
        print("NULL CHECK COMPLETE")

if __name__ == "__main__":
    check_dispenser_nulls()
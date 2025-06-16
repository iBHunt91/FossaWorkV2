#!/usr/bin/env python3
"""Test form_data JSON storage in Dispenser model"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL
from app.core_models import Dispenser
import json

def test_form_data_storage():
    """Test that form_data is properly stored and retrieved"""
    
    print("=" * 80)
    print("FORM DATA STORAGE TEST")
    print("=" * 80)
    
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    
    with SessionLocal() as db:
        # Get a sample dispenser with form_data
        print("\n1. Checking for dispensers with form_data...")
        result = db.execute(text("""
            SELECT id, dispenser_number, form_data 
            FROM dispensers 
            WHERE form_data IS NOT NULL 
            AND form_data != '{}' 
            AND form_data != '[]'
            LIMIT 5
        """)).fetchall()
        
        if not result:
            print("❌ No dispensers found with form_data")
            
            # Check if there are any dispensers at all
            total = db.execute(text("SELECT COUNT(*) FROM dispensers")).scalar()
            print(f"\nTotal dispensers in database: {total}")
            
            if total > 0:
                # Check raw form_data values
                print("\n2. Checking raw form_data values...")
                raw_data = db.execute(text("""
                    SELECT id, dispenser_number, form_data, 
                           CASE 
                               WHEN form_data IS NULL THEN 'NULL'
                               WHEN form_data = '{}' THEN 'EMPTY_OBJECT'
                               WHEN form_data = '[]' THEN 'EMPTY_ARRAY'
                               ELSE 'HAS_DATA'
                           END as data_status
                    FROM dispensers 
                    LIMIT 10
                """)).fetchall()
                
                for row in raw_data:
                    print(f"\nDispenser {row.dispenser_number} (ID: {row.id[:8]}...):")
                    print(f"  Status: {row.data_status}")
                    print(f"  Raw form_data: {row.form_data}")
                    
                    # Try to parse if it has data
                    if row.form_data and row.form_data not in ['{}', '[]', None]:
                        try:
                            parsed = json.loads(row.form_data)
                            print(f"  Parsed successfully: {list(parsed.keys())}")
                        except Exception as e:
                            print(f"  Parse error: {e}")
        else:
            print(f"✅ Found {len(result)} dispensers with form_data")
            
            for row in result:
                print(f"\nDispenser {row.dispenser_number} (ID: {row.id[:8]}...):")
                print(f"  Raw form_data: {row.form_data}")
                
                try:
                    # Parse the JSON data
                    if isinstance(row.form_data, str):
                        data = json.loads(row.form_data)
                    else:
                        data = row.form_data
                    
                    print(f"  Parsed fields: {list(data.keys())}")
                    
                    # Show specific fields
                    if 'grades_list' in data:
                        print(f"  grades_list: {data['grades_list']}")
                    if 'stand_alone_code' in data:
                        print(f"  stand_alone_code: {data['stand_alone_code']}")
                    if 'title' in data:
                        print(f"  title: {data['title']}")
                    if 'dispenser_numbers' in data:
                        print(f"  dispenser_numbers: {data['dispenser_numbers']}")
                    if 'custom_fields' in data:
                        print(f"  custom_fields: {data['custom_fields']}")
                        
                except Exception as e:
                    print(f"  ❌ Error parsing form_data: {e}")
        
        # Test using SQLAlchemy ORM
        print("\n\n3. Testing SQLAlchemy ORM access...")
        dispensers = db.query(Dispenser).filter(
            Dispenser.form_data != None,
            Dispenser.form_data != {},
            Dispenser.form_data != []
        ).limit(3).all()
        
        if dispensers:
            print(f"✅ Found {len(dispensers)} dispensers via ORM")
            for disp in dispensers:
                print(f"\nDispenser {disp.dispenser_number}:")
                print(f"  form_data type: {type(disp.form_data)}")
                print(f"  form_data content: {disp.form_data}")
                
                if disp.form_data:
                    # Access fields directly
                    grades = disp.form_data.get('grades_list', [])
                    print(f"  grades_list via .get(): {grades}")
        else:
            print("❌ No dispensers found via ORM with form_data")
        
        # Check if JSON is being stored as text
        print("\n\n4. Checking data types in SQLite...")
        type_check = db.execute(text("""
            SELECT 
                typeof(form_data) as data_type,
                COUNT(*) as count
            FROM dispensers
            GROUP BY typeof(form_data)
        """)).fetchall()
        
        for row in type_check:
            print(f"  form_data type '{row.data_type}': {row.count} records")
        
        print("\n" + "=" * 80)
        print("TEST COMPLETE")

if __name__ == "__main__":
    test_form_data_storage()
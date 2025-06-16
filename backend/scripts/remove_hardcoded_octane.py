#!/usr/bin/env python3
"""
Remove hardcoded octane values from existing dispensers in the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

print("🧹 Removing hardcoded octane values from dispensers")
print("=" * 80)

# Create engine
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Get all dispensers with fuel grades
    result = conn.execute(text("SELECT id, dispenser_number, fuel_grades FROM dispensers WHERE fuel_grades IS NOT NULL"))
    dispensers = result.fetchall()
    
    print(f"Found {len(dispensers)} dispensers with fuel grades")
    
    updated_count = 0
    
    for disp_id, disp_num, fuel_json in dispensers:
        if not fuel_json:
            continue
            
        try:
            fuel_grades = json.loads(fuel_json)
            modified = False
            
            # Check each fuel grade
            for fuel_key, fuel_info in fuel_grades.items():
                if isinstance(fuel_info, dict) and 'octane' in fuel_info:
                    # Remove octane and keep only the name
                    if 'name' in fuel_info:
                        fuel_grades[fuel_key] = {'name': fuel_info['name']}
                    else:
                        # If no name, use the key as the name
                        fuel_name = fuel_key.replace('_', ' ').title()
                        fuel_grades[fuel_key] = {'name': fuel_name}
                    modified = True
            
            if modified:
                # Update the database
                new_json = json.dumps(fuel_grades)
                conn.execute(
                    text("UPDATE dispensers SET fuel_grades = :fuel_json WHERE id = :id"),
                    {"fuel_json": new_json, "id": disp_id}
                )
                updated_count += 1
                print(f"  ✅ Updated dispenser {disp_num}")
                
        except Exception as e:
            print(f"  ❌ Error processing dispenser {disp_num}: {e}")
    
    # Commit the changes
    conn.commit()
    
    print(f"\n✅ Updated {updated_count} dispensers")
    print("✅ Removed all hardcoded octane values!")
    
    # Show a sample of the updated data
    if updated_count > 0:
        result = conn.execute(text("SELECT dispenser_number, fuel_grades FROM dispensers WHERE fuel_grades IS NOT NULL LIMIT 1"))
        sample = result.fetchone()
        if sample:
            num, fuel_json = sample
            fuel_grades = json.loads(fuel_json)
            print(f"\n📋 Sample updated dispenser {num}:")
            print(json.dumps(fuel_grades, indent=2))
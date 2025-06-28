#!/usr/bin/env python3
"""
Show dispenser details for Wawa Store #5127 (Visit 136664)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import json

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fossawork.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🏪 Wawa Store #5127 - Dispenser Information")
print("=" * 80)
print("📍 2604 South U.S. 301, Tampa FL 33619")
print("📅 Visit: 136664 (Scheduled: 8/21/2025)")
print("=" * 80)

# Get the work order
cursor.execute("""
    SELECT id FROM work_orders 
    WHERE visit_url LIKE '%136664%'
""")
wo_id = cursor.fetchone()

if not wo_id:
    print("❌ Work order not found")
    sys.exit(1)

wo_id = wo_id[0]

# Get all dispensers
cursor.execute("""
    SELECT dispenser_number, dispenser_type, fuel_grades,
           make, model, serial_number, meter_type, number_of_nozzles,
           status, automation_completed
    FROM dispensers 
    WHERE work_order_id = ?
    ORDER BY 
        CAST(SUBSTR(dispenser_number, 1, INSTR(dispenser_number || '/', '/') - 1) AS INTEGER),
        dispenser_number
""", (wo_id,))

dispensers = cursor.fetchall()

print(f"\n🔧 Total Dispensers: {len(dispensers)}\n")

for disp in dispensers:
    disp_num, disp_type, fuel_grades_json, make, model, serial, meter, nozzles, status, automated = disp
    
    print(f"Dispenser Number: {disp_num}")
    print(f"├─ Type: {disp_type or 'Not captured'}")
    print(f"├─ Make: {make or 'Not captured'}")
    print(f"├─ Model: {model or 'Not captured'}")
    print(f"├─ Serial Number: {serial or 'Not captured'}")
    print(f"├─ Meter Type: {meter or 'Not captured'}")
    print(f"├─ Number of Nozzles: {nozzles or 'Not captured'}")
    print(f"├─ Status: {status or 'Not started'}")
    print(f"└─ Automation Completed: {'✅ Yes' if automated else '❌ No'}")
    
    if fuel_grades_json:
        try:
            fuel_grades = json.loads(fuel_grades_json)
            print("   Fuel Grades:")
            if isinstance(fuel_grades, dict):
                for grade, info in fuel_grades.items():
                    if isinstance(info, dict) and 'octane' in info:
                        print(f"   ├─ {grade.title()}: {info['octane']} octane")
                    else:
                        print(f"   ├─ {grade}")
            elif isinstance(fuel_grades, list):
                for i, grade in enumerate(fuel_grades):
                    prefix = "└─" if i == len(fuel_grades) - 1 else "├─"
                    print(f"   {prefix} {grade}")
        except:
            print(f"   └─ Raw: {fuel_grades_json}")
    
    print("-" * 60)

# Check if any dispensers have the new fields populated
has_new_data = any(
    cursor.execute("""
        SELECT 1 FROM dispensers 
        WHERE work_order_id = ? 
        AND (make IS NOT NULL OR model IS NOT NULL OR serial_number IS NOT NULL 
             OR meter_type IS NOT NULL OR number_of_nozzles IS NOT NULL)
        LIMIT 1
    """, (wo_id,)).fetchone()
)

if not has_new_data:
    print("\n⚠️  Note: The new dispenser fields (make, model, serial, meter type, nozzles)")
    print("    are not yet populated. You may need to re-scrape the dispensers")
    print("    to capture this enhanced information.")
    print("\n💡 To update: Click the 'Dispensers' button in the app for this work order")

conn.close()
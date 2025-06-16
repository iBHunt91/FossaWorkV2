#!/usr/bin/env python3
"""
Show fuel grades for all dispensers at Store #5127
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import json

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fossawork.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("⛽ Wawa Store #5127 - Fuel Grades by Dispenser")
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

# Get all dispensers with fuel grades
cursor.execute("""
    SELECT dispenser_number, dispenser_type, fuel_grades
    FROM dispensers 
    WHERE work_order_id = ?
    ORDER BY 
        CAST(SUBSTR(dispenser_number, 1, INSTR(dispenser_number || '/', '/') - 1) AS INTEGER),
        dispenser_number
""", (wo_id,))

dispensers = cursor.fetchall()

print(f"\n🔧 Total Dispensers: {len(dispensers)}\n")

# Track fuel grade statistics
all_grades = {}
dispenser_configs = {}

for disp_num, disp_type, fuel_grades_json in dispensers:
    fuel_list = []
    
    if fuel_grades_json:
        try:
            fuel_grades = json.loads(fuel_grades_json)
            if isinstance(fuel_grades, dict):
                for grade, info in sorted(fuel_grades.items()):
                    if isinstance(info, dict) and 'octane' in info:
                        octane = info['octane'] if info['octane'] else "N/A"
                        fuel_text = f"{grade.title()} ({octane})"
                    else:
                        fuel_text = grade.title()
                    fuel_list.append(fuel_text)
                    
                    # Track statistics
                    if grade not in all_grades:
                        all_grades[grade] = 0
                    all_grades[grade] += 1
            elif isinstance(fuel_grades, list):
                fuel_list = fuel_grades
        except:
            fuel_list = ["Error parsing grades"]
    else:
        fuel_list = ["No fuel grades data"]
    
    # Display dispenser info
    print(f"Dispenser {disp_num:>5} [{disp_type:>8}]: {', '.join(fuel_list)}")
    
    # Track configuration
    config_key = ', '.join(sorted(fuel_list))
    if config_key not in dispenser_configs:
        dispenser_configs[config_key] = []
    dispenser_configs[config_key].append(disp_num)

# Show summary statistics
print("\n" + "=" * 80)
print("📊 FUEL GRADE SUMMARY")
print("=" * 80)

print("\n⛽ Fuel Grades Available:")
for grade, count in sorted(all_grades.items()):
    print(f"   • {grade.title():12} - Available at {count} dispensers")

print(f"\n🔧 Dispenser Configurations ({len(dispenser_configs)} unique):")
for config, dispensers in sorted(dispenser_configs.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"\n   Configuration: {config}")
    print(f"   Dispensers ({len(dispensers)}): {', '.join(sorted(dispensers, key=lambda x: int(x.split('/')[0])))}")

# Identify special configurations
print("\n📌 Special Notes:")
diesel_dispensers = []
non_diesel_dispensers = []

cursor.execute("""
    SELECT dispenser_number, fuel_grades
    FROM dispensers 
    WHERE work_order_id = ?
""", (wo_id,))

for disp_num, fuel_grades_json in cursor.fetchall():
    if fuel_grades_json:
        try:
            fuel_grades = json.loads(fuel_grades_json)
            if isinstance(fuel_grades, dict):
                if 'diesel' in fuel_grades:
                    diesel_dispensers.append(disp_num)
                else:
                    non_diesel_dispensers.append(disp_num)
        except:
            pass

if diesel_dispensers:
    print(f"   • Diesel dispensers ({len(diesel_dispensers)}): {', '.join(sorted(diesel_dispensers, key=lambda x: int(x.split('/')[0])))}")
if non_diesel_dispensers:
    print(f"   • Non-diesel dispensers ({len(non_diesel_dispensers)}): {', '.join(sorted(non_diesel_dispensers, key=lambda x: int(x.split('/')[0])))}")

conn.close()
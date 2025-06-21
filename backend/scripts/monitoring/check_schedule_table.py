#!/usr/bin/env python3
"""
Check if scraping_schedules table exists and show its contents
"""

import sqlite3
import json
from datetime import datetime

def check_schedule_table():
    """Check scraping_schedules table status"""
    db_path = "fossawork_v2.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Checking database tables...")
        
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='scraping_schedules'
        """)
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("❌ Table 'scraping_schedules' does NOT exist!")
            print("\nAll tables in database:")
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            for table in tables:
                print(f"  - {table[0]}")
            return
        
        print("✅ Table 'scraping_schedules' exists")
        
        # Get table schema
        print("\n📋 Table schema:")
        cursor.execute("PRAGMA table_info(scraping_schedules)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Check for any existing schedules
        print("\n📊 Existing schedules:")
        cursor.execute("SELECT * FROM scraping_schedules")
        schedules = cursor.fetchall()
        
        if not schedules:
            print("  No schedules found")
        else:
            # Get column names
            column_names = [col[1] for col in columns]
            
            for schedule in schedules:
                print("\n  Schedule:")
                for i, value in enumerate(schedule):
                    col_name = column_names[i] if i < len(column_names) else f"col_{i}"
                    if col_name in ['active_hours', 'config'] and value:
                        try:
                            value = json.loads(value)
                        except:
                            pass
                    print(f"    {col_name}: {value}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_schedule_table()
#!/usr/bin/env python3
"""
Test script to verify table names are correctly fixed
"""

import sqlite3
import sys

def test_tables():
    """Test that all required tables exist with correct names"""
    conn = sqlite3.connect('fossawork_v2.db')
    cursor = conn.cursor()
    
    # Tables that the testing endpoint checks for
    required_tables = {
        'users': 'User accounts',
        'work_orders': 'Work order records',
        'dispensers': 'Dispenser information',
        'automation_jobs': 'Automation job tracking (was automation_tasks)',
        'scraping_schedules': 'Scraping schedule configuration (was scraping_sessions)'
    }
    
    print("🔍 Checking Required Tables")
    print("=" * 50)
    
    all_good = True
    for table_name, description in required_tables.items():
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"✅ {table_name:<20} - {count:>5} rows - {description}")
        except sqlite3.OperationalError as e:
            print(f"❌ {table_name:<20} - MISSING - {description}")
            print(f"   Error: {e}")
            all_good = False
    
    print("\n" + "=" * 50)
    
    # Also show what tables we DO have
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    all_tables = [row[0] for row in cursor.fetchall()]
    
    print(f"\n📊 Total tables in database: {len(all_tables)}")
    
    # Show tables that might have been confused
    print("\n🔄 Related tables that exist:")
    related_keywords = ['automation', 'scraping', 'task', 'job', 'session', 'schedule']
    for table in all_tables:
        if any(keyword in table.lower() for keyword in related_keywords):
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"   - {table:<30} ({count} rows)")
    
    conn.close()
    
    if all_good:
        print("\n✅ All required tables exist with correct names!")
        print("   The 'Table Structure' test should now pass.")
    else:
        print("\n❌ Some required tables are missing!")
        print("   The test endpoint needs to be updated to match actual table names.")
    
    return all_good

if __name__ == "__main__":
    success = test_tables()
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
"""
Simple script to reset the database for fresh setup
"""
import os
import sys
import sqlite3

def reset_database():
    db_path = "/mnt/c/Users/Bruce/Desktop/FossaWork/backend/fossawork_v2.db"
    
    if not os.path.exists(db_path):
        print("Database file doesn't exist - no need to reset")
        return
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get table list
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print(f"Found {len(tables)} tables in database")
        
        # Check user count before
        try:
            cursor.execute("SELECT COUNT(*) FROM users;")
            user_count = cursor.fetchone()[0]
            print(f"Current user count: {user_count}")
        except:
            print("Users table doesn't exist yet")
            user_count = 0
        
        # Delete all users to allow fresh setup
        if user_count > 0:
            cursor.execute("DELETE FROM users;")
            cursor.execute("DELETE FROM user_credentials;")
            cursor.execute("DELETE FROM user_preferences;")
            conn.commit()
            print("✅ Deleted all users - system now requires setup")
        else:
            print("✅ No users found - system already requires setup")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🔄 Resetting FossaWork V2 database for fresh setup...")
    if reset_database():
        print("✅ Database reset complete - you can now use /api/setup/initialize")
    else:
        print("❌ Database reset failed")
#!/usr/bin/env python3
"""
Quick script to trigger scraping manually with enhanced logging
"""
import sqlite3
from datetime import datetime, timezone

def trigger_manual_scraping():
    # Connect to database
    db_path = "fossawork_v2.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Set next_run to now for the first schedule to trigger immediate run
        now = datetime.now(timezone.utc)
        
        # Update the first schedule to run immediately
        cursor.execute("""
            UPDATE scraping_schedules 
            SET next_run = ? 
            WHERE id = 1
        """, (now,))
        
        conn.commit()
        print(f"✅ Triggered manual scraping - set next_run to {now}")
        print("⏳ Watch scheduler_daemon.log for enhanced debugging output...")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    trigger_manual_scraping()
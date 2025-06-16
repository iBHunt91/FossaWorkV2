#!/usr/bin/env python3
"""
Debug authentication issue for logged-in user
"""

import sys
import os
import sqlite3
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

def debug_auth():
    """Debug authentication issue"""
    print("🔍 Debugging Authentication Issue")
    print("=" * 50)
    
    # Connect to database
    conn = sqlite3.connect('fossawork_v2.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Check users table
        cursor.execute("SELECT id, username, is_active, last_login FROM users")
        users = cursor.fetchall()
        
        print(f"\n👤 Users in database: {len(users)}")
        for user in users:
            print(f"   - {user['username']} (ID: {user['id'][:8]}...)")
            print(f"     Active: {user['is_active']}")
            print(f"     Last login: {user['last_login']}")
        
        # Check for any recent errors in logs
        print("\n📋 Quick Checks:")
        print("1. Open browser DevTools (F12)")
        print("2. Go to Application/Storage → Local Storage")
        print("3. Look for 'token' or 'authToken' key")
        print("4. If token exists, check if it's expired")
        print("\n5. In Network tab, check a failed request:")
        print("   - Is Authorization header present?")
        print("   - Format should be: 'Bearer YOUR_TOKEN'")
        
        print("\n🔧 Quick Fix Options:")
        print("1. Try refreshing the page (F5)")
        print("2. Clear browser cache and refresh")
        print("3. Check if backend restarted (token might be invalid)")
        
        # Check if it's a database issue
        cursor.execute("SELECT COUNT(*) as count FROM work_orders WHERE user_id = '7bea3bdb7e8e303eacaba442bd824004'")
        wo_count = cursor.fetchone()['count']
        print(f"\n📊 Work orders for your user: {wo_count}")
        
        if wo_count == 0:
            print("⚠️  No work orders found - you may need to scrape them first")
        
    finally:
        conn.close()
    
    print("\n💡 Most likely causes:")
    print("1. Token expired (default is 24 hours)")
    print("2. Backend restarted with different SECRET_KEY")
    print("3. Token not being sent in Authorization header")
    print("4. Database connection issue")

if __name__ == "__main__":
    debug_auth()
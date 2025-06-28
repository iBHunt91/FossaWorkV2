#!/usr/bin/env python3
"""
Script to view stored work order data from the SQLite database
"""

import sqlite3
import json
from datetime import datetime

def view_work_orders(db_path="fossawork_v2.db"):
    """View all work orders in the database"""
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # This makes rows accessible like dictionaries
        cursor = conn.cursor()
        
        print("=" * 60)
        print("FOSSAWORK V2 DATABASE CONTENTS")
        print("=" * 60)
        
        # Show all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"\nTables in database: {[table[0] for table in tables]}")
        
        # Check work orders
        cursor.execute("SELECT COUNT(*) FROM work_orders")
        wo_count = cursor.fetchone()[0]
        print(f"\nTotal Work Orders: {wo_count}")
        
        if wo_count > 0:
            print("\n" + "="*60)
            print("WORK ORDERS")
            print("="*60)
            
            cursor.execute("""
                SELECT id, user_id, external_id, site_name, address, 
                       scheduled_date, status, created_at, updated_at
                FROM work_orders
                ORDER BY created_at DESC
            """)
            work_orders = cursor.fetchall()
            
            for i, wo in enumerate(work_orders, 1):
                print(f"\n--- Work Order {i} ---")
                print(f"ID: {wo['id']}")
                print(f"External ID: {wo['external_id']}")
                print(f"User ID: {wo['user_id']}")
                print(f"Site Name: {wo['site_name']}")
                print(f"Address: {wo['address']}")
                print(f"Scheduled Date: {wo['scheduled_date']}")
                print(f"Status: {wo['status']}")
                print(f"Created: {wo['created_at']}")
                print(f"Updated: {wo['updated_at']}")
        
        # Check dispensers
        cursor.execute("SELECT COUNT(*) FROM dispensers")
        disp_count = cursor.fetchone()[0]
        print(f"\nTotal Dispensers: {disp_count}")
        
        if disp_count > 0:
            print("\n" + "="*60)
            print("DISPENSERS")
            print("="*60)
            
            cursor.execute("""
                SELECT d.id, d.work_order_id, d.dispenser_number, d.dispenser_type,
                       d.fuel_grades, d.status, d.progress_percentage, d.automation_completed,
                       wo.external_id as wo_external_id, wo.site_name
                FROM dispensers d
                LEFT JOIN work_orders wo ON d.work_order_id = wo.id
                ORDER BY wo.site_name, d.dispenser_number
            """)
            dispensers = cursor.fetchall()
            
            for i, disp in enumerate(dispensers, 1):
                print(f"\n--- Dispenser {i} ---")
                print(f"ID: {disp['id']}")
                print(f"Work Order: {disp['wo_external_id']} ({disp['site_name']})")
                print(f"Dispenser Number: {disp['dispenser_number']}")
                print(f"Type: {disp['dispenser_type']}")
                print(f"Fuel Grades: {disp['fuel_grades']}")
                print(f"Status: {disp['status']}")
                print(f"Progress: {disp['progress_percentage']}%")
                print(f"Completed: {disp['automation_completed']}")
        
        # Check users
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"\nTotal Users: {user_count}")
        
        if user_count > 0:
            cursor.execute("SELECT id, username, email, is_active, created_at FROM users")
            users = cursor.fetchall()
            
            print("\n" + "="*60)
            print("USERS")
            print("="*60)
            for user in users:
                print(f"ID: {user['id']}, Username: {user['username']}, Email: {user['email']}, Active: {user['is_active']}")
        
        # Check credentials
        cursor.execute("SELECT COUNT(*) FROM user_credentials")
        cred_count = cursor.fetchone()[0]
        print(f"\nTotal Stored Credentials: {cred_count}")
        
        if cred_count > 0:
            cursor.execute("""
                SELECT uc.service_name, uc.username, uc.is_active, uc.created_at,
                       u.username as user_username
                FROM user_credentials uc
                LEFT JOIN users u ON uc.user_id = u.id
            """)
            credentials = cursor.fetchall()
            
            print("\n" + "="*60)
            print("STORED CREDENTIALS")
            print("="*60)
            for cred in credentials:
                print(f"Service: {cred['service_name']}, User: {cred['user_username']}, Username: {cred['username']}, Active: {cred['is_active']}")
        
        conn.close()
        print("\n" + "="*60)
        print("END OF DATABASE CONTENTS")
        print("="*60)
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("FossaWork V2 Database Viewer")
    print("Checking database contents...")
    view_work_orders()
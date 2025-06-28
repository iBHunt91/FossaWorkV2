#!/usr/bin/env python3
"""
Export work order data to JSON format
"""

import sqlite3
import json
from datetime import datetime

def export_to_json(db_path="fossawork_v2.db", output_file="work_orders_export.json"):
    """Export all work order data to JSON"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all work orders with their dispensers
        cursor.execute("""
            SELECT wo.*, u.username 
            FROM work_orders wo
            LEFT JOIN users u ON wo.user_id = u.id
            ORDER BY wo.created_at DESC
        """)
        work_orders = cursor.fetchall()
        
        export_data = {
            "export_timestamp": datetime.now().isoformat(),
            "total_work_orders": len(work_orders),
            "work_orders": []
        }
        
        for wo in work_orders:
            # Get dispensers for this work order
            cursor.execute("""
                SELECT * FROM dispensers WHERE work_order_id = ?
            """, (wo['id'],))
            dispensers = cursor.fetchall()
            
            work_order_data = {
                "id": wo['id'],
                "external_id": wo['external_id'],
                "user_id": wo['user_id'],
                "username": wo['username'],
                "site_name": wo['site_name'],
                "address": wo['address'],
                "scheduled_date": wo['scheduled_date'],
                "status": wo['status'],
                "notes": wo['notes'],
                "created_at": wo['created_at'],
                "updated_at": wo['updated_at'],
                "dispensers": [
                    {
                        "id": d['id'],
                        "dispenser_number": d['dispenser_number'],
                        "dispenser_type": d['dispenser_type'],
                        "fuel_grades": json.loads(d['fuel_grades']) if d['fuel_grades'] else {},
                        "status": d['status'],
                        "progress_percentage": d['progress_percentage'],
                        "automation_completed": bool(d['automation_completed']),
                        "created_at": d['created_at'],
                        "updated_at": d['updated_at']
                    }
                    for d in dispensers
                ]
            }
            export_data["work_orders"].append(work_order_data)
        
        # Write to JSON file
        with open(output_file, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        print(f"[OK] Exported {len(work_orders)} work orders to {output_file}")
        print(f"[FILE] File size: {len(json.dumps(export_data))} bytes")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Export failed: {e}")

if __name__ == "__main__":
    export_to_json()
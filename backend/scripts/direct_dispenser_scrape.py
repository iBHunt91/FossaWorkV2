#!/usr/bin/env python3
"""
Direct dispenser scrape to populate new fields
"""

import asyncio
import sys
import os
import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set the master key environment variable directly
os.environ['FOSSAWORK_MASTER_KEY'] = '8mwFZv2Yv0FeZIgG1XHP2CM-1PAD_Kvwd-bTANycUHw'

from app.services.dispenser_scraper import DispenserScraper
from app.services.workfossa_automation import WorkFossaAutomationService
from app.services.credential_manager import credential_manager

async def direct_scrape():
    """Perform direct dispenser scrape and update database"""
    print("🚀 Direct Dispenser Scrape")
    print("=" * 50)
    
    # Connect to database
    conn = sqlite3.connect('fossawork_v2.db')
    cursor = conn.cursor()
    
    try:
        # Get Bruce's user ID
        user_id = "7bea3bdb7e8e303eacaba442bd824004"
        
        # Find a work order with customer URL
        cursor.execute("""
            SELECT id, external_id, site_name, customer_url
            FROM work_orders
            WHERE user_id = ? AND customer_url IS NOT NULL
            LIMIT 1
        """, (user_id,))
        
        work_order = cursor.fetchone()
        if not work_order:
            print("❌ No work orders found with customer URL")
            return
            
        wo_id, wo_external_id, site_name, customer_url = work_order
        print(f"✅ Found work order: {wo_external_id}")
        print(f"   Site: {site_name}")
        print(f"   Customer URL: {customer_url}")
        
        # Get credentials
        creds = credential_manager.retrieve_credentials(user_id)
        if not creds:
            print("❌ No credentials found")
            return
            
        credentials = {
            "username": creds.username,
            "password": creds.password
        }
        
        print(f"\n🔐 Using credentials for: {credentials['username']}")
        
        # Create services
        automation = WorkFossaAutomationService(headless=False)
        scraper = DispenserScraper()
        
        # Create session
        session_id = f"direct_scrape_{wo_external_id}"
        print("\n🌐 Creating browser session...")
        
        await automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        
        # Login
        print("🔐 Logging in to WorkFossa...")
        success = await automation.login_to_workfossa(session_id)
        if not success:
            print("❌ Login failed")
            return
        
        print("✅ Login successful")
        
        # Get page
        session_data = automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            print("❌ No page found in session")
            return
        
        page = session_data['page']
        
        print(f"\n🔍 Scraping dispensers from: {customer_url}")
        
        # Scrape dispensers
        dispenser_infos, raw_html = await scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id=wo_id,
            visit_url=customer_url
        )
        
        print(f"\n✅ Found {len(dispenser_infos)} dispensers")
        
        if dispenser_infos:
            # Delete existing dispensers
            cursor.execute("DELETE FROM dispensers WHERE work_order_id = ?", (wo_id,))
            
            # Insert new dispensers with all fields
            for idx, info in enumerate(dispenser_infos):
                print(f"\n📊 Saving Dispenser {idx + 1}:")
                print(f"   Number: {info.dispenser_number}")
                print(f"   Title: {info.title}")
                print(f"   Make: {info.make}")
                print(f"   Model: {info.model}")
                print(f"   Serial: {info.serial_number}")
                
                # Prepare form_data JSON
                form_data = {
                    "stand_alone_code": info.stand_alone_code,
                    "grades_list": info.grades_list or [],
                    "title": info.title,
                    "dispenser_numbers": info.dispenser_numbers or [],
                    "custom_fields": info.custom_fields or {}
                }
                
                # Insert dispenser
                cursor.execute("""
                    INSERT INTO dispensers (
                        id, work_order_id, dispenser_number, dispenser_type,
                        fuel_grades, status, progress_percentage, automation_completed,
                        make, model, serial_number, meter_type, number_of_nozzles,
                        form_data, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()),
                    wo_id,
                    info.dispenser_number,
                    info.make or 'Unknown',
                    json.dumps(info.fuel_grades or {}),
                    'pending',
                    0.0,
                    False,
                    info.make,
                    info.model,
                    info.serial_number,
                    info.meter_type,
                    info.number_of_nozzles,
                    json.dumps(form_data),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
            
            # Update work order scraped_data
            dispensers_data = []
            for info in dispenser_infos:
                disp_dict = {
                    'dispenser_number': info.dispenser_number,
                    'title': info.title,
                    'make': info.make,
                    'model': info.model,
                    'serial_number': info.serial_number,
                    'meter_type': info.meter_type,
                    'number_of_nozzles': info.number_of_nozzles,
                    'stand_alone_code': info.stand_alone_code,
                    'grades_list': info.grades_list or [],
                    'fuel_grades': info.fuel_grades or {},
                    'dispenser_numbers': info.dispenser_numbers or [],
                    'custom_fields': info.custom_fields or {}
                }
                dispensers_data.append(disp_dict)
            
            # Get existing scraped_data
            cursor.execute("SELECT scraped_data FROM work_orders WHERE id = ?", (wo_id,))
            result = cursor.fetchone()
            scraped_data = json.loads(result[0]) if result and result[0] else {}
            
            # Update scraped_data
            scraped_data['dispensers'] = dispensers_data
            scraped_data['dispenser_count'] = len(dispensers_data)
            scraped_data['dispenser_scrape_date'] = datetime.now().isoformat()
            
            cursor.execute("""
                UPDATE work_orders 
                SET scraped_data = ?, updated_at = ?
                WHERE id = ?
            """, (json.dumps(scraped_data), datetime.now().isoformat(), wo_id))
            
            # Commit changes
            conn.commit()
            print(f"\n✅ Saved {len(dispenser_infos)} dispensers to database")
        
        # Cleanup
        await automation.cleanup_session(session_id)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()
    
    print("\n✅ Direct scrape complete!")
    print("\n📱 To verify in the app:")
    print("  1. Start backend: cd backend && uvicorn app.main:app --reload")
    print("  2. Start frontend: npm run dev")
    print("  3. View dispensers for work order", wo_external_id if 'wo_external_id' in locals() else '')

if __name__ == "__main__":
    asyncio.run(direct_scrape())
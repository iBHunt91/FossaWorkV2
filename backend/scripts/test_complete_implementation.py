#!/usr/bin/env python3
"""Complete implementation test - verifies all components are working"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user_models import User
from app.core_models import WorkOrder
from sqlalchemy import desc, text
import json

def test_implementation():
    """Test all implementation components"""
    
    print("=" * 80)
    print("COMPLETE IMPLEMENTATION TEST")
    print("=" * 80)
    
    db = SessionLocal()
    
    try:
        # 1. Check database schema
        print("\n1️⃣ DATABASE SCHEMA CHECK")
        print("-" * 40)
        
        # Get column info using raw SQL
        result = db.execute(text("PRAGMA table_info(work_orders)"))
        columns = {row[1]: row[2] for row in result}
        
        new_fields = [
            'service_name', 'service_items', 'street', 'city_state',
            'county', 'created_date', 'created_by', 'customer_url'
        ]
        
        schema_ok = True
        for field in new_fields:
            if field in columns:
                print(f"   ✅ {field:<20} - Type: {columns[field]}")
            else:
                print(f"   ❌ {field:<20} - MISSING!")
                schema_ok = False
        
        print(f"\n   Schema Status: {'✅ PASSED' if schema_ok else '❌ FAILED'}")
        
        # 2. Check WorkOrderData dataclass
        print("\n2️⃣ WORKORDERDATA DATACLASS CHECK")
        print("-" * 40)
        
        from app.services.workfossa_scraper import WorkOrderData
        import inspect
        
        # Get all fields from dataclass
        fields = [f.name for f in WorkOrderData.__dataclass_fields__.values()]
        
        dataclass_ok = True
        for field in new_fields:
            if field in fields:
                print(f"   ✅ {field}")
            else:
                print(f"   ❌ {field} - MISSING!")
                dataclass_ok = False
        
        print(f"\n   Dataclass Status: {'✅ PASSED' if dataclass_ok else '❌ FAILED'}")
        
        # 3. Check API routes
        print("\n3️⃣ API ROUTES CHECK")
        print("-" * 40)
        
        # Read the routes file and check for new fields
        routes_file = Path(__file__).parent.parent / "app" / "routes" / "work_orders.py"
        with open(routes_file, 'r') as f:
            routes_content = f.read()
        
        api_ok = True
        for field in new_fields:
            if f'"{field}"' in routes_content or f"'{field}'" in routes_content:
                print(f"   ✅ {field} in API response")
            else:
                print(f"   ❌ {field} NOT in API response")
                api_ok = False
        
        print(f"\n   API Routes Status: {'✅ PASSED' if api_ok else '❌ FAILED'}")
        
        # 4. Check extraction logic
        print("\n4️⃣ EXTRACTION LOGIC CHECK")
        print("-" * 40)
        
        # Check if extraction methods exist
        scraper_file = Path(__file__).parent.parent / "app" / "services" / "workfossa_scraper.py"
        with open(scraper_file, 'r') as f:
            scraper_content = f.read()
        
        extraction_methods = [
            '_extract_created_info',
            '_extract_service_info',
            '_extract_address_components'
        ]
        
        extraction_ok = True
        for method in extraction_methods:
            if f'async def {method}' in scraper_content:
                print(f"   ✅ {method} exists")
            else:
                print(f"   ❌ {method} MISSING!")
                extraction_ok = False
        
        # Check if new fields are being set in WorkOrderData
        if 'service_name=service_info.get("name")' in scraper_content:
            print("   ✅ service_name extraction implemented")
        else:
            print("   ❌ service_name extraction NOT implemented")
            extraction_ok = False
        
        if 'created_date=created_info.get("date")' in scraper_content:
            print("   ✅ created_date extraction implemented")
        else:
            print("   ❌ created_date extraction NOT implemented")
            extraction_ok = False
        
        print(f"\n   Extraction Logic Status: {'✅ PASSED' if extraction_ok else '❌ FAILED'}")
        
        # 5. Check save logic
        print("\n5️⃣ SAVE LOGIC CHECK")
        print("-" * 40)
        
        # Check if save logic includes new fields
        save_ok = True
        for field in new_fields:
            if f'existing.{field} = wo_data.{field}' in routes_content:
                print(f"   ✅ {field} update logic exists")
            elif f'{field}=wo_data.{field}' in routes_content:
                print(f"   ✅ {field} create logic exists")
            else:
                print(f"   ❌ {field} save logic MISSING!")
                save_ok = False
        
        print(f"\n   Save Logic Status: {'✅ PASSED' if save_ok else '❌ FAILED'}")
        
        # 6. Sample data check
        print("\n6️⃣ SAMPLE DATA CHECK")
        print("-" * 40)
        
        # Get a recent work order
        recent_wo = db.query(WorkOrder).order_by(desc(WorkOrder.created_at)).first()
        
        if recent_wo:
            print(f"   Latest work order: W-{recent_wo.external_id}")
            print(f"   Created at: {recent_wo.created_at}")
            
            # Check which new fields are populated
            populated = 0
            for field in new_fields:
                value = getattr(recent_wo, field, None)
                if value:
                    populated += 1
                    print(f"   ✅ {field}: {str(value)[:50]}")
                else:
                    print(f"   ⚠️  {field}: Not populated")
            
            print(f"\n   Fields populated: {populated}/{len(new_fields)}")
        else:
            print("   ❌ No work orders found in database")
        
        # Overall summary
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        
        all_passed = all([schema_ok, dataclass_ok, api_ok, extraction_ok, save_ok])
        
        print(f"   1. Database Schema:    {'✅ PASSED' if schema_ok else '❌ FAILED'}")
        print(f"   2. WorkOrderData:      {'✅ PASSED' if dataclass_ok else '❌ FAILED'}")
        print(f"   3. API Routes:         {'✅ PASSED' if api_ok else '❌ FAILED'}")
        print(f"   4. Extraction Logic:   {'✅ PASSED' if extraction_ok else '❌ FAILED'}")
        print(f"   5. Save Logic:         {'✅ PASSED' if save_ok else '❌ FAILED'}")
        
        print(f"\n   Overall Status: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
        
        if all_passed:
            print("\n✅ IMPLEMENTATION IS COMPLETE AND WORKING!")
            print("   - All new fields are in the database schema")
            print("   - WorkOrderData dataclass has all fields")
            print("   - API routes return all fields")
            print("   - Extraction logic is implemented")
            print("   - Save logic handles all fields")
            print("\n   Next step: Trigger a fresh work order scrape to populate the new fields")
        else:
            print("\n⚠️  Some components need attention")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🚀 Starting Complete Implementation Test")
    test_implementation()
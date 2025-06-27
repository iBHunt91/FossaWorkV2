#!/usr/bin/env python3
"""
Add Test Work Orders Script

Temporarily adds realistic test work orders to the database
for verifying filter calculations are working correctly.

This script adds work orders with various service codes and store chains
to test the complete filter calculation pipeline.
"""

import sys
import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Add backend to path
sys.path.append('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import WorkOrder, User
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
TEST_USER_ID = "test-user-filter-data"
TEST_USER_USERNAME = "filter-test-user"


def create_test_user(db: Session) -> User:
    """Create a test user if it doesn't exist."""
    logger.info(f"🔍 Checking for test user: {TEST_USER_ID}")
    
    user = db.query(User).filter(User.id == TEST_USER_ID).first()
    
    if not user:
        logger.info("👤 Creating test user...")
        user = User(
            id=TEST_USER_ID,
            username=TEST_USER_USERNAME,
            email="filter-test@example.com",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"✅ Created test user: {user.username}")
    else:
        logger.info(f"✅ Test user already exists: {user.username}")
    
    return user


def generate_realistic_work_orders(count: int = 15) -> List[Dict[str, Any]]:
    """Generate realistic test work orders with various service codes and chains."""
    logger.info(f"🔧 Generating {count} realistic test work orders...")
    
    # Realistic store chain data
    store_chains = [
        {'name': '7-Eleven', 'stores': ['1234', '1235', '1236']},
        {'name': 'Speedway', 'stores': ['2001', '2002', '2003']},
        {'name': 'Marathon', 'stores': ['3100', '3101', '3102']},
        {'name': 'Wawa', 'stores': ['4500', '4501', '4502']},
        {'name': 'Circle K', 'stores': ['5200', '5201', '5202']}
    ]
    
    # Service codes with their descriptions
    service_codes = {
        '2861': 'AccuMeasure - All Dispensers',
        '2862': 'AccuMeasure - Specific Dispensers',
        '3002': 'AccuMeasure - All Dispensers (Alt)',
        '3146': 'Open Neck Prover'
    }
    
    # Cities and states for variety
    locations = [
        {'city': 'Houston', 'state': 'TX', 'zip': '77001'},
        {'city': 'Dallas', 'state': 'TX', 'zip': '75201'},
        {'city': 'Austin', 'state': 'TX', 'zip': '73301'},
        {'city': 'Tampa', 'state': 'FL', 'zip': '33601'},
        {'city': 'Miami', 'state': 'FL', 'zip': '33101'},
        {'city': 'Orlando', 'state': 'FL', 'zip': '32801'},
        {'city': 'Atlanta', 'state': 'GA', 'zip': '30301'},
        {'city': 'Savannah', 'state': 'GA', 'zip': '31401'}
    ]
    
    work_orders = []
    base_date = datetime.now()
    
    for i in range(count):
        # Select data for this work order
        chain_data = store_chains[i % len(store_chains)]
        store_number = chain_data['stores'][i % len(chain_data['stores'])]
        service_code = list(service_codes.keys())[i % len(service_codes)]
        location = locations[i % len(locations)]
        
        # Create realistic addresses
        street_number = 100 + (i * 50)
        street_names = ['Main St', 'Oak Ave', 'First St', 'Park Blvd', 'Center Dr', 'Highway 6', 'MLK Jr Blvd']
        street_name = street_names[i % len(street_names)]
        
        # Schedule dates spread over current and next week
        scheduled_date = base_date + timedelta(days=(i % 14))
        
        work_order_data = {
            "external_id": f"W-{50000 + i}",
            "site_name": f"{chain_data['name']} #{store_number}",
            "address": f"{street_number} {street_name}, {location['city']}, {location['state']} {location['zip']}",
            "service_code": service_code,
            "service_name": service_codes[service_code],
            "scheduled_date": scheduled_date.isoformat(),
            "created_date": base_date.isoformat(),
            "visit_url": f"/visits/test-visit-{i+1}",
            "customer_url": f"/customers/locations/test-location-{chain_data['name'].lower().replace(' ', '-')}-{store_number}/",
            "instructions": f"Filter calculation test work order {i+1}. Service: {service_codes[service_code]}",
            # Additional realistic data
            "created_by": "System Test",
            "county": f"{location['city']} County",
            "service_items": f"Test service items for {service_codes[service_code]}",
            "status": "Scheduled"
        }
        
        work_orders.append(work_order_data)
    
    logger.info(f"✅ Generated {len(work_orders)} realistic work orders")
    logger.info(f"📋 Service codes: {list(service_codes.keys())}")
    logger.info(f"🏪 Store chains: {[chain['name'] for chain in store_chains]}")
    logger.info(f"📅 Date range: {base_date.date()} to {(base_date + timedelta(days=13)).date()}")
    
    return work_orders


def add_work_orders_to_database(work_orders_data: List[Dict[str, Any]], user_id: str) -> List[WorkOrder]:
    """Add work orders to the database."""
    logger.info(f"💾 Adding {len(work_orders_data)} work orders to database...")
    
    db = SessionLocal()
    added_work_orders = []
    
    try:
        for i, wo_data in enumerate(work_orders_data):
            logger.info(f"📝 Adding work order {i+1}/{len(work_orders_data)}: {wo_data['external_id']}")
            
            # Check if work order already exists
            existing = db.query(WorkOrder).filter(
                WorkOrder.external_id == wo_data['external_id'],
                WorkOrder.user_id == user_id
            ).first()
            
            if existing:
                logger.info(f"   ⚠️ Work order {wo_data['external_id']} already exists, skipping")
                continue
            
            # Create new work order
            work_order = WorkOrder(
                user_id=user_id,
                external_id=wo_data['external_id'],
                site_name=wo_data['site_name'],
                address=wo_data['address'],
                service_code=wo_data['service_code'],
                service_name=wo_data['service_name'],
                scheduled_date=datetime.fromisoformat(wo_data['scheduled_date']),
                created_date=datetime.fromisoformat(wo_data['created_date']),
                visit_url=wo_data['visit_url'],
                customer_url=wo_data['customer_url'],
                instructions=wo_data['instructions'],
                scraped_data={
                    "created_by": wo_data.get('created_by', ''),
                    "county": wo_data.get('county', ''),
                    "service_items": wo_data.get('service_items', ''),
                    "status": wo_data.get('status', 'Scheduled')
                }
            )
            
            db.add(work_order)
            added_work_orders.append(work_order)
            logger.info(f"   ✅ Added: {wo_data['site_name']} - {wo_data['service_name']}")
        
        # Commit all work orders
        db.commit()
        logger.info(f"✅ Successfully added {len(added_work_orders)} work orders to database")
        
        # Refresh objects to get IDs
        for wo in added_work_orders:
            db.refresh(wo)
        
        return added_work_orders
        
    except Exception as e:
        logger.error(f"❌ Error adding work orders: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def verify_work_orders_added(user_id: str) -> Dict[str, Any]:
    """Verify that work orders were added correctly."""
    logger.info("🔍 Verifying work orders were added correctly...")
    
    db = SessionLocal()
    try:
        # Count total work orders for user
        total_count = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).count()
        
        # Get service code breakdown
        service_codes = db.query(WorkOrder.service_code, db.func.count(WorkOrder.id))\
            .filter(WorkOrder.user_id == user_id)\
            .group_by(WorkOrder.service_code)\
            .all()
        
        # Get date range
        date_range = db.query(
            db.func.min(WorkOrder.scheduled_date),
            db.func.max(WorkOrder.scheduled_date)
        ).filter(WorkOrder.user_id == user_id).first()
        
        # Get recent work orders
        recent_work_orders = db.query(WorkOrder)\
            .filter(WorkOrder.user_id == user_id)\
            .order_by(WorkOrder.created_at.desc())\
            .limit(5)\
            .all()
        
        verification_result = {
            "total_work_orders": total_count,
            "service_code_breakdown": {code: count for code, count in service_codes},
            "date_range": {
                "start": date_range[0].isoformat() if date_range[0] else None,
                "end": date_range[1].isoformat() if date_range[1] else None
            },
            "recent_work_orders": [
                {
                    "id": wo.id,
                    "external_id": wo.external_id,
                    "site_name": wo.site_name,
                    "service_code": wo.service_code,
                    "scheduled_date": wo.scheduled_date.isoformat()
                }
                for wo in recent_work_orders
            ]
        }
        
        logger.info(f"✅ Verification complete:")
        logger.info(f"   📊 Total work orders: {total_count}")
        logger.info(f"   📋 Service codes: {dict(service_codes)}")
        logger.info(f"   📅 Date range: {date_range[0]} to {date_range[1]}")
        
        return verification_result
        
    finally:
        db.close()


def remove_test_work_orders(user_id: str) -> int:
    """Remove all test work orders for cleanup."""
    logger.info("🧹 Removing test work orders...")
    
    db = SessionLocal()
    try:
        # Delete all work orders for the test user
        deleted_count = db.query(WorkOrder)\
            .filter(WorkOrder.user_id == user_id)\
            .delete()
        
        db.commit()
        logger.info(f"✅ Removed {deleted_count} test work orders")
        
        return deleted_count
        
    except Exception as e:
        logger.error(f"❌ Error removing test work orders: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Main function to add test work orders."""
    print("🚀 Add Test Work Orders for Filter Calculation Testing")
    print("=" * 60)
    
    # Check if backend is running
    try:
        import requests
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code != 200:
            print("❌ Backend not running or not healthy. Please start the backend first.")
            return 1
    except:
        print("❌ Cannot connect to backend. Please start the backend first.")
        return 1
    
    db = SessionLocal()
    try:
        # Create test user
        user = create_test_user(db)
        
        # Ask user what they want to do
        print("\nWhat would you like to do?")
        print("1. Add test work orders")
        print("2. Verify existing work orders")  
        print("3. Remove test work orders")
        print("4. Add work orders and run verification")
        
        choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == "1":
            # Generate and add test work orders
            work_orders_data = generate_realistic_work_orders(15)
            added_work_orders = add_work_orders_to_database(work_orders_data, user.id)
            print(f"✅ Added {len(added_work_orders)} test work orders")
            
        elif choice == "2":
            # Verify existing work orders
            verification = verify_work_orders_added(user.id)
            print("\n📊 Verification Results:")
            print(json.dumps(verification, indent=2))
            
        elif choice == "3":
            # Remove test work orders
            count = remove_test_work_orders(user.id)
            print(f"✅ Removed {count} test work orders")
            
        elif choice == "4":
            # Add work orders and verify
            work_orders_data = generate_realistic_work_orders(15)
            added_work_orders = add_work_orders_to_database(work_orders_data, user.id)
            verification = verify_work_orders_added(user.id)
            
            print(f"✅ Added {len(added_work_orders)} test work orders")
            print("\n📊 Verification Results:")
            print(json.dumps(verification, indent=2))
            
            # Provide next steps
            print("\n💡 Next Steps:")
            print(f"   1. Test User ID: {user.id}")
            print("   2. Run filter data flow test:")
            print("      python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/tests/integration/test_filter_data_flow.py")
            print("   3. Check dashboard at http://localhost:5173")
            print("   4. Test filter calculation API directly")
            
        else:
            print("❌ Invalid choice")
            return 1
            
        return 0
        
    except Exception as e:
        logger.error(f"❌ Error in main: {str(e)}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    exit(main())
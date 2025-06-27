#!/usr/bin/env python3
"""
Add Test Dispensers to Work Orders

This script adds test dispenser data to existing work orders that don't have dispensers.
This is needed for the filter calculation to work properly.
"""

import asyncio
import sys
import os
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

# Set database URL to the correct path
os.environ['DATABASE_URL'] = f"sqlite:///{Path(__file__).parent.parent.parent / 'backend' / 'fossawork_v2.db'}"

from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import WorkOrder, User, Dispenser
import json


def add_test_dispensers_to_work_order(work_order: WorkOrder, db: Session) -> list:
    """
    Add test dispensers to a work order based on service items.
    
    Returns the list of Dispenser objects that were added.
    """
    # Extract number of dispensers from service items
    num_dispensers = 6  # Default
    
    if work_order.service_items:
        items = work_order.service_items if isinstance(work_order.service_items, list) else [work_order.service_items]
        for item in items:
            if item and 'x' in str(item):
                # Extract number from "6 x All Dispensers"
                try:
                    num_str = str(item).split('x')[0].strip()
                    num_dispensers = int(num_str)
                except:
                    pass
    
    # Create test dispensers
    dispensers = []
    for i in range(1, num_dispensers + 1):
        fuel_grades = {
            "1": {"grade": "Regular 87", "position": 1},
            "2": {"grade": "Plus 89", "position": 2} if i % 2 == 1 else {"grade": "Premium 93", "position": 2}
        }
        
        # Add diesel for some dispensers
        if i > num_dispensers - 2:
            fuel_grades["3"] = {"grade": "Diesel", "position": 3}
        
        dispenser = Dispenser(
            work_order_id=work_order.id,
            dispenser_number=str(i),
            dispenser_type="MPD" if i % 2 == 1 else "Blender",
            make="Wayne",
            model="Ovation 2",
            serial_number=f"SN-{work_order.store_number}-{i}",
            meter_type="Electronic" if i <= 4 else "Mechanical",
            number_of_nozzles="3" if i > num_dispensers - 2 else "2",
            fuel_grades=fuel_grades,
            status="pending",
            progress_percentage=0.0,
            automation_completed=False
        )
        
        db.add(dispenser)
        dispensers.append(dispenser)
    
    return dispensers


def main():
    """Main function to add test dispensers to work orders."""
    print("\n🔧 Adding Test Dispensers to Work Orders")
    print("=" * 60)
    
    db = SessionLocal()
    
    # Check if running non-interactively
    non_interactive = len(sys.argv) > 1 and sys.argv[1] == '--all'
    
    try:
        # Get work orders that need dispensers
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(['2861', '2862', '3002', '3146'])
        ).all()
        
        print(f"\n📋 Found {len(work_orders)} work orders with dispenser services")
        
        # Check how many already have dispensers
        with_dispensers = 0
        without_dispensers = 0
        
        for wo in work_orders:
            if wo.dispensers and len(wo.dispensers) > 0:
                with_dispensers += 1
            else:
                without_dispensers += 1
        
        print(f"✅ {with_dispensers} already have dispensers")
        print(f"❌ {without_dispensers} are missing dispensers")
        
        if without_dispensers == 0:
            print("\n✨ All work orders already have dispensers!")
            return
        
        if non_interactive:
            # Auto-select option 1 if running non-interactively
            choice = '1'
            print("\n🚀 Running in non-interactive mode - adding dispensers to ALL work orders")
        else:
            # Ask user what to do
            print(f"\nWhat would you like to do?")
            print("1. Add dispensers to ALL work orders missing them")
            print("2. Add dispensers to work orders for a specific user")
            print("3. Add dispensers to work orders in a date range")
            print("4. Exit")
            
            choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == '4':
            print("Exiting...")
            return
        
        # Filter work orders based on choice
        target_work_orders = []
        
        if choice == '1':
            target_work_orders = [wo for wo in work_orders if not wo.dispensers or len(wo.dispensers) == 0]
        
        elif choice == '2':
            # List users
            users = db.query(User).all()
            print("\nAvailable users:")
            for i, user in enumerate(users, 1):
                print(f"{i}. {user.email} (ID: {user.id})")
            
            user_choice = input("\nEnter user number: ").strip()
            try:
                selected_user = users[int(user_choice) - 1]
                target_work_orders = [
                    wo for wo in work_orders 
                    if wo.user_id == selected_user.id and (not wo.dispensers or len(wo.dispensers) == 0)
                ]
                print(f"\nSelected user: {selected_user.email}")
            except:
                print("Invalid selection")
                return
        
        elif choice == '3':
            from datetime import datetime, timedelta
            print("\nSelect date range:")
            print("1. Current week")
            print("2. Next week")
            print("3. Last 30 days")
            
            range_choice = input("\nEnter choice (1-3): ").strip()
            
            today = datetime.now()
            if range_choice == '1':
                # Current week
                start = today - timedelta(days=today.weekday())
                end = start + timedelta(days=6)
            elif range_choice == '2':
                # Next week
                start = today - timedelta(days=today.weekday()) + timedelta(days=7)
                end = start + timedelta(days=6)
            else:
                # Last 30 days
                start = today - timedelta(days=30)
                end = today
            
            target_work_orders = [
                wo for wo in work_orders 
                if wo.scheduled_date and start <= wo.scheduled_date <= end 
                and (not wo.dispensers or len(wo.dispensers) == 0)
            ]
        
        if not target_work_orders:
            print("\n⚠️ No work orders found matching your criteria")
            return
        
        print(f"\n🎯 Will add dispensers to {len(target_work_orders)} work orders")
        
        if not non_interactive:
            confirm = input("Continue? (y/n): ").strip().lower()
            
            if confirm != 'y':
                print("Cancelled")
                return
        else:
            print("✅ Proceeding automatically in non-interactive mode...")
        
        # Add dispensers
        updated_count = 0
        for wo in target_work_orders:
            print(f"\n📝 Processing {wo.external_id} - {wo.site_name}")
            
            # Add test dispensers
            dispensers = add_test_dispensers_to_work_order(wo, db)
            
            print(f"   ✅ Added {len(dispensers)} dispensers")
            updated_count += 1
        
        # Commit changes
        db.commit()
        
        print(f"\n✨ Successfully updated {updated_count} work orders with dispenser data!")
        print("\n💡 The dashboard filter calculations should now work properly!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
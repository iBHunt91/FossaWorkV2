#!/usr/bin/env python3
"""
Fix the dispenser work_order_id constraint issue that's causing scraping failures
"""

import sys
import os
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

# Set environment
os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"

from sqlalchemy import text, inspect
from app.database import engine, SessionLocal
from app.models import Dispenser, WorkOrder

def check_dispenser_constraints():
    """Check the current dispenser table constraints"""
    print("\n" + "="*80)
    print("🔍 CHECKING DISPENSER TABLE CONSTRAINTS")
    print("="*80)
    
    inspector = inspect(engine)
    
    # Get foreign keys
    foreign_keys = inspector.get_foreign_keys('dispensers')
    print("\nForeign Keys:")
    for fk in foreign_keys:
        print(f"  - {fk['name']}: {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
        print(f"    On delete: {fk.get('ondelete', 'NO ACTION')}")
    
    # Get columns
    columns = inspector.get_columns('dispensers')
    print("\nColumns:")
    for col in columns:
        if col['name'] == 'work_order_id':
            print(f"  - work_order_id: {col['type']}, nullable={col['nullable']}")

def fix_dispenser_deletion_issue():
    """Fix the issue by properly handling dispenser deletion"""
    print("\n" + "="*80)
    print("🔧 FIXING DISPENSER DELETION ISSUE")
    print("="*80)
    
    db = SessionLocal()
    try:
        # Option 1: Make work_order_id nullable (temporary fix)
        # This allows dispensers to exist without work orders
        print("\nOption 1: Making work_order_id nullable...")
        try:
            # SQLite doesn't support ALTER COLUMN directly
            # We need to recreate the table
            db.execute(text("PRAGMA foreign_keys=OFF"))
            
            # Create new table with nullable work_order_id
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS dispensers_new (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    work_order_id TEXT,  -- Now nullable
                    store_number TEXT,
                    dispenser_number INTEGER,
                    brand TEXT,
                    model TEXT,
                    serial_number TEXT,
                    fuel_grades TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (work_order_id) REFERENCES work_orders (id) ON DELETE SET NULL
                )
            """))
            
            # Copy data
            db.execute(text("""
                INSERT INTO dispensers_new 
                SELECT * FROM dispensers
            """))
            
            # Drop old table and rename new one
            db.execute(text("DROP TABLE dispensers"))
            db.execute(text("ALTER TABLE dispensers_new RENAME TO dispensers"))
            
            db.execute(text("PRAGMA foreign_keys=ON"))
            db.commit()
            print("✅ Successfully made work_order_id nullable")
            
        except Exception as e:
            print(f"❌ Failed to modify table: {e}")
            db.rollback()
            
            # Option 2: Delete orphaned dispensers before deleting work orders
            print("\nOption 2: Implementing proper cleanup in code...")
            print("This requires modifying the scheduler_service.py to delete dispensers before work orders")
            
    finally:
        db.close()

def create_cleanup_script():
    """Create a script to properly clean up work orders"""
    script_content = '''#!/usr/bin/env python3
"""
Properly clean up completed work orders and their dispensers
"""

import sys
import os
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

os.environ['SECRET_KEY'] = "Am7t7lXtMeZQJ48uYGgh2L0Uy7OzBnvEfGaqoXKPzcw"

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser
from datetime import datetime

def cleanup_completed_work_orders(user_id: str, current_external_ids: set):
    """Properly clean up work orders that are no longer present"""
    db = SessionLocal()
    try:
        # Get all existing work orders for this user
        existing_work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).all()
        
        removed_count = 0
        
        # Find work orders to remove
        for existing_wo in existing_work_orders:
            if existing_wo.external_id not in current_external_ids:
                print(f"Removing work order: {existing_wo.external_id} - {existing_wo.site_name}")
                
                # First, delete associated dispensers
                dispensers = db.query(Dispenser).filter(
                    Dispenser.work_order_id == existing_wo.id
                ).all()
                
                for dispenser in dispensers:
                    db.delete(dispenser)
                    print(f"  - Deleted dispenser: {dispenser.dispenser_number}")
                
                # Then delete the work order
                db.delete(existing_wo)
                removed_count += 1
        
        db.commit()
        print(f"\\nSuccessfully removed {removed_count} completed work orders")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Test with sample data
    cleanup_completed_work_orders("test_user", {"W-12345", "W-12346"})
'''
    
    script_path = Path(__file__).parent / "proper_work_order_cleanup.py"
    with open(script_path, 'w') as f:
        f.write(script_content)
    
    print(f"\n✅ Created cleanup script at: {script_path}")
    print("This script shows how to properly delete work orders and their dispensers")

def main():
    """Main function"""
    print("Dispenser Constraint Fix Script")
    print("="*80)
    
    # Check current constraints
    check_dispenser_constraints()
    
    # Fix the issue
    fix_dispenser_deletion_issue()
    
    # Create proper cleanup script
    create_cleanup_script()
    
    print("\n" + "="*80)
    print("RECOMMENDATIONS:")
    print("="*80)
    print("""
1. The immediate fix is to make work_order_id nullable in the dispensers table
2. The proper fix is to modify scheduler_service.py to delete dispensers before work orders
3. Look at lines 224-236 in scheduler_service.py
4. Add code to delete dispensers before deleting work orders:

    # Delete associated dispensers first
    dispensers_to_delete = db.query(Dispenser).filter(
        Dispenser.work_order_id == wo_to_remove.id
    ).all()
    for dispenser in dispensers_to_delete:
        db.delete(dispenser)
    
    # Then delete the work order
    db.delete(wo_to_remove)
""")

if __name__ == "__main__":
    main()
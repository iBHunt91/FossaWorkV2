#!/usr/bin/env python3
"""
Reset Users Script
Safely removes all users and related data for testing the zero-user setup flow
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.user_models import (
    User, UserPreference, UserCredential, UserActivity, 
    UserScheduleChanges, UserCompletedJobs, UserBatchHistory
)
from app.core_models import WorkOrder, Dispenser, AutomationJob

def confirm_reset():
    """Ask for confirmation before resetting"""
    print("\n⚠️  WARNING: This will delete ALL users and their data!")
    print("This includes:")
    print("  - All user accounts")
    print("  - All user preferences")
    print("  - All stored credentials")
    print("  - All work orders")
    print("  - All automation jobs")
    print("  - All activity logs")
    print("\nThis action cannot be undone!")
    
    response = input("\nAre you sure you want to continue? (type 'YES' to confirm): ")
    return response == "YES"

def reset_all_users(db: Session):
    """Remove all users and related data"""
    try:
        print("\n🔄 Starting user reset process...")
        
        # Count current data
        user_count = db.query(User).count()
        work_order_count = db.query(WorkOrder).count()
        
        print(f"\n📊 Current data:")
        print(f"  - Users: {user_count}")
        print(f"  - Work Orders: {work_order_count}")
        
        if user_count == 0:
            print("\n✅ No users found - system is already in zero-user state!")
            return True
        
        # Delete in correct order (respect foreign keys)
        print("\n🗑️  Deleting data...")
        
        # Delete automation jobs
        deleted = db.query(AutomationJob).delete()
        print(f"  ✅ Deleted {deleted} automation jobs")
        
        # Delete dispensers
        deleted = db.query(Dispenser).delete()
        print(f"  ✅ Deleted {deleted} dispensers")
        
        # Delete work orders
        deleted = db.query(WorkOrder).delete()
        print(f"  ✅ Deleted {deleted} work orders")
        
        # Delete user-related data
        deleted = db.query(UserBatchHistory).delete()
        print(f"  ✅ Deleted {deleted} batch history records")
        
        deleted = db.query(UserCompletedJobs).delete()
        print(f"  ✅ Deleted {deleted} completed job records")
        
        deleted = db.query(UserScheduleChanges).delete()
        print(f"  ✅ Deleted {deleted} schedule change records")
        
        deleted = db.query(UserActivity).delete()
        print(f"  ✅ Deleted {deleted} activity records")
        
        deleted = db.query(UserCredential).delete()
        print(f"  ✅ Deleted {deleted} stored credentials")
        
        deleted = db.query(UserPreference).delete()
        print(f"  ✅ Deleted {deleted} user preferences")
        
        # Finally, delete users
        deleted = db.query(User).delete()
        print(f"  ✅ Deleted {deleted} users")
        
        # Commit all changes
        db.commit()
        
        # Verify reset
        final_user_count = db.query(User).count()
        if final_user_count == 0:
            print("\n✅ SUCCESS: All users and related data have been removed!")
            print("The system is now in zero-user state.")
            print("\nNext steps:")
            print("1. Start the backend: uvicorn app.main:app --reload")
            print("2. Visit: http://localhost:8000/api/setup/status")
            print("3. You should see: {\"setup_required\": true}")
            print("4. Use /api/setup/initialize to create first user with WorkFossa credentials")
            return True
        else:
            print(f"\n❌ ERROR: {final_user_count} users still remain!")
            return False
            
    except Exception as e:
        print(f"\n❌ Error during reset: {e}")
        db.rollback()
        return False

def main():
    """Main function"""
    print("🎯 FossaWork V2 - User Reset Tool")
    print("=" * 60)
    
    if not confirm_reset():
        print("\n❌ Reset cancelled by user")
        return False
    
    # Create database session
    db = SessionLocal()
    
    try:
        success = reset_all_users(db)
        return success
    finally:
        db.close()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
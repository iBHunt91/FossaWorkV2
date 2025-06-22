#!/usr/bin/env python3
"""
Debug database connection for auth endpoints
"""
import sys
sys.path.append('./backend')

from backend.app.database import get_db, create_tables
from backend.app.models.user_models import User
from sqlalchemy.orm import Session

def test_database():
    """Test basic database operations"""
    print("🗄️ Testing database connection...")
    
    try:
        # Create tables
        create_tables()
        print("✅ Tables created/verified")
        
        # Get database session
        db_session = next(get_db())
        print("✅ Database session created")
        
        # Test User query
        user_count = db_session.query(User).count()
        print(f"✅ User count: {user_count}")
        
        # Test creating a user
        demo_user_id = "demo"
        existing_user = db_session.query(User).filter(User.id == demo_user_id).first()
        
        if existing_user:
            print(f"✅ Demo user exists: {existing_user.email}")
        else:
            print("ℹ️ Demo user does not exist - would be created")
            
        db_session.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_database()
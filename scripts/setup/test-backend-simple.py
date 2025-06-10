#!/usr/bin/env python3
"""Simple backend test to verify database and routes are working"""

import sys
import os
sys.path.append('backend/app')

# Use the same database setup as main_full.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_simple import User, UserCredentials

DATABASE_URL = "sqlite:///backend/fossawork_v2.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_database():
    """Test database connection and basic operations"""
    try:
        # Test database connection
        db = next(get_db())
        print("Database connection successful")
        
        # Test if tables exist
        users = db.query(User).all()
        print(f"User table accessible ({len(users)} users)")
        
        credentials = db.query(UserCredentials).all()
        print(f"UserCredentials table accessible ({len(credentials)} credentials)")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"Database test failed: {e}")
        return False

def test_routes():
    """Test route imports"""
    try:
        from routes.credentials import router as credentials_router
        print("Credentials router imported successfully")
        
        from routes.user_preferences import router as user_preferences_router
        print("User preferences router imported successfully")
        
        return True
        
    except Exception as e:
        print(f"Route import failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing FossaWork V2 Backend Components...")
    print("=" * 50)
    
    # Test database
    db_ok = test_database()
    print()
    
    # Test routes
    routes_ok = test_routes()
    print()
    
    if db_ok and routes_ok:
        print("All backend components are working!")
        print("The credential and user preferences errors should be fixed")
    else:
        print("Some components are not working properly")
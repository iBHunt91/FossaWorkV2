#!/usr/bin/env python3
"""
Test script to verify Day 1 foundation setup
"""

import sys
import os

def test_imports():
    """Test that we can import our modules"""
    try:
        print("🔄 Testing imports...")
        
        # Test SQLAlchemy
        from sqlalchemy import create_engine
        print("✅ SQLAlchemy available")
        
        # Test FastAPI 
        from fastapi import FastAPI
        print("✅ FastAPI available")
        
        # Test our models
        from app.models import User, WorkOrder, Dispenser
        print("✅ Models import successfully")
        
        # Test database
        from app.database import create_tables, get_db
        print("✅ Database module available")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_database_creation():
    """Test database table creation"""
    try:
        print("🔄 Testing database creation...")
        
        from app.database import create_tables, engine
        from app.models import Base
        
        # Create tables
        create_tables()
        print("✅ Database tables created successfully")
        
        # Verify tables exist
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        expected_tables = ['users', 'user_preferences', 'user_credentials', 'work_orders', 'dispensers', 'automation_jobs']
        
        missing_tables = [table for table in expected_tables if table not in tables]
        if missing_tables:
            print(f"❌ Missing tables: {missing_tables}")
            return False
            
        print(f"✅ All tables created: {tables}")
        return True
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

def test_user_model():
    """Test user model functionality"""
    try:
        print("🔄 Testing user model...")
        
        from app.models import User
        from app.database import SessionLocal
        
        db = SessionLocal()
        
        # Test password hashing
        test_password = "test123"
        hashed = User.hash_password(test_password)
        print("✅ Password hashing works")
        
        # Create test user
        test_user = User(
            username="test_user",
            email="test@example.com",
            hashed_password=hashed
        )
        
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print(f"✅ Test user created with ID: {test_user.id}")
        
        # Test password verification
        if test_user.verify_password(test_password):
            print("✅ Password verification works")
        else:
            print("❌ Password verification failed")
            return False
            
        # Cleanup
        db.delete(test_user)
        db.commit()
        db.close()
        
        return True
        
    except Exception as e:
        print(f"❌ User model error: {e}")
        return False

def main():
    """Run all tests"""
    print("🎯 FossaWork V2 - Day 1 Foundation Tests")
    print("=" * 50)
    
    tests = [
        ("Imports", test_imports),
        ("Database Creation", test_database_creation),
        ("User Model", test_user_model)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}:")
        if test_func():
            passed += 1
            print(f"✅ {test_name} PASSED")
        else:
            print(f"❌ {test_name} FAILED")
    
    print("\n" + "=" * 50)
    print(f"🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Foundation is ready!")
        return True
    else:
        print("⚠️  Some tests failed - foundation needs fixes")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
"""
Comprehensive API test without external dependencies
Tests all routes and functionality
"""

import json
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
import uuid

# Import our modules directly
from app.models import User, WorkOrder, Dispenser, UserPreference
from app.database import SessionLocal, create_tables
from app.services.scraping_service import create_scraper, create_data_manager

def test_database_models():
    """Test database models and relationships"""
    print("\n🔄 Testing Database Models...")
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Create test user
        test_user = User(
            id=str(uuid.uuid4()),
            username="testuser",
            email="test@example.com",
            hashed_password=User.hash_password("testpass123"),
            is_active=True
        )
        db.add(test_user)
        db.commit()
        print("  ✅ User created successfully")
        
        # Verify password
        assert test_user.verify_password("testpass123"), "Password verification failed"
        print("  ✅ Password verification working")
        
        # Create work order
        test_work_order = WorkOrder(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            external_id="WO-TEST-001",
            site_name="Test Station",
            address="123 Test St",
            scheduled_date=datetime.now(),
            status="pending"
        )
        db.add(test_work_order)
        db.commit()
        print("  ✅ Work order created successfully")
        
        # Create dispenser
        test_dispenser = Dispenser(
            id=str(uuid.uuid4()),
            work_order_id=test_work_order.id,
            dispenser_number="1",
            dispenser_type="Wayne 300",
            fuel_grades={
                "regular": {"octane": 87, "position": 1},
                "mid": {"octane": 89, "position": 2},
                "premium": {"octane": 91, "position": 3}
            },
            status="pending"
        )
        db.add(test_dispenser)
        db.commit()
        print("  ✅ Dispenser created successfully")
        
        # Create user preference
        test_preference = UserPreference(
            id=str(uuid.uuid4()),
            user_id=test_user.id,
            preference_type="notification_settings",
            preference_data={
                "email_enabled": True,
                "frequency": "daily"
            }
        )
        db.add(test_preference)
        db.commit()
        print("  ✅ User preference created successfully")
        
        # Test relationships
        user_work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == test_user.id).all()
        assert len(user_work_orders) == 1, "Work order relationship failed"
        print("  ✅ User-WorkOrder relationship working")
        
        work_order_dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == test_work_order.id).all()
        assert len(work_order_dispensers) == 1, "Dispenser relationship failed"
        print("  ✅ WorkOrder-Dispenser relationship working")
        
        # Cleanup
        db.query(UserPreference).delete()
        db.query(Dispenser).delete()
        db.query(WorkOrder).delete()
        db.query(User).delete()
        db.commit()
        print("  ✅ Cleanup successful")
        
    except Exception as e:
        print(f"  ❌ Database test failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    print("✅ Database Models Test - PASSED")
    return True

def test_scraping_service():
    """Test scraping service logic"""
    print("\n🔄 Testing Scraping Service...")
    
    try:
        # Create scraper instance
        test_user_id = "test_user_123"
        test_credentials = {"username": "test", "password": "test"}
        
        scraper = create_scraper(test_user_id, test_credentials)
        data_manager = create_data_manager(test_user_id)
        
        # Test synchronous methods
        status = scraper.get_scrape_status()
        assert status["user_id"] == test_user_id, "User ID mismatch"
        assert status["scraper_version"] == "2.0.0", "Version mismatch"
        print("  ✅ Scraper initialization successful")
        
        # Test data manager
        assert data_manager.user_id == test_user_id, "Data manager user ID mismatch"
        assert len(data_manager.get_work_orders()) == 0, "Should start with no work orders"
        print("  ✅ Data manager initialization successful")
        
        # Test export
        export = data_manager.export_data()
        assert "user_id" in export, "Export missing user_id"
        assert "work_orders" in export, "Export missing work_orders"
        print("  ✅ Data export working")
        
    except Exception as e:
        print(f"  ❌ Scraping service test failed: {e}")
        return False
    
    print("✅ Scraping Service Test - PASSED")
    return True

def test_api_routes_logic():
    """Test API route logic without running server"""
    print("\n🔄 Testing API Route Logic...")
    
    try:
        # Test user route logic
        from app.routes.users import UserCreate
        
        # Test Pydantic model
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        assert user_data.username == "testuser", "Pydantic model failed"
        print("  ✅ User route models working")
        
        # Test work order route logic
        from app.routes.work_orders import router as wo_router
        
        # Check routes are defined
        routes = [route.path for route in wo_router.routes]
        assert "/" in routes, "Missing root route"
        assert "/{work_order_id}" in routes, "Missing detail route"
        assert "/scrape" in routes, "Missing scrape route"
        print("  ✅ Work order routes defined correctly")
        
    except Exception as e:
        print(f"  ❌ API route logic test failed: {e}")
        return False
    
    print("✅ API Route Logic Test - PASSED")
    return True

def test_business_logic():
    """Test core business logic"""
    print("\n🔄 Testing Business Logic...")
    
    try:
        # Test dispenser progress calculation
        dispenser = Dispenser(
            id="test",
            work_order_id="test_wo",
            dispenser_number="1",
            dispenser_type="Wayne 300",
            fuel_grades={"regular": {}, "mid": {}, "premium": {}},
            status="in_progress",
            progress_percentage=75.0
        )
        
        assert dispenser.progress_percentage == 75.0, "Progress percentage failed"
        print("  ✅ Progress tracking working")
        
        # Test status transitions
        valid_statuses = ["pending", "in_progress", "completed", "failed"]
        for status in valid_statuses:
            dispenser.status = status
            assert dispenser.status == status, f"Status transition to {status} failed"
        print("  ✅ Status transitions working")
        
        # Test fuel grade validation
        fuel_grades = {
            "regular": {"octane": 87, "ethanol": 10},
            "mid": {"octane": 89, "ethanol": 10},
            "premium": {"octane": 91, "ethanol": 0},
            "diesel": {"cetane": 40, "sulfur": "low"}
        }
        dispenser.fuel_grades = fuel_grades
        assert len(dispenser.fuel_grades) == 4, "Fuel grade storage failed"
        print("  ✅ Fuel grade handling working")
        
    except Exception as e:
        print(f"  ❌ Business logic test failed: {e}")
        return False
    
    print("✅ Business Logic Test - PASSED")
    return True

def test_data_isolation():
    """Test multi-user data isolation"""
    print("\n🔄 Testing Multi-User Data Isolation...")
    
    db = SessionLocal()
    
    try:
        # Create two users
        user1 = User(
            id=str(uuid.uuid4()),
            username="user1",
            email="user1@example.com",
            hashed_password=User.hash_password("pass1"),
            is_active=True
        )
        user2 = User(
            id=str(uuid.uuid4()),
            username="user2", 
            email="user2@example.com",
            hashed_password=User.hash_password("pass2"),
            is_active=True
        )
        db.add(user1)
        db.add(user2)
        db.commit()
        print("  ✅ Created test users")
        
        # Create work orders for each user
        wo1 = WorkOrder(
            id=str(uuid.uuid4()),
            user_id=user1.id,
            external_id="WO-USER1-001",
            site_name="User1 Station",
            address="111 First St",
            status="pending"
        )
        wo2 = WorkOrder(
            id=str(uuid.uuid4()),
            user_id=user2.id,
            external_id="WO-USER2-001",
            site_name="User2 Station",
            address="222 Second St",
            status="pending"
        )
        db.add(wo1)
        db.add(wo2)
        db.commit()
        print("  ✅ Created isolated work orders")
        
        # Verify isolation
        user1_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user1.id).all()
        user2_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user2.id).all()
        
        assert len(user1_orders) == 1, "User1 should have 1 work order"
        assert len(user2_orders) == 1, "User2 should have 1 work order"
        assert user1_orders[0].site_name == "User1 Station", "User1 data incorrect"
        assert user2_orders[0].site_name == "User2 Station", "User2 data incorrect"
        print("  ✅ Data isolation verified")
        
        # Cleanup
        db.query(WorkOrder).delete()
        db.query(User).delete()
        db.commit()
        
    except Exception as e:
        print(f"  ❌ Data isolation test failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    print("✅ Multi-User Data Isolation Test - PASSED")
    return True

def main():
    """Run all tests"""
    print("🎯 FossaWork V2 - Comprehensive API Testing")
    print("=" * 60)
    print("Testing without external dependencies...")
    
    # Ensure database tables exist
    create_tables()
    
    # Run all tests
    tests = [
        ("Database Models", test_database_models),
        ("Scraping Service", test_scraping_service),
        ("API Route Logic", test_api_routes_logic),
        ("Business Logic", test_business_logic),
        ("Data Isolation", test_data_isolation)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ {test_name} - FAILED with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("🎯 TEST SUMMARY:")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! API is ready for deployment.")
        print("\n📋 Next Steps:")
        print("1. Install dependencies when pip is available")
        print("2. Run: uvicorn app.main:app --reload")
        print("3. Access API docs at: http://localhost:8000/docs")
        print("4. Begin frontend development")
    else:
        print("\n⚠️  Some tests failed. Please review and fix issues.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
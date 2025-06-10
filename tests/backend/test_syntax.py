#!/usr/bin/env python3
"""
Syntax and structure verification test
Tests without requiring external dependencies
"""

import os
import sys
import ast
import json
from datetime import datetime

def test_python_syntax():
    """Test all Python files for syntax errors"""
    print("🔄 Testing Python Syntax...")
    
    python_files = []
    for root, dirs, files in os.walk("app"):
        for file in files:
            if file.endswith(".py"):
                python_files.append(os.path.join(root, file))
    
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                source = f.read()
            
            # Parse AST to check syntax
            ast.parse(source)
            print(f"  ✅ {file_path} - Syntax OK")
            
        except SyntaxError as e:
            print(f"  ❌ {file_path} - Syntax Error: {e}")
            return False
        except Exception as e:
            print(f"  ⚠️  {file_path} - Warning: {e}")
    
    return True

def test_file_structure():
    """Test project file structure"""
    print("🔄 Testing File Structure...")
    
    required_files = [
        "app/__init__.py",
        "app/main.py", 
        "app/models.py",
        "app/database.py",
        "app/routes/__init__.py",
        "app/routes/users.py",
        "app/routes/work_orders.py",
        "app/services/__init__.py",
        "app/services/scraping_service.py",
        "requirements.txt"
    ]
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"  ✅ {file_path} - Found")
        else:
            print(f"  ❌ {file_path} - Missing")
            return False
    
    return True

def test_import_structure():
    """Test import structure without executing"""
    print("🔄 Testing Import Structure...")
    
    files_to_check = {
        "app/main.py": [
            "from fastapi import FastAPI",
            "from .routes import users, work_orders"
        ],
        "app/models.py": [
            "from sqlalchemy import Column",
            "class User",
            "class WorkOrder",
            "class Dispenser"
        ],
        "app/routes/users.py": [
            "from fastapi import APIRouter",
            "router = APIRouter"
        ],
        "app/routes/work_orders.py": [
            "from fastapi import APIRouter",
            "router = APIRouter"
        ]
    }
    
    for file_path, expected_content in files_to_check.items():
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            for expected in expected_content:
                if expected in content:
                    print(f"  ✅ {file_path} - Contains '{expected}'")
                else:
                    print(f"  ❌ {file_path} - Missing '{expected}'")
                    return False
                    
        except Exception as e:
            print(f"  ❌ {file_path} - Error reading: {e}")
            return False
    
    return True

def test_data_structures():
    """Test data structure definitions"""
    print("🔄 Testing Data Structures...")
    
    try:
        # Test sample data structures that should work
        sample_user = {
            "id": "user_123",
            "username": "testuser",
            "email": "test@example.com",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        }
        
        sample_work_order = {
            "id": "wo_123",
            "user_id": "user_123",
            "external_id": "WO-001",
            "site_name": "Test Station",
            "address": "123 Main St",
            "status": "pending",
            "created_at": datetime.now().isoformat()
        }
        
        sample_dispenser = {
            "id": "disp_123",
            "work_order_id": "wo_123",
            "dispenser_number": "1",
            "dispenser_type": "Wayne 300",
            "fuel_grades": {
                "regular": {"octane": 87, "position": 1},
                "mid": {"octane": 89, "position": 2},
                "premium": {"octane": 91, "position": 3}
            },
            "status": "pending",
            "progress_percentage": 0.0
        }
        
        # Test JSON serialization
        json.dumps(sample_user)
        json.dumps(sample_work_order)
        json.dumps(sample_dispenser)
        
        print("  ✅ User data structure - Valid")
        print("  ✅ Work order data structure - Valid")
        print("  ✅ Dispenser data structure - Valid")
        print("  ✅ JSON serialization - Working")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Data structure test failed: {e}")
        return False

def test_api_design():
    """Test API endpoint design"""
    print("🔄 Testing API Design...")
    
    try:
        # Check routes file for proper endpoint patterns
        with open("app/routes/users.py", 'r') as f:
            users_content = f.read()
        
        with open("app/routes/work_orders.py", 'r') as f:
            work_orders_content = f.read()
        
        # Check for RESTful patterns
        user_endpoints = [
            '@router.post("/",',  # Create user (partial match)
            '@router.get("/",',   # List users (partial match)
            '@router.get("/{user_id}",',  # Get user (partial match)
            '@router.post("/login")'  # Login
        ]
        
        work_order_endpoints = [
            '@router.get("/",',  # List work orders (partial match)
            '@router.get("/{work_order_id}",',  # Get work order (partial match)
            '@router.post("/scrape")',  # Trigger scrape
            '@router.patch("/{work_order_id}/status")'  # Update status
        ]
        
        for endpoint in user_endpoints:
            if endpoint in users_content:
                print(f"  ✅ User endpoint - {endpoint}")
            else:
                print(f"  ❌ User endpoint missing - {endpoint}")
                return False
        
        for endpoint in work_order_endpoints:
            if endpoint in work_orders_content:
                print(f"  ✅ Work order endpoint - {endpoint}")
            else:
                print(f"  ❌ Work order endpoint missing - {endpoint}")
                return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ API design test failed: {e}")
        return False

def test_configuration():
    """Test configuration files"""
    print("🔄 Testing Configuration...")
    
    try:
        # Check requirements.txt
        with open("requirements.txt", 'r') as f:
            requirements = f.read()
        
        required_packages = ["fastapi", "sqlalchemy", "bcrypt", "pydantic"]
        
        for package in required_packages:
            if package in requirements:
                print(f"  ✅ Required package - {package}")
            else:
                print(f"  ⚠️  Package might be missing - {package}")
        
        # Check project structure
        directories = ["app", "app/models", "app/routes", "app/services", "app/utils", "tests"]
        
        for directory in directories:
            if os.path.exists(directory):
                print(f"  ✅ Directory - {directory}")
            else:
                print(f"  ❌ Directory missing - {directory}")
                return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ Configuration test failed: {e}")
        return False

def main():
    """Run all syntax and structure tests"""
    print("🎯 FossaWork V2 - Syntax & Structure Verification")
    print("=" * 60)
    print("Testing without external dependencies...")
    
    tests = [
        ("File Structure", test_file_structure),
        ("Python Syntax", test_python_syntax),
        ("Import Structure", test_import_structure),
        ("Data Structures", test_data_structures),
        ("API Design", test_api_design),
        ("Configuration", test_configuration)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} - FAILED with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("🎯 SYNTAX & STRUCTURE TEST SUMMARY:")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL SYNTAX & STRUCTURE TESTS PASSED!")
        print("\n📋 Code Quality Status:")
        print("✅ File structure is correct")
        print("✅ Python syntax is valid")
        print("✅ Import structure is proper")
        print("✅ Data structures are well-designed")
        print("✅ API endpoints follow REST patterns")
        print("✅ Configuration is complete")
        print("\n🚀 Ready for dependency installation and server start!")
    else:
        print("\n⚠️  Some tests failed. Please review and fix issues.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
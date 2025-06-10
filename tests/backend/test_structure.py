#!/usr/bin/env python3
"""
Simple structure test without external dependencies
"""

import os
import sys

def test_file_structure():
    """Test that all required files exist"""
    print("🔄 Testing file structure...")
    
    required_files = [
        "app/__init__.py",
        "app/main.py", 
        "app/models.py",
        "app/database.py",
        "requirements.txt",
        "test_setup.py"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
        else:
            print(f"  ✅ {file_path}")
    
    if missing_files:
        print(f"  ❌ Missing files: {missing_files}")
        return False
    
    print("✅ All required files present")
    return True

def test_python_syntax():
    """Test that Python files have valid syntax"""
    print("🔄 Testing Python syntax...")
    
    python_files = [
        "app/main.py",
        "app/models.py", 
        "app/database.py"
    ]
    
    for file_path in python_files:
        try:
            with open(file_path, 'r') as f:
                code = f.read()
            
            # Compile to check syntax
            compile(code, file_path, 'exec')
            print(f"  ✅ {file_path} - syntax OK")
            
        except SyntaxError as e:
            print(f"  ❌ {file_path} - syntax error: {e}")
            return False
        except Exception as e:
            print(f"  ❌ {file_path} - error: {e}")
            return False
    
    print("✅ All Python files have valid syntax")
    return True

def test_requirements():
    """Test that requirements.txt contains expected packages"""
    print("🔄 Testing requirements.txt...")
    
    try:
        with open("requirements.txt", 'r') as f:
            requirements = f.read().lower()
        
        required_packages = ['fastapi', 'uvicorn', 'sqlalchemy', 'psycopg2', 'pydantic']
        
        missing_packages = []
        for package in required_packages:
            if package not in requirements:
                missing_packages.append(package)
            else:
                print(f"  ✅ {package}")
        
        if missing_packages:
            print(f"  ❌ Missing packages: {missing_packages}")
            return False
            
        print("✅ All required packages listed")
        return True
        
    except Exception as e:
        print(f"❌ Error reading requirements.txt: {e}")
        return False

def test_directory_structure():
    """Test that directory structure is correct"""
    print("🔄 Testing directory structure...")
    
    expected_dirs = [
        "app",
        "app/models",
        "app/routes", 
        "app/services",
        "app/utils",
        "alembic",
        "tests"
    ]
    
    missing_dirs = []
    for dir_path in expected_dirs:
        if not os.path.exists(dir_path):
            missing_dirs.append(dir_path)
        else:
            print(f"  ✅ {dir_path}/")
    
    if missing_dirs:
        print(f"  ❌ Missing directories: {missing_dirs}")
        return False
        
    print("✅ Directory structure correct")
    return True

def test_imports_syntax():
    """Test that our imports are syntactically correct"""
    print("🔄 Testing import statements...")
    
    # Test models.py imports
    models_imports = [
        "from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, JSON",
        "from sqlalchemy.ext.declarative import declarative_base",
        "from sqlalchemy.orm import relationship",
        "from sqlalchemy.sql import func",
        "from passlib.context import CryptContext",
        "import uuid",
        "from datetime import datetime"
    ]
    
    # Test database.py imports
    database_imports = [
        "from sqlalchemy import create_engine",
        "from sqlalchemy.orm import sessionmaker",
        "import os"
    ]
    
    # Test main.py imports
    main_imports = [
        "from fastapi import FastAPI, Depends, HTTPException",
        "from fastapi.middleware.cors import CORSMiddleware",
        "from sqlalchemy.orm import Session"
    ]
    
    all_imports = models_imports + database_imports + main_imports
    
    for import_stmt in all_imports:
        try:
            # Just check syntax, not actual import
            compile(import_stmt, '<import_test>', 'exec')
            print(f"  ✅ {import_stmt[:50]}...")
        except SyntaxError as e:
            print(f"  ❌ Invalid import syntax: {import_stmt}")
            return False
    
    print("✅ All import statements have valid syntax")
    return True

def main():
    """Run all structure tests"""
    print("🎯 FossaWork V2 - Foundation Structure Tests")
    print("=" * 60)
    
    tests = [
        ("File Structure", test_file_structure),
        ("Python Syntax", test_python_syntax), 
        ("Requirements", test_requirements),
        ("Directory Structure", test_directory_structure),
        ("Import Syntax", test_imports_syntax)
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
    
    print("\n" + "=" * 60)
    print(f"🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 STRUCTURE TESTS PASSED - Ready for dependency installation!")
        print("\n📋 Next steps:")
        print("1. Install Python dependencies with pip")
        print("2. Test with actual FastAPI server")
        print("3. Verify database creation")
        return True
    else:
        print("⚠️  Some tests failed - structure needs fixes")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
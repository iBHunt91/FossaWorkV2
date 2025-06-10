#!/usr/bin/env python3
"""
Test script for FossaWork V2 logging system
Verifies that logs are being written correctly to files
"""

import asyncio
import json
import requests
import time
from pathlib import Path

def test_backend_logging():
    """Test backend logging endpoint"""
    print("🧪 Testing backend logging...")
    
    # Test the logging endpoint
    try:
        response = requests.post('http://localhost:8000/api/v1/logs/test')
        if response.status_code == 200:
            print("✅ Backend logging endpoint working")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Backend logging endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Backend logging test failed: {e}")

def test_frontend_logging():
    """Test frontend logging endpoint"""
    print("\n🧪 Testing frontend logging...")
    
    # Test writing frontend logs
    test_logs = [
        {
            "timestamp": "2025-06-09T19:00:00.000Z",
            "level": "info",
            "logger": "frontend.test",
            "message": "Test log entry from Python script",
            "module": "test_script",
            "function": "test_frontend_logging",
            "line": 45,
            "data": {
                "test": True,
                "source": "python_test_script"
            }
        },
        {
            "timestamp": "2025-06-09T19:00:01.000Z",
            "level": "error",
            "logger": "frontend.test.error",
            "message": "Test error log entry",
            "module": "test_script",
            "function": "test_frontend_logging",
            "line": 55,
            "data": {
                "error_type": "test_error",
                "severity": "high"
            }
        }
    ]
    
    try:
        response = requests.post('http://localhost:8000/api/v1/logs/write', json={
            "logs": test_logs,
            "sessionId": "test-session-python-123",
            "source": "python_test"
        })
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Frontend logging endpoint working")
            print(f"   Entries written: {result.get('entries_written')}")
        else:
            print(f"❌ Frontend logging endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Frontend logging test failed: {e}")

def check_log_files():
    """Check if log files are being created"""
    print("\n📁 Checking log files...")
    
    log_dir = Path("../logs")
    if not log_dir.exists():
        print("❌ Main logs directory not found")
        return
    
    print(f"✅ Main logs directory exists: {log_dir.absolute()}")
    
    # Check subdirectories
    subdirs = ["backend", "frontend", "errors", "sessions", "automation", "performance"]
    for subdir in subdirs:
        subdir_path = log_dir / subdir
        if subdir_path.exists():
            files = list(subdir_path.glob("*.jsonl"))
            if files:
                print(f"✅ {subdir}/ - {len(files)} log files")
                # Show latest file info
                latest_file = max(files, key=lambda f: f.stat().st_mtime)
                size = latest_file.stat().st_size
                print(f"   Latest: {latest_file.name} ({size} bytes)")
            else:
                print(f"⚠️  {subdir}/ - directory exists but no log files")
        else:
            print(f"❌ {subdir}/ - directory missing")

def test_log_stats():
    """Test log statistics endpoint"""
    print("\n📊 Testing log statistics...")
    
    try:
        response = requests.get('http://localhost:8000/api/v1/logs/stats')
        if response.status_code == 200:
            stats = response.json()
            print("✅ Log statistics endpoint working")
            print(f"   Connected clients: {stats.get('connected_clients', 0)}")
            
            log_files = stats.get('log_files', {})
            for name, info in log_files.items():
                print(f"   {name}: {info.get('lines', 0)} lines, {info.get('size_mb', 0)} MB")
        else:
            print(f"❌ Log statistics endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Log statistics test failed: {e}")

def test_recent_logs():
    """Test recent logs endpoint"""
    print("\n📋 Testing recent logs...")
    
    try:
        response = requests.get('http://localhost:8000/api/v1/logs/recent?lines=5')
        if response.status_code == 200:
            result = response.json()
            logs = result.get('logs', [])
            print(f"✅ Recent logs endpoint working")
            print(f"   Retrieved {len(logs)} recent log entries")
            
            if logs:
                print("   Sample log entries:")
                for i, log in enumerate(logs[-3:], 1):  # Show last 3
                    print(f"   {i}. {log[:100]}..." if len(log) > 100 else f"   {i}. {log}")
        else:
            print(f"❌ Recent logs endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Recent logs test failed: {e}")

def main():
    """Run all logging tests"""
    print("🚀 FossaWork V2 Logging System Test")
    print("=" * 50)
    
    # Check if backend is running
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("✅ Backend server is running")
        else:
            print(f"⚠️  Backend server responded with status {response.status_code}")
    except Exception as e:
        print(f"❌ Backend server is not accessible: {e}")
        print("   Please start the backend server first:")
        print("   cd backend && python -m uvicorn app.main_simple:app --host 0.0.0.0 --port 8000 --reload")
        return
    
    # Run tests
    test_backend_logging()
    test_frontend_logging()
    time.sleep(1)  # Give time for files to be written
    check_log_files()
    test_log_stats()
    test_recent_logs()
    
    print("\n" + "=" * 50)
    print("🏁 Logging system test completed!")
    print("\n💡 Next steps:")
    print("   1. Start the frontend and check browser console")
    print("   2. Check Chrome DevTools Network tab for logging requests")
    print("   3. Verify log files in /logs/ directory are being updated")
    print("   4. Open log files to see structured JSONL format")

if __name__ == "__main__":
    main()
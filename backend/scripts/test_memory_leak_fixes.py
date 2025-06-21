#!/usr/bin/env python3
"""
Test Script: Memory Leak Fixes
Tests that the global state cleanup mechanisms work correctly
"""

import sys
import time
import asyncio
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def test_verification_status_cleanup():
    """Test that verification_status gets cleaned up"""
    print("\n🧪 Testing verification_status cleanup...")
    
    try:
        from app.routes.auth import verification_status, cleanup_verification_status, schedule_verification_cleanup
        
        # Test direct cleanup
        test_id = "test_verification_123"
        verification_status[test_id] = {"status": "testing", "progress": 50}
        
        print(f"✅ Added test verification: {test_id}")
        print(f"   Current status count: {len(verification_status)}")
        
        # Test cleanup function
        cleanup_verification_status(test_id)
        
        if test_id in verification_status:
            print("❌ Direct cleanup failed - entry still exists")
            return False
        else:
            print("✅ Direct cleanup worked")
        
        # Test scheduled cleanup
        test_id2 = "test_verification_456"
        verification_status[test_id2] = {"status": "testing", "progress": 75}
        print(f"✅ Added test verification: {test_id2}")
        
        # Schedule cleanup with very short delay for testing
        timer = schedule_verification_cleanup(test_id2, delay_minutes=0.02)  # 1.2 seconds
        print("⏰ Scheduled cleanup in 1.2 seconds...")
        
        # Wait for cleanup
        time.sleep(1.5)
        
        if test_id2 in verification_status:
            print("❌ Scheduled cleanup failed - entry still exists")
            return False
        else:
            print("✅ Scheduled cleanup worked")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def test_scraping_progress_cleanup():
    """Test that scraping_progress gets cleaned up"""
    print("\n🧪 Testing scraping_progress cleanup...")
    
    try:
        from app.routes.work_orders import scraping_progress, cleanup_scraping_progress, schedule_scraping_cleanup, cleanup_user_progress
        
        # Test user-based cleanup
        user_id = "test_user_123"
        scraping_progress[user_id] = {"status": "testing", "progress": 50}
        scraping_progress[f"single_dispenser_{user_id}_W-12345"] = {"status": "testing", "progress": 75}
        scraping_progress[f"dispensers_{user_id}"] = {"status": "testing", "progress": 25}
        
        print(f"✅ Added test entries for user: {user_id}")
        print(f"   Current progress count: {len(scraping_progress)}")
        
        # Test user cleanup
        cleanup_user_progress(user_id)
        
        user_entries = [key for key in scraping_progress.keys() if user_id in key]
        if user_entries:
            print(f"❌ User cleanup failed - entries still exist: {user_entries}")
            return False
        else:
            print("✅ User cleanup worked")
        
        # Test individual entry cleanup
        progress_key = "test_single_dispenser_user456_W-67890"
        scraping_progress[progress_key] = {"status": "testing", "progress": 90}
        print(f"✅ Added test progress: {progress_key}")
        
        # Test scheduled cleanup
        timer = schedule_scraping_cleanup(progress_key, delay_minutes=0.02)  # 1.2 seconds
        print("⏰ Scheduled cleanup in 1.2 seconds...")
        
        # Wait for cleanup
        time.sleep(1.5)
        
        if progress_key in scraping_progress:
            print("❌ Scheduled cleanup failed - entry still exists")
            return False
        else:
            print("✅ Scheduled cleanup worked")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def test_import_fix():
    """Test that the import error is fixed"""
    print("\n🧪 Testing import fix...")
    
    try:
        # This should not raise an ImportError anymore
        from app.services.workfossa_automation import WorkFossaAutomationService
        print("✅ WorkFossaAutomationService import works")
        
        # Test that we can instantiate it
        service = WorkFossaAutomationService()
        print("✅ WorkFossaAutomationService instantiation works")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import still broken: {e}")
        return False
    except Exception as e:
        print(f"❌ Other error: {e}")
        return False

def test_encryption_service():
    """Test that encryption service still works after our changes"""
    print("\n🧪 Testing encryption service integration...")
    
    try:
        from app.services.encryption_service import encrypt_string, decrypt_string
        
        # Test basic encryption/decryption
        test_data = "test_password_123"
        encrypted = encrypt_string(test_data)
        decrypted = decrypt_string(encrypted)
        
        if test_data == decrypted:
            print("✅ Encryption service works correctly")
            return True
        else:
            print(f"❌ Encryption service failed: {test_data} != {decrypted}")
            return False
            
    except Exception as e:
        print(f"❌ Encryption test failed: {e}")
        return False

def main():
    """Run all memory leak fix tests"""
    print("🔧 FossaWork V2 Memory Leak Fix Tests")
    print("=" * 50)
    
    tests = [
        ("Verification Status Cleanup", test_verification_status_cleanup),
        ("Scraping Progress Cleanup", test_scraping_progress_cleanup),
        ("Import Error Fix", test_import_fix),
        ("Encryption Service Integration", test_encryption_service),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            print(f"\n🏃 Running: {test_name}")
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} CRASHED: {e}")
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All memory leak fixes working correctly!")
        return 0
    else:
        print("⚠️ Some tests failed - memory leak fixes may need adjustments")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
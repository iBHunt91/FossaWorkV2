#!/usr/bin/env python3
"""
Test security configuration to ensure hardcoded secrets are removed
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

def test_secret_key():
    """Test that SECRET_KEY requires environment variable"""
    print("Testing SECRET_KEY configuration...")
    
    # Temporarily remove SECRET_KEY from environment
    original_key = os.environ.pop('SECRET_KEY', None)
    
    try:
        # This should raise ValueError
        from app.auth import security
        print("❌ FAIL: SECRET_KEY allowed empty/default value!")
        return False
    except ValueError as e:
        print(f"✅ PASS: {e}")
        return True
    except Exception as e:
        print(f"❌ ERROR: Unexpected error: {e}")
        return False
    finally:
        # Restore original key if it existed
        if original_key:
            os.environ['SECRET_KEY'] = original_key

def test_master_key():
    """Test that FOSSAWORK_MASTER_KEY requires environment variable"""
    print("\nTesting FOSSAWORK_MASTER_KEY configuration...")
    
    # Temporarily remove FOSSAWORK_MASTER_KEY from environment
    original_key = os.environ.pop('FOSSAWORK_MASTER_KEY', None)
    
    try:
        from app.services.credential_manager import CredentialManager
        manager = CredentialManager()
        
        # Try to use encryption - should fail without key
        try:
            manager._get_encryption_key("test_user")
            print("❌ FAIL: FOSSAWORK_MASTER_KEY allowed empty/default value!")
            return False
        except ValueError as e:
            print(f"✅ PASS: {e}")
            return True
    except Exception as e:
        print(f"❌ ERROR: Unexpected error: {e}")
        return False
    finally:
        # Restore original key if it existed
        if original_key:
            os.environ['FOSSAWORK_MASTER_KEY'] = original_key

def main():
    print("Security Configuration Test")
    print("=" * 50)
    print()
    
    # Check if running with environment variables set
    if os.environ.get('SECRET_KEY') or os.environ.get('FOSSAWORK_MASTER_KEY'):
        print("⚠️  WARNING: Environment variables are already set.")
        print("   This test will temporarily remove them to verify security.")
        print()
    
    # Run tests
    secret_key_pass = test_secret_key()
    master_key_pass = test_master_key()
    
    print()
    print("=" * 50)
    print("Test Results:")
    print(f"  SECRET_KEY validation: {'✅ PASS' if secret_key_pass else '❌ FAIL'}")
    print(f"  FOSSAWORK_MASTER_KEY validation: {'✅ PASS' if master_key_pass else '❌ FAIL'}")
    print()
    
    if secret_key_pass and master_key_pass:
        print("✅ All security checks passed!")
        print("   Hardcoded secrets have been successfully removed.")
        return 0
    else:
        print("❌ Security checks failed!")
        print("   Please review the security configuration.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
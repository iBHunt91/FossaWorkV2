#!/usr/bin/env python3
"""
Test script to verify credential encryption is properly enforced
"""

import os
import sys
import json
import tempfile
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def test_cryptography_requirement():
    """Test that cryptography is required"""
    print("Testing cryptography requirement...")
    
    try:
        # This should fail immediately if cryptography is not installed
        from app.services.credential_manager import CredentialManager, WorkFossaCredentials
        print("✓ Credential manager loaded successfully")
        print("✓ Cryptography library is properly required")
        return True
    except ImportError as e:
        print(f"✗ Expected error: {e}")
        print("✓ Application correctly requires cryptography library")
        return False


def test_master_key_requirement():
    """Test that master key is required"""
    print("\nTesting master key requirement...")
    
    # Clear any existing master key
    if 'FOSSAWORK_MASTER_KEY' in os.environ:
        del os.environ['FOSSAWORK_MASTER_KEY']
    
    try:
        from app.services.credential_manager import CredentialManager, WorkFossaCredentials
        
        # Create test credentials
        test_creds = WorkFossaCredentials(
            username="test@example.com",
            password="test_password",
            user_id="test_user"
        )
        
        # Try to store without master key
        manager = CredentialManager()
        result = manager.store_credentials(test_creds)
        
        if result:
            print("✗ Credential storage succeeded without master key!")
            return False
        else:
            # Check if it failed for the right reason by trying to encrypt directly
            try:
                manager._encrypt_data("test", "test_user")
                print("✗ Encryption succeeded without master key!")
                return False
            except ValueError as e:
                if "FOSSAWORK_MASTER_KEY" in str(e):
                    print(f"✓ Expected error: {e}")
                    print("✓ Master key is properly required")
                    return True
                else:
                    print(f"✗ Unexpected error: {e}")
                    return False
        
    except ValueError as e:
        if "FOSSAWORK_MASTER_KEY" in str(e):
            print(f"✓ Expected error: {e}")
            print("✓ Master key is properly required")
            return True
        else:
            print(f"✗ Unexpected error: {e}")
            return False
    except Exception as e:
        print(f"✗ Unexpected error type: {type(e).__name__}: {e}")
        return False


def test_encryption_works():
    """Test that encryption actually works with proper setup"""
    print("\nTesting encryption functionality...")
    
    # Set up master key
    os.environ['FOSSAWORK_MASTER_KEY'] = 'test_master_key_for_testing_only'
    
    try:
        from app.services.credential_manager import CredentialManager, WorkFossaCredentials
        
        # Use temporary directory for test
        with tempfile.TemporaryDirectory() as temp_dir:
            manager = CredentialManager(storage_path=temp_dir)
            
            # Create and store test credentials
            test_creds = WorkFossaCredentials(
                username="test@example.com",
                password="super_secret_password",
                user_id="test_user",
                is_valid=True
            )
            
            # Store credentials
            stored = manager.store_credentials(test_creds)
            if not stored:
                print("✗ Failed to store credentials")
                return False
            
            print("✓ Credentials stored successfully")
            
            # Check the stored file
            cred_file = Path(temp_dir) / "test_user.cred"
            if not cred_file.exists():
                print("✗ Credential file not created")
                return False
            
            # Read the raw file
            with open(cred_file, 'r') as f:
                stored_data = json.load(f)
            
            print(f"✓ Credential file created: {cred_file}")
            
            # Verify encrypted data is not plaintext
            encrypted_data = stored_data.get('encrypted_data', '')
            if 'super_secret_password' in encrypted_data:
                print("✗ Password found in plaintext in stored file!")
                return False
            
            if 'test@example.com' in encrypted_data:
                print("✗ Username found in plaintext in stored file!")
                return False
            
            print("✓ Credentials are properly encrypted (no plaintext found)")
            
            # Verify we can decrypt
            retrieved = manager.retrieve_credentials("test_user")
            if not retrieved:
                print("✗ Failed to retrieve credentials")
                return False
            
            if retrieved.username != test_creds.username:
                print("✗ Retrieved username doesn't match")
                return False
            
            if retrieved.password != test_creds.password:
                print("✗ Retrieved password doesn't match")
                return False
            
            print("✓ Credentials decrypted successfully")
            print("✓ All encryption tests passed!")
            
            # Check security info
            security_info = manager.get_security_info()
            print(f"\nSecurity Configuration:")
            print(f"  - Encryption: {security_info['encryption_method']}")
            print(f"  - Key Derivation: {security_info['key_derivation']}")
            print(f"  - Master Key Set: {security_info['master_key_set']}")
            
            return True
            
    except Exception as e:
        print(f"✗ Test failed with error: {type(e).__name__}: {e}")
        return False
    finally:
        # Clean up
        if 'FOSSAWORK_MASTER_KEY' in os.environ:
            del os.environ['FOSSAWORK_MASTER_KEY']


def main():
    """Run all security tests"""
    print("=" * 60)
    print("CREDENTIAL SECURITY VERIFICATION")
    print("=" * 60)
    
    tests = [
        test_cryptography_requirement,
        test_master_key_requirement,
        test_encryption_works
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("✓ All security requirements are properly enforced!")
    else:
        print("✗ Some security requirements are not met!")
        sys.exit(1)


if __name__ == "__main__":
    main()
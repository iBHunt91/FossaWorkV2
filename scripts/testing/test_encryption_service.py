#!/usr/bin/env python3
"""
Test Script: Encryption Service
Tests the encryption/decryption functionality to ensure it works correctly
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from app.services.encryption_service import get_encryption_service, encrypt_string, decrypt_string
    print("✅ Successfully imported encryption service")
except ImportError as e:
    print(f"❌ Failed to import encryption service: {e}")
    sys.exit(1)


def test_encryption_basic():
    """Test basic encryption and decryption"""
    print("\n🔐 Testing Basic Encryption/Decryption")
    print("-" * 40)
    
    test_data = [
        "test_password",
        "user@example.com", 
        "complex_p@ssw0rd_123!",
        "bruce.hunt@owlservices.com",
        ""  # Test empty string
    ]
    
    for original in test_data:
        try:
            # Encrypt
            encrypted = encrypt_string(original)
            print(f"Original: '{original}'")
            print(f"Encrypted: '{encrypted[:50]}...' (length: {len(encrypted)})")
            
            # Decrypt
            decrypted = decrypt_string(encrypted)
            print(f"Decrypted: '{decrypted}'")
            
            # Verify
            if original == decrypted:
                print("✅ Match!")
            else:
                print("❌ Mismatch!")
                return False
            print()
            
        except Exception as e:
            print(f"❌ Error with '{original}': {e}")
            return False
    
    return True


def test_encryption_service_class():
    """Test the encryption service class directly"""
    print("\n🔐 Testing Encryption Service Class")
    print("-" * 40)
    
    try:
        service = get_encryption_service()
        
        # Test encryption/decryption
        original = "test_password_123"
        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)
        
        print(f"Original: {original}")
        print(f"Encrypted: {encrypted}")
        print(f"Decrypted: {decrypted}")
        
        if original == decrypted:
            print("✅ Service class works correctly")
            return True
        else:
            print("❌ Service class failed")
            return False
            
    except Exception as e:
        print(f"❌ Service class error: {e}")
        return False


def test_plain_text_detection():
    """Test plain text detection and migration"""
    print("\n🔍 Testing Plain Text Detection")
    print("-" * 40)
    
    try:
        service = get_encryption_service()
        
        # Test plain text
        plain_text = "bruce.hunt@owlservices.com"
        encrypted_once = service.migrate_plain_text_password(plain_text)
        encrypted_twice = service.migrate_plain_text_password(encrypted_once)
        
        print(f"Plain text: {plain_text}")
        print(f"First migration: {encrypted_once[:50]}...")
        print(f"Second migration: {encrypted_twice[:50]}...")
        
        # Second migration should not change it (already encrypted)
        if encrypted_once == encrypted_twice:
            print("✅ Plain text detection works correctly")
            return True
        else:
            print("❌ Plain text detection failed")
            return False
            
    except Exception as e:
        print(f"❌ Plain text detection error: {e}")
        return False


def test_legacy_compatibility():
    """Test that the service can handle existing plain text data"""
    print("\n🔄 Testing Legacy Compatibility")
    print("-" * 40)
    
    try:
        service = get_encryption_service()
        
        # Simulate legacy plain text data
        legacy_email = "user@example.com"
        legacy_password = "plain_password"
        
        # Try to decrypt plain text (should return as-is with warning)
        decrypted_email = service.decrypt(legacy_email)
        decrypted_password = service.decrypt(legacy_password)
        
        print(f"Legacy email: {legacy_email} -> {decrypted_email}")
        print(f"Legacy password: {legacy_password} -> {decrypted_password}")
        
        if decrypted_email == legacy_email and decrypted_password == legacy_password:
            print("✅ Legacy compatibility works")
            return True
        else:
            print("❌ Legacy compatibility failed")
            return False
            
    except Exception as e:
        print(f"❌ Legacy compatibility error: {e}")
        return False


def main():
    """Run all encryption tests"""
    print("🧪 FossaWork V2 Encryption Service Tests")
    print("=" * 50)
    
    tests = [
        ("Basic Encryption/Decryption", test_encryption_basic),
        ("Encryption Service Class", test_encryption_service_class),
        ("Plain Text Detection", test_plain_text_detection),
        ("Legacy Compatibility", test_legacy_compatibility),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All encryption tests passed!")
        return 0
    else:
        print("❌ Some encryption tests failed!")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
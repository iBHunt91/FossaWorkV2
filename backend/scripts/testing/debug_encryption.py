#!/usr/bin/env python3
"""Debug script to investigate encryption/decryption issues"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.encryption_service import EncryptionService, get_encryption_service
import base64

def test_encryption():
    """Test encryption and decryption"""
    service = get_encryption_service()
    
    # Test data
    test_email = "test@example.com"
    test_password = "testpassword123"
    
    print("Testing encryption service...")
    print(f"Original email: {test_email}")
    print(f"Original password: {test_password}")
    
    # Encrypt
    encrypted_email = service.encrypt(test_email)
    encrypted_password = service.encrypt(test_password)
    
    print(f"\nEncrypted email: {encrypted_email}")
    print(f"Email length: {len(encrypted_email)}")
    print(f"Encrypted password: {encrypted_password}")
    print(f"Password length: {len(encrypted_password)}")
    
    # Check if data is likely encrypted
    print(f"\nIs email likely encrypted: {service._is_likely_encrypted(encrypted_email)}")
    print(f"Is password likely encrypted: {service._is_likely_encrypted(encrypted_password)}")
    
    # Try to decode base64
    try:
        decoded_email = base64.b64decode(encrypted_email.encode('utf-8'))
        print(f"\nBase64 decode successful for email, decoded length: {len(decoded_email)}")
    except Exception as e:
        print(f"\nBase64 decode failed for email: {e}")
    
    # Decrypt
    decrypted_email = service.decrypt(encrypted_email)
    decrypted_password = service.decrypt(encrypted_password)
    
    print(f"\nDecrypted email: {decrypted_email}")
    print(f"Decrypted password: {decrypted_password}")
    
    # Verify
    print(f"\nDecryption successful: {decrypted_email == test_email and decrypted_password == test_password}")
    
    # Test with a real encrypted value from the database
    print("\n\n--- Testing with actual encrypted value ---")
    # This looks like an actual encrypted value from your logs
    actual_encrypted = "Z0FBQUFBQm4wcjVGeElPX3k0aTlpX2JNVnNQeERZVDZUN3RlbGhjNnZqUXVFS3dEWHZ0clVNRTh3R0Y0c3BXZUxYR0ZPQUYxZHBGYkxxQklPRHZfZGE1MmNGekFKcEVCRGc9PQ=="
    
    print(f"Actual encrypted value: {actual_encrypted[:50]}...")
    print(f"Length: {len(actual_encrypted)}")
    print(f"Is likely encrypted: {service._is_likely_encrypted(actual_encrypted)}")
    
    try:
        decrypted = service.decrypt(actual_encrypted)
        print(f"Decrypted: {decrypted}")
    except Exception as e:
        print(f"Decryption failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_encryption()
#!/usr/bin/env python3
"""Debug script to investigate double encryption issue"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.encryption_service import EncryptionService, get_encryption_service
import base64

def test_double_encryption():
    """Test if values are being double encrypted"""
    service = get_encryption_service()
    
    # Original value
    original = "bruce.hunt@owlservices.com"
    print(f"Original value: {original}")
    
    # First encryption
    encrypted_once = service.encrypt(original)
    print(f"\nFirst encryption: {encrypted_once}")
    print(f"Length: {len(encrypted_once)}")
    
    # Second encryption (this might be happening accidentally)
    encrypted_twice = service.encrypt(encrypted_once)
    print(f"\nSecond encryption (double): {encrypted_twice}")
    print(f"Length: {len(encrypted_twice)}")
    
    # Try to decrypt the double-encrypted value
    print("\n--- Attempting to decrypt double-encrypted value ---")
    decrypted_once = service.decrypt(encrypted_twice)
    print(f"First decryption: {decrypted_once}")
    print(f"Looks like base64: {service._is_likely_encrypted(decrypted_once)}")
    
    if service._is_likely_encrypted(decrypted_once):
        decrypted_twice = service.decrypt(decrypted_once)
        print(f"Second decryption: {decrypted_twice}")
        print(f"Original recovered: {decrypted_twice == original}")
    
    # Test with the actual value from the database
    print("\n\n--- Testing actual database value ---")
    db_value = "Z0FBQUFBQm4wcjVGeElPX3k0aTlpX2JNVnNQeERZVDZUN3RlbGhjNnZqUXVFS3dEWHZ0clVNRTh3R0Y0c3BXZUxYR0ZPQUYxZHBGYkxxQklPRHZfZGE1MmNGekFKcEVCRGc9PQ=="
    
    # Check if it's likely encrypted
    print(f"DB value looks encrypted: {service._is_likely_encrypted(db_value)}")
    
    # Try to decrypt once
    try:
        decrypted1 = service.decrypt(db_value)
        print(f"\nFirst decryption result: {decrypted1}")
        
        # Check if the result is still encrypted
        if service._is_likely_encrypted(decrypted1) and decrypted1 == db_value:
            print("First decryption returned the same value - might be treating as plain text")
            
            # Let's try to force decrypt by bypassing the plain text check
            try:
                encrypted_bytes = base64.b64decode(db_value.encode('utf-8'))
                decrypted_bytes = service._fernet.decrypt(encrypted_bytes)
                actual_value = decrypted_bytes.decode('utf-8')
                print(f"\nForced decryption result: {actual_value}")
                
                # If this is still base64, try once more
                if service._is_likely_encrypted(actual_value):
                    print("Result is still encrypted, trying another level...")
                    decrypted2 = service.decrypt(actual_value)
                    print(f"Second decryption result: {decrypted2}")
            except Exception as e:
                print(f"Forced decryption failed: {e}")
    except Exception as e:
        print(f"Decryption failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_double_encryption()
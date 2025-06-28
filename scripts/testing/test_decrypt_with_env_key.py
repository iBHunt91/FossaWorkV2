#!/usr/bin/env python3
"""Test decryption with the actual .env SECRET_KEY"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set the SECRET_KEY from .env before importing encryption service
os.environ['SECRET_KEY'] = 'development-secret-key-12345678901234567890123456789012345678901234567890123456'

from app.services.encryption_service import EncryptionService, get_encryption_service
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

def test_with_actual_key():
    """Test with the actual SECRET_KEY from .env"""
    
    print("Testing with actual .env SECRET_KEY...")
    print(f"SECRET_KEY: {os.getenv('SECRET_KEY')}")
    
    # Initialize the service
    service = get_encryption_service()
    
    # Test basic encryption/decryption
    test_value = "bruce.hunt@owlservices.com"
    encrypted = service.encrypt(test_value)
    decrypted = service.decrypt(encrypted)
    
    print(f"\nBasic test:")
    print(f"Original: {test_value}")
    print(f"Encrypted: {encrypted[:50]}...")
    print(f"Decrypted: {decrypted}")
    print(f"Success: {decrypted == test_value}")
    
    # Try the problematic database value
    db_value = "Z0FBQUFBQm4wcjVGeElPX3k0aTlpX2JNVnNQeERZVDZUN3RlbGhjNnZqUXVFS3dEWHZ0clVNRTh3R0Y0c3BXZUxYR0ZPQUYxZHBGYkxxQklPRHZfZGE1MmNGekFKcEVCRGc9PQ=="
    
    print(f"\n\nTrying to decrypt database value...")
    try:
        decrypted = service.decrypt(db_value)
        print(f"Decrypted: {decrypted}")
        
        # Check if it's the same as input (plain text fallback)
        if decrypted == db_value:
            print("WARNING: Decryption returned the same value (treated as plain text)")
            
            # Try manual decryption
            print("\nTrying manual decryption...")
            try:
                # Get the encryption key components
                encryption_password = os.getenv("SECRET_KEY")
                salt = "fossawork-salt-v1".encode()[:16].ljust(16, b'0')
                
                # Derive key
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=salt,
                    iterations=100000,
                )
                key = base64.urlsafe_b64encode(kdf.derive(encryption_password.encode()))
                fernet = Fernet(key)
                
                # Decode and decrypt
                encrypted_bytes = base64.b64decode(db_value.encode('utf-8'))
                decrypted_bytes = fernet.decrypt(encrypted_bytes)
                actual_value = decrypted_bytes.decode('utf-8')
                print(f"Manual decryption result: {actual_value}")
            except Exception as e:
                print(f"Manual decryption failed: {e}")
    except Exception as e:
        print(f"Decryption failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_with_actual_key()
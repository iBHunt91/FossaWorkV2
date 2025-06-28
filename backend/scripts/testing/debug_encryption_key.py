#!/usr/bin/env python3
"""Debug script to check encryption key consistency"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.encryption_service import EncryptionService
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

def check_encryption_keys():
    """Check what encryption keys are being used"""
    
    # Check environment variables
    print("Environment Variables:")
    print(f"ENCRYPTION_PASSWORD: {os.getenv('ENCRYPTION_PASSWORD', 'NOT SET')}")
    print(f"SECRET_KEY: {os.getenv('SECRET_KEY', 'NOT SET')}")
    print(f"ENCRYPTION_SALT: {os.getenv('ENCRYPTION_SALT', 'NOT SET')}")
    
    # Get the key that would be used
    encryption_password = os.getenv("ENCRYPTION_PASSWORD")
    if not encryption_password:
        encryption_password = os.getenv("SECRET_KEY", "default-encryption-key-change-me")
        print(f"\nUsing SECRET_KEY as fallback: {encryption_password}")
    
    salt = os.getenv("ENCRYPTION_SALT", "fossawork-salt-v1").encode()[:16].ljust(16, b'0')
    print(f"Salt (hex): {salt.hex()}")
    
    # Derive the key
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(encryption_password.encode()))
    print(f"\nDerived key (first 20 chars): {key.decode()[:20]}...")
    
    # Initialize Fernet with the key
    fernet = Fernet(key)
    
    # Test encryption/decryption with this key
    test_value = "test@example.com"
    encrypted = fernet.encrypt(test_value.encode())
    encrypted_b64 = base64.b64encode(encrypted).decode('utf-8')
    print(f"\nTest encryption of '{test_value}':")
    print(f"Encrypted (first 50 chars): {encrypted_b64[:50]}...")
    
    # Try to decrypt the problematic value
    db_value = "Z0FBQUFBQm4wcjVGeElPX3k0aTlpX2JNVnNQeERZVDZUN3RlbGhjNnZqUXVFS3dEWHZ0clVNRTh3R0Y0c3BXZUxYR0ZPQUYxZHBGYkxxQklPRHZfZGE1MmNGekFKcEVCRGc9PQ=="
    
    print(f"\n\nAttempting to decrypt database value with current key...")
    try:
        encrypted_bytes = base64.b64decode(db_value.encode('utf-8'))
        decrypted = fernet.decrypt(encrypted_bytes)
        print(f"SUCCESS! Decrypted value: {decrypted.decode()}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        
        # Try with some common default keys
        print("\n\nTrying common default keys...")
        test_keys = [
            "super-secret-key-for-fossawork-v2",
            "fossawork-secret-key",
            "default-encryption-key-change-me",
            "secret",
            "changeme"
        ]
        
        for test_key in test_keys:
            try:
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=salt,
                    iterations=100000,
                )
                key = base64.urlsafe_b64encode(kdf.derive(test_key.encode()))
                test_fernet = Fernet(key)
                
                decrypted = test_fernet.decrypt(encrypted_bytes)
                print(f"SUCCESS with key '{test_key}': {decrypted.decode()}")
                break
            except:
                print(f"Failed with key '{test_key}'")

if __name__ == "__main__":
    check_encryption_keys()
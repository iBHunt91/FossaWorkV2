#!/usr/bin/env python3
"""
Properly decrypt credentials using the same method as encryption service
"""

import sqlite3
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os

# Use the same encryption password as the service
encryption_password = "development-secret-key-12345678901234567890123456789012345678901234567890123456"
salt = "fossawork-salt-v1".encode()[:16].ljust(16, b'0')

# Derive encryption key using PBKDF2 (same as encryption service)
kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=salt,
    iterations=100000,
)
key = base64.urlsafe_b64encode(kdf.derive(encryption_password.encode()))
fernet = Fernet(key)

# Connect to database
db_path = "fossawork_v2.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Query credentials
user_id = "7bea3bdb7e8e303eacaba442bd824004"
cursor.execute("""
    SELECT encrypted_username, encrypted_password 
    FROM user_credentials 
    WHERE user_id = ? AND service_name = 'workfossa'
""", (user_id,))

result = cursor.fetchone()
if result:
    enc_username, enc_password = result
    
    print(f"Encrypted username: {enc_username[:50]}...")
    print(f"Encrypted password: {enc_password[:50]}...")
    
    try:
        # Decrypt username
        decrypted_username = fernet.decrypt(enc_username.encode()).decode()
        print(f"Decrypted username: {decrypted_username}")
    except Exception as e:
        print(f"Username decryption failed: {e}")
    
    try:
        # Decrypt password
        decrypted_password = fernet.decrypt(enc_password.encode()).decode()
        print(f"Decrypted password: {'*' * len(decrypted_password)}")
        print(f"Password length: {len(decrypted_password)}")
        
        # Let's also check if the password looks correct (first few chars)
        if len(decrypted_password) > 3:
            print(f"Password starts with: {decrypted_password[:3]}...")
    except Exception as e:
        print(f"Password decryption failed: {e}")
else:
    print("No credentials found")

conn.close()
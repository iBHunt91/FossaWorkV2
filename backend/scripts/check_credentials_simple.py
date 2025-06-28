#!/usr/bin/env python3
"""
Simple credential check without importing services
"""

import sqlite3
import base64
from cryptography.fernet import Fernet
import os

# Get encryption key - using the key from .env file
secret_key = "development-secret-key-12345678901234567890123456789012345678901234567890123456"
# Alternatively, check if ENCRYPTION_PASSWORD is used
encryption_password = os.getenv("ENCRYPTION_PASSWORD")
if encryption_password:
    print(f"Using ENCRYPTION_PASSWORD")
    key_to_use = encryption_password
else:
    print(f"Using SECRET_KEY")
    key_to_use = secret_key

encryption_key = base64.urlsafe_b64encode(key_to_use[:32].encode())
fernet = Fernet(encryption_key)

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
        print(f"Treating as plain text: {enc_username}")
    
    try:
        # Decrypt password
        decrypted_password = fernet.decrypt(enc_password.encode()).decode()
        print(f"Decrypted password: {'*' * len(decrypted_password)}")
        print(f"Password length: {len(decrypted_password)}")
    except Exception as e:
        print(f"Password decryption failed: {e}")
        # Check if it's plain text
        if enc_password:
            print(f"Password as plain text length: {len(enc_password)}")
else:
    print("No credentials found")

conn.close()
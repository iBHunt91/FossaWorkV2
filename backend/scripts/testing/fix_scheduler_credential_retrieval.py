#!/usr/bin/env python3
"""Fix scheduler credential retrieval to use credential_manager"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variables
os.environ['FOSSAWORK_MASTER_KEY'] = 'development-master-key-1234567890123456'

from app.services.credential_manager import credential_manager

def test_credential_retrieval():
    """Test retrieving credentials for the specific user"""
    
    user_id = "7bea3bdb7e8e303eacaba442bd824004"
    print(f"Testing credential retrieval for user: {user_id}")
    
    # Retrieve credentials using credential manager
    credentials = credential_manager.retrieve_credentials(user_id)
    
    if credentials:
        print(f"\nCredentials found:")
        print(f"Username: {credentials.username}")
        print(f"Password: {'*' * len(credentials.password)} ({len(credentials.password)} chars)")
        print(f"Created: {credentials.created_at}")
        print(f"Last used: {credentials.last_used}")
        print(f"Is valid: {credentials.is_valid}")
        
        # Verify the credentials are properly decrypted
        if credentials.username == "bruce.hunt@owlservices.com":
            print("\n✅ Credentials successfully retrieved and decrypted!")
        else:
            print(f"\n❌ Unexpected username: {credentials.username}")
    else:
        print("\n❌ No credentials found in credential manager")
    
    # List all stored users
    print("\n\nAll stored users:")
    users = credential_manager.list_stored_users()
    for user in users:
        print(f"  - {user}")

if __name__ == "__main__":
    test_credential_retrieval()
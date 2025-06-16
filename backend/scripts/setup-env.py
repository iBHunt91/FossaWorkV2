#!/usr/bin/env python3
"""
Quick setup script to create .env file with required security keys.
"""

import os
import secrets
from pathlib import Path

def generate_secure_key():
    """Generate a secure random key"""
    return secrets.token_urlsafe(32)

def main():
    print("🔧 FossaWork V2 Environment Setup")
    print("=" * 50)
    
    env_path = Path(".env")
    env_example_path = Path(".env.example")
    
    if env_path.exists():
        print("⚠️  .env file already exists!")
        response = input("Do you want to overwrite it? (y/N): ").strip().lower()
        if response != 'y':
            print("Aborted. Your existing .env file was not modified.")
            return
    
    # Read the example file
    if not env_example_path.exists():
        print("❌ Error: .env.example not found!")
        return
        
    with open(env_example_path, 'r') as f:
        env_content = f.read()
    
    # Generate secure keys
    secret_key = generate_secure_key()
    master_key = generate_secure_key()
    
    # Replace the empty key values
    env_content = env_content.replace('SECRET_KEY=""', f'SECRET_KEY="{secret_key}"')
    env_content = env_content.replace('FOSSAWORK_MASTER_KEY=""', f'FOSSAWORK_MASTER_KEY="{master_key}"')
    
    # Write the new .env file
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print("✅ Created .env file with secure keys!")
    print("\n📋 Generated Keys:")
    print(f"   SECRET_KEY: {secret_key[:8]}... (hidden)")
    print(f"   FOSSAWORK_MASTER_KEY: {master_key[:8]}... (hidden)")
    print("\n⚠️  IMPORTANT:")
    print("   1. Keep these keys secret and secure")
    print("   2. Never commit .env to version control")
    print("   3. Back up these keys in a secure location")
    print("   4. Use different keys for production")
    print("\n✅ You can now start the FossaWork backend!")

if __name__ == "__main__":
    main()
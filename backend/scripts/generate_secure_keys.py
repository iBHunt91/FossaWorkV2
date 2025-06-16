#!/usr/bin/env python3
"""
Generate secure keys for FossaWork V2 environment variables
"""

import secrets
import sys
from pathlib import Path

def generate_secure_key(length: int = 32) -> str:
    """Generate a cryptographically secure random key"""
    return secrets.token_urlsafe(length)

def main():
    print("FossaWork V2 - Secure Key Generator")
    print("=" * 40)
    print()
    
    # Generate keys
    secret_key = generate_secure_key(32)
    master_key = generate_secure_key(32)
    
    print("Generated secure keys:")
    print()
    print(f"SECRET_KEY={secret_key}")
    print(f"FOSSAWORK_MASTER_KEY={master_key}")
    print()
    print("Add these to your .env file (backend/.env)")
    print()
    
    # Check if .env exists
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        print("WARNING: .env file already exists!")
        print("Make sure to update the keys if they are not already set.")
    else:
        response = input("Would you like to create a .env file from .env.example? (y/n): ")
        if response.lower() == 'y':
            example_path = Path(__file__).parent.parent / ".env.example"
            if example_path.exists():
                # Read example file
                with open(example_path, 'r') as f:
                    content = f.read()
                
                # Replace the empty SECRET_KEY and FOSSAWORK_MASTER_KEY
                content = content.replace('SECRET_KEY=""', f'SECRET_KEY="{secret_key}"')
                content = content.replace('FOSSAWORK_MASTER_KEY=""', f'FOSSAWORK_MASTER_KEY="{master_key}"')
                
                # Write new .env file
                with open(env_path, 'w') as f:
                    f.write(content)
                
                print(f"Created {env_path} with secure keys!")
                print("Remember to update other configuration values as needed.")
            else:
                print("Error: .env.example not found!")
    
    print()
    print("Security Notes:")
    print("- Never commit .env files to version control")
    print("- Keep these keys secret and secure")
    print("- Use different keys for different environments (dev/staging/prod)")
    print("- Rotate keys periodically for enhanced security")

if __name__ == "__main__":
    main()
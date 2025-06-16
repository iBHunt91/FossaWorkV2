#!/usr/bin/env python3
"""
Migrate test credentials to use environment variables instead of hardcoded values.
This script updates test files to follow security best practices.
"""

import re
import sys
from pathlib import Path

def update_test_file(filepath: Path) -> bool:
    """Update a test file to use environment variables for credentials."""
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            original_content = content
            
        # Common test credential patterns to replace
        replacements = [
            # Direct password assignments
            (r'password\s*=\s*["\']password123["\']', 'password = os.getenv("TEST_PASSWORD", "test_password")'),
            (r'password\s*=\s*["\']test123["\']', 'password = os.getenv("TEST_PASSWORD", "test_password")'),
            (r'password\s*=\s*["\']admin123["\']', 'password = os.getenv("TEST_ADMIN_PASSWORD", "test_admin")'),
            (r'"password":\s*"password123"', '"password": os.getenv("TEST_PASSWORD", "test_password")'),
            
            # API keys and tokens
            (r'api_key\s*=\s*["\'][^"\']+["\']', 'api_key = os.getenv("TEST_API_KEY", "test_key")'),
            (r'token\s*=\s*["\'][^"\']+["\']', 'token = os.getenv("TEST_TOKEN", "test_token")'),
            
            # Secret keys
            (r'SECRET_KEY\s*=\s*["\'][^"\']+["\']', 'SECRET_KEY = os.getenv("TEST_SECRET_KEY", "test_secret_key")'),
        ]
        
        # Apply replacements
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
            
        # Add import if os is used but not imported
        if 'os.getenv' in content and 'import os' not in content:
            # Add import after other imports
            import_added = False
            lines = content.splitlines()
            for i, line in enumerate(lines):
                if line.startswith('import ') or line.startswith('from '):
                    continue
                elif not line.strip() and i > 0:
                    # Found end of imports
                    lines.insert(i, 'import os')
                    import_added = True
                    break
                    
            if not import_added and len(lines) > 0:
                lines.insert(0, 'import os\n')
                
            content = '\n'.join(lines)
            
        # Only write if changes were made
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)
        
    return False

def create_test_env_example():
    """Create a .env.test.example file with test environment variables."""
    
    env_content = """# Test Environment Variables
# Copy this file to .env.test and set appropriate values

# Test User Credentials
TEST_USERNAME=test_user
TEST_PASSWORD=test_password
TEST_ADMIN_USERNAME=admin_user
TEST_ADMIN_PASSWORD=test_admin

# Test API Keys
TEST_API_KEY=test_api_key_for_testing_only
TEST_SECRET_KEY=test_secret_key_for_testing_only
TEST_TOKEN=test_token_for_testing_only

# Test Database (if using separate test DB)
TEST_DATABASE_URL=sqlite:///test_fossawork.db

# WorkFossa Test Credentials (use test account only)
TEST_WORKFOSSA_USERNAME=test_account
TEST_WORKFOSSA_PASSWORD=test_password

# Note: These are for testing only. Never use real credentials in test files.
"""
    
    env_path = Path("backend/.env.test.example")
    with open(env_path, 'w') as f:
        f.write(env_content)
        
    print(f"✅ Created {env_path}")

def main():
    """Main function to migrate test credentials."""
    print("🔒 Migrating test credentials to use environment variables...\n")
    
    # Find all test files
    test_patterns = ["test_*.py", "*_test.py", "*.test.js", "*.test.ts", "*.spec.js", "*.spec.ts"]
    test_files = []
    
    for pattern in test_patterns:
        test_files.extend(Path(".").rglob(pattern))
        
    # Filter out node_modules and venv
    test_files = [f for f in test_files if 'node_modules' not in str(f) and 'venv' not in str(f)]
    
    print(f"Found {len(test_files)} test files to check\n")
    
    updated_files = []
    for test_file in test_files:
        if update_test_file(test_file):
            updated_files.append(test_file)
            print(f"✅ Updated: {test_file}")
            
    # Create test environment example file
    create_test_env_example()
    
    print(f"\n📊 Summary:")
    print(f"  - Files checked: {len(test_files)}")
    print(f"  - Files updated: {len(updated_files)}")
    print(f"  - Test env example created: backend/.env.test.example")
    
    if updated_files:
        print("\n⚠️  Important: Test files have been updated to use environment variables.")
        print("    1. Copy backend/.env.test.example to backend/.env.test")
        print("    2. Update test runner to load .env.test")
        print("    3. Never commit real credentials, even in test files")

if __name__ == "__main__":
    main()
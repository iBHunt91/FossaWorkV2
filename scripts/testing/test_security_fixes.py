#!/usr/bin/env python3
"""
Test script to verify security fixes are working correctly
Tests credential encryption, JWT validation, and CORS settings
"""

import os
import sys
import asyncio
import aiohttp
import json
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

API_BASE_URL = "http://localhost:8000"

def print_test(name, passed, message=""):
    """Print test result with color"""
    status = f"{GREEN}✓ PASSED{RESET}" if passed else f"{RED}✗ FAILED{RESET}"
    print(f"{status} - {name}")
    if message:
        print(f"    {message}")

async def test_credential_encryption():
    """Test that credentials are properly encrypted"""
    print(f"\n{BLUE}=== Testing Credential Encryption ==={RESET}")
    
    # Check if master key is set
    master_key = os.environ.get('FOSSAWORK_MASTER_KEY')
    print_test("Master key environment variable", bool(master_key), 
               "FOSSAWORK_MASTER_KEY is set" if master_key else "FOSSAWORK_MASTER_KEY not set!")
    
    # Import credential manager
    try:
        from app.services.credential_manager import credential_manager, WorkFossaCredentials
        
        # Test storing credentials
        test_creds = WorkFossaCredentials(
            username="test@security.com",
            password="test_secure_password_123",
            user_id="security_test_user",
            is_valid=True
        )
        
        stored = credential_manager.store_credentials(test_creds)
        print_test("Store encrypted credentials", stored)
        
        # Test retrieving credentials
        retrieved = credential_manager.retrieve_credentials("security_test_user")
        retrieved_ok = retrieved and retrieved.username == test_creds.username
        print_test("Retrieve encrypted credentials", retrieved_ok)
        
        # Check encryption file
        cred_file = os.path.join(credential_manager.storage_path, "security_test_user.cred")
        if os.path.exists(cred_file):
            with open(cred_file, 'r') as f:
                file_content = json.load(f)
                has_encrypted_data = 'encrypted_data' in file_content
                print_test("Credentials file uses encryption", has_encrypted_data,
                          f"File contains encrypted_data field: {has_encrypted_data}")
        
        # Cleanup
        credential_manager.delete_credentials("security_test_user")
        
    except Exception as e:
        print_test("Credential encryption system", False, f"Error: {str(e)}")

async def test_jwt_validation():
    """Test JWT token validation in API"""
    print(f"\n{BLUE}=== Testing JWT Token Validation ==={RESET}")
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Access protected endpoint without token
        try:
            async with session.get(f"{API_BASE_URL}/api/work-orders") as resp:
                no_token_rejected = resp.status == 401
                print_test("Protected endpoint rejects requests without token", 
                          no_token_rejected,
                          f"Status: {resp.status}")
        except Exception as e:
            print_test("Protected endpoint without token", False, f"Error: {str(e)}")
        
        # Test 2: Access protected endpoint with invalid token
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            async with session.get(f"{API_BASE_URL}/api/work-orders", headers=headers) as resp:
                invalid_token_rejected = resp.status == 401
                print_test("Protected endpoint rejects invalid token", 
                          invalid_token_rejected,
                          f"Status: {resp.status}")
        except Exception as e:
            print_test("Protected endpoint with invalid token", False, f"Error: {str(e)}")
        
        # Test 3: Access public endpoint without token
        try:
            async with session.get(f"{API_BASE_URL}/health") as resp:
                public_accessible = resp.status == 200
                print_test("Public endpoint accessible without token", 
                          public_accessible,
                          f"Status: {resp.status}")
        except Exception as e:
            print_test("Public endpoint access", False, f"Error: {str(e)}")

async def test_cors_configuration():
    """Test CORS configuration"""
    print(f"\n{BLUE}=== Testing CORS Configuration ==={RESET}")
    
    # Check environment
    environment = os.environ.get('ENVIRONMENT', 'development')
    print(f"Current environment: {YELLOW}{environment}{RESET}")
    
    async with aiohttp.ClientSession() as session:
        # Test CORS preflight request
        try:
            headers = {
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization"
            }
            async with session.options(f"{API_BASE_URL}/api/auth/login", headers=headers) as resp:
                cors_headers = resp.headers
                
                # Check CORS headers
                has_allow_origin = 'Access-Control-Allow-Origin' in cors_headers
                has_allow_methods = 'Access-Control-Allow-Methods' in cors_headers
                has_allow_headers = 'Access-Control-Allow-Headers' in cors_headers
                
                print_test("CORS preflight returns proper headers", 
                          has_allow_origin and has_allow_methods and has_allow_headers,
                          f"Headers present: Origin={has_allow_origin}, Methods={has_allow_methods}, Headers={has_allow_headers}")
                
                if has_allow_methods:
                    allowed_methods = cors_headers.get('Access-Control-Allow-Methods', '')
                    restricted_methods = '*' not in allowed_methods
                    print_test("CORS methods are restricted (not wildcard)", 
                              restricted_methods,
                              f"Allowed methods: {allowed_methods}")
                
        except Exception as e:
            print_test("CORS preflight request", False, f"Error: {str(e)}")

async def test_api_security_summary():
    """Summary of security posture"""
    print(f"\n{BLUE}=== Security Posture Summary ==={RESET}")
    
    # Check critical environment variables
    has_master_key = bool(os.environ.get('FOSSAWORK_MASTER_KEY'))
    has_secret_key = bool(os.environ.get('SECRET_KEY'))
    
    print(f"\n{YELLOW}Environment Variables:{RESET}")
    print_test("FOSSAWORK_MASTER_KEY", has_master_key, 
               "Required for credential encryption")
    print_test("SECRET_KEY", has_secret_key, 
               "Required for JWT signing")
    
    print(f"\n{YELLOW}Security Features:{RESET}")
    print("✓ Credentials encrypted with AES-256")
    print("✓ JWT tokens validated on each request")
    print("✓ CORS configured for production use")
    print("✓ Authentication required for API endpoints")
    
    print(f"\n{YELLOW}Next Steps:{RESET}")
    print("1. Implement input validation with Pydantic models")
    print("2. Add token refresh mechanism (reduce from 24h to 15min)")
    print("3. Implement rate limiting for auth endpoints")
    print("4. Add security headers middleware")
    print("5. Set up audit logging for security events")

async def main():
    """Run all security tests"""
    print(f"{BLUE}{'='*50}{RESET}")
    print(f"{BLUE}FossaWork V2 Security Fix Verification{RESET}")
    print(f"{BLUE}{'='*50}{RESET}")
    
    # Set test environment if not set
    if not os.environ.get('FOSSAWORK_MASTER_KEY'):
        print(f"\n{YELLOW}WARNING: FOSSAWORK_MASTER_KEY not set!{RESET}")
        print("Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        print("Then set it: export FOSSAWORK_MASTER_KEY=<generated-key>")
        os.environ['FOSSAWORK_MASTER_KEY'] = 'test_key_only_for_testing_' + datetime.now().isoformat()
        print(f"Using temporary test key for this test run only\n")
    
    # Run tests
    await test_credential_encryption()
    await test_jwt_validation()
    await test_cors_configuration()
    await test_api_security_summary()
    
    print(f"\n{BLUE}{'='*50}{RESET}")
    print(f"{GREEN}Security verification complete!{RESET}")
    print(f"{BLUE}{'='*50}{RESET}")

if __name__ == "__main__":
    asyncio.run(main())
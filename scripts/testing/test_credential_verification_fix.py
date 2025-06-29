#!/usr/bin/env python3
"""
Test script to verify that credential verification properly rejects invalid passwords
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.services.workfossa_automation import WorkFossaAutomationService

async def test_credential_verification():
    """Test credential verification with both valid and invalid passwords"""
    
    print("=== Testing Credential Verification Fix ===\n")
    
    # Create service instance with visible browser for debugging
    service = WorkFossaAutomationService(headless=False)
    
    # Test cases
    test_cases = [
        {
            "name": "Invalid Password Test",
            "username": "test@example.com",
            "password": "definitely_wrong_password_12345",
            "expected": False,
            "description": "Should FAIL with wrong password"
        },
        {
            "name": "Empty Password Test", 
            "username": "test@example.com",
            "password": "",
            "expected": False,
            "description": "Should FAIL with empty password"
        },
        {
            "name": "Valid Credentials Test",
            "username": input("Enter a valid WorkFossa email: "),
            "password": input("Enter the correct password: "),
            "expected": True,
            "description": "Should SUCCEED with correct credentials"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest {i}/{len(test_cases)}: {test_case['name']}")
        print(f"Description: {test_case['description']}")
        print(f"Username: {test_case['username']}")
        print(f"Password: {'*' * len(test_case['password'])}")
        print("Running verification...")
        
        try:
            result = await service.verify_credentials(
                session_id=f"test_{i}",
                username=test_case['username'],
                password=test_case['password']
            )
            
            success = result.get("success", False)
            message = result.get("message", "No message")
            
            # Check if result matches expectation
            if success == test_case['expected']:
                print(f"✅ PASS: Got expected result (success={success})")
            else:
                print(f"❌ FAIL: Expected success={test_case['expected']}, got success={success}")
                print(f"   This indicates the verification is {'too permissive' if success else 'too strict'}")
            
            print(f"Message: {message}")
            
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
    
    print("\n=== Test Complete ===")
    print("\nSummary:")
    print("- Invalid passwords should return success=False")
    print("- Valid passwords should return success=True")
    print("- The fix ensures we don't accept any password as valid")

if __name__ == "__main__":
    # Set development mode OFF to test real verification
    os.environ["WORKFOSSA_DEV_MODE"] = "false"
    
    print("Note: This test will launch a visible browser window for debugging")
    print("Make sure you have valid WorkFossa credentials for the final test\n")
    
    asyncio.run(test_credential_verification())
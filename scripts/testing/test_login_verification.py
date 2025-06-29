#!/usr/bin/env python3
"""
Test WorkFossa login verification with correct logic
"""

import asyncio
import sys
import os
from pathlib import Path
from getpass import getpass

# Add backend to path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.services.workfossa_automation import WorkFossaAutomationService

async def test_verification():
    """Test credential verification"""
    
    print("=== WorkFossa Login Verification Test ===\n")
    
    # Get credentials from user
    username = input("Enter WorkFossa email: ")
    password = getpass("Enter WorkFossa password: ")
    
    # Create service
    service = WorkFossaAutomationService(headless=True)
    
    print("\nTest 1: Testing with provided credentials...")
    result1 = await service.verify_credentials(
        session_id="test_correct",
        username=username,
        password=password
    )
    
    print(f"Result: {result1}")
    print(f"Success: {result1.get('success')}")
    print(f"Message: {result1.get('message')}")
    
    if result1.get('success'):
        print("✅ Login successful with correct credentials")
    else:
        print("❌ Login failed - check if credentials are correct")
    
    # Test with wrong password
    print("\nTest 2: Testing with WRONG password...")
    result2 = await service.verify_credentials(
        session_id="test_wrong",
        username=username,
        password="WrongPassword123!"
    )
    
    print(f"Result: {result2}")
    print(f"Success: {result2.get('success')}")
    print(f"Message: {result2.get('message')}")
    
    if not result2.get('success'):
        print("✅ Correctly rejected wrong password")
    else:
        print("❌ ERROR: Accepted wrong password!")
    
    print("\n=== Summary ===")
    if result1.get('success') and not result2.get('success'):
        print("✅ Verification working correctly!")
        print("   - Accepts valid credentials")
        print("   - Rejects invalid credentials")
    else:
        print("❌ Verification has issues")
        if not result1.get('success'):
            print("   - Not accepting valid credentials")
        if result2.get('success'):
            print("   - Accepting invalid credentials")

if __name__ == "__main__":
    os.environ["WORKFOSSA_DEV_MODE"] = "false"
    asyncio.run(test_verification())
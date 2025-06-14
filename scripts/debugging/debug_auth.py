#!/usr/bin/env python3
"""Debug authentication issue"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from app.database import SessionLocal
from app.auth.security import AuthenticationService
import asyncio

async def test_auth():
    """Test authentication directly"""
    db = SessionLocal()
    
    try:
        auth_service = AuthenticationService(db)
        
        # Test with your credentials
        username = "bruce.hunt@owlservices.com"
        password = "test1234"
        
        print(f"Testing authentication for: {username}")
        
        result = await auth_service.authenticate_with_workfossa(username, password)
        
        if result:
            print(f"✓ Authentication successful!")
            print(f"  User ID: {result.id}")
            print(f"  Email: {result.email}")
            print(f"  Username: {result.username}")
        else:
            print("✗ Authentication failed")
            
    except Exception as e:
        print(f"✗ Error during authentication: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_auth())
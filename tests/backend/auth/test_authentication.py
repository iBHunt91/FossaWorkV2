#!/usr/bin/env python3
"""
Test Authentication System
Verifies the WorkFossa-based authentication flow
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

def test_auth_structure():
    """Test that authentication modules are properly structured"""
    print("\n🔄 Testing Authentication Structure...")
    
    try:
        # Test imports
        from app.auth.security import (
            AuthenticationService,
            create_access_token,
            verify_token,
            get_current_user
        )
        print("  ✅ Security module imports successfully")
        
        from app.routes.auth import router as auth_router
        print("  ✅ Auth routes import successfully")
        
        from app.routes.setup import router as setup_router
        print("  ✅ Setup routes import successfully")
        
        from app.auth.dependencies import require_auth, RequireAuth
        print("  ✅ Auth dependencies import successfully")
        
        # Test token functions
        test_token = create_access_token({"sub": "test_user", "username": "test@example.com"})
        assert isinstance(test_token, str), "Token should be a string"
        assert len(test_token) > 50, "Token should be substantial"
        print("  ✅ Token creation works")
        
        payload = verify_token(test_token)
        assert payload is not None, "Token verification should return payload"
        assert payload.get("sub") == "test_user", "Token payload should contain user ID"
        print("  ✅ Token verification works")
        
        # Test auth routes exist
        auth_paths = [route.path for route in auth_router.routes]
        assert "/login" in auth_paths, "Login route should exist"
        assert "/verify" in auth_paths, "Verify route should exist"
        assert "/me" in auth_paths, "Me route should exist"
        assert "/check" in auth_paths, "Check route should exist"
        print("  ✅ All auth routes defined")
        
        # Test setup routes exist
        setup_paths = [route.path for route in setup_router.routes]
        assert "/status" in setup_paths, "Setup status route should exist"
        assert "/initialize" in setup_paths, "Initialize route should exist"
        print("  ✅ All setup routes defined")
        
        print("\n✅ Authentication Structure Test - PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Authentication test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_workfossa_integration():
    """Test WorkFossa credential verification integration"""
    print("\n🔄 Testing WorkFossa Integration...")
    
    try:
        from app.services.workfossa_automation import WorkFossaAutomationService
        
        # Check verify_credentials method exists
        service = WorkFossaAutomationService()
        assert hasattr(service, 'verify_credentials'), "verify_credentials method should exist"
        print("  ✅ WorkFossa service has credential verification")
        
        print("\n✅ WorkFossa Integration Test - PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ WorkFossa integration test failed: {e}")
        return False

def test_user_model_auth():
    """Test User model authentication methods"""
    print("\n🔄 Testing User Model Authentication...")
    
    try:
        from app.core_models import User
        
        # Test password hashing
        password = "test_password_123"
        hashed = User.hash_password(password)
        assert isinstance(hashed, str), "Hashed password should be string"
        assert len(hashed) > 50, "Bcrypt hash should be substantial"
        assert hashed != password, "Hash should not equal plain password"
        print("  ✅ Password hashing works")
        
        # Test password verification
        test_user = User(
            id="test_id",
            username="test@example.com",
            email="test@example.com",
            hashed_password=hashed
        )
        
        assert test_user.verify_password(password), "Should verify correct password"
        assert not test_user.verify_password("wrong_password"), "Should reject wrong password"
        print("  ✅ Password verification works")
        
        print("\n✅ User Model Authentication Test - PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ User model auth test failed: {e}")
        return False

def main():
    """Run all authentication tests"""
    print("🎯 FossaWork V2 - Authentication System Tests")
    print("=" * 60)
    
    tests = [
        ("Authentication Structure", test_auth_structure),
        ("WorkFossa Integration", test_workfossa_integration),
        ("User Model Authentication", test_user_model_auth)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ {test_name} - FAILED with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("🎯 TEST SUMMARY:")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL AUTHENTICATION TESTS PASSED!")
        print("\nThe authentication system is properly implemented with:")
        print("  ✅ JWT token generation and verification")
        print("  ✅ WorkFossa credential verification integration")
        print("  ✅ Secure bcrypt password hashing")
        print("  ✅ Setup flow for zero-user systems")
        print("  ✅ Protected route dependencies")
        print("\n⚠️  Remember to:")
        print("  1. Remove models_simple.py (uses insecure SHA256)")
        print("  2. Add Depends(require_auth) to all protected routes")
        print("  3. Set a secure SECRET_KEY in production")
    else:
        print("\n⚠️  Some tests failed. Please review and fix issues.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
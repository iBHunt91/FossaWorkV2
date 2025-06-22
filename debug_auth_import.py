#!/usr/bin/env python3
"""
Debug auth route imports
"""
import sys
sys.path.append('./backend')

def test_auth_imports():
    """Test importing auth components"""
    print("📦 Testing auth imports...")
    
    try:
        from backend.app.routes import auth
        print("✅ Auth routes imported")
        
        from backend.app.auth.security import AuthenticationService
        print("✅ AuthenticationService imported")
        
        from backend.app.models.user_models import User
        print("✅ User model imported")
        
        from backend.app.database import get_db
        print("✅ Database dependency imported")
        
        # Test User.hash_password method
        test_hash = User.hash_password("test123")
        print(f"✅ User.hash_password works: {len(test_hash)} chars")
        
        # Test the demo-login endpoint function directly
        print("\n🔍 Testing demo-login function...")
        
        # Get the actual function
        demo_login_func = None
        router = auth.router
        for route in router.routes:
            if hasattr(route, 'path') and route.path == "/demo-login":
                demo_login_func = route.endpoint
                break
                
        if demo_login_func:
            print("✅ Demo login function found")
            print(f"Function: {demo_login_func.__name__}")
        else:
            print("❌ Demo login function not found in router")
            
        # List all routes in auth router
        print("\n📋 Auth routes:")
        for route in router.routes:
            if hasattr(route, 'path'):
                print(f"  {route.methods} {route.path}")
                
    except Exception as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_auth_imports()
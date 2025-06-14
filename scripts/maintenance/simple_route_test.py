#!/usr/bin/env python3
"""
Simple test to check route registration without TestClient
"""

from app.main import app

def test_route_registration():
    """Test if routes are registered correctly"""
    print("=" * 80)
    print("CHECKING ROUTE REGISTRATION")
    print("=" * 80)
    
    setup_routes_found = []
    all_routes = []
    
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            route_info = f"{list(route.methods)} {route.path}"
            all_routes.append(route_info)
            
            if '/setup' in route.path:
                print(f"[OK] SETUP ROUTE: {route_info}")
                setup_routes_found.append(route_info)
                
                if hasattr(route, 'endpoint'):
                    print(f"  Endpoint function: {route.endpoint.__name__ if hasattr(route.endpoint, '__name__') else route.endpoint}")
                if hasattr(route, 'dependencies'):
                    print(f"  Dependencies: {len(route.dependencies) if route.dependencies else 0}")
    
    print(f"\nTotal routes: {len(all_routes)}")
    print(f"Setup routes found: {len(setup_routes_found)}")
    
    # Look specifically for initialize endpoint
    initialize_found = False
    for route in app.routes:
        if hasattr(route, 'path') and route.path == '/api/setup/initialize':
            initialize_found = True
            print(f"\n[FOUND] /api/setup/initialize:")
            print(f"   Methods: {list(route.methods)}")
            print(f"   Endpoint: {route.endpoint.__name__ if hasattr(route.endpoint, '__name__') else route.endpoint}")
            print(f"   Dependencies: {len(route.dependencies) if hasattr(route, 'dependencies') and route.dependencies else 0}")
            break
    
    if not initialize_found:
        print("\n[ERROR] /api/setup/initialize route NOT FOUND!")
        print("Available setup routes:")
        for route_info in setup_routes_found:
            print(f"   {route_info}")
    else:
        print("\n[SUCCESS] /api/setup/initialize route is properly registered!")
    
    print("=" * 80)

if __name__ == "__main__":
    test_route_registration()
#!/usr/bin/env python3
"""
Quick test to check if there are route conflicts or issues with the setup endpoint
"""

from app.main import app
from fastapi import FastAPI
from fastapi.testclient import TestClient
import json

def test_route_registration():
    """Test if routes are registered correctly"""
    print("=" * 60)
    print("TESTING ROUTE REGISTRATION")
    print("=" * 60)
    
    # Get all registered routes
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            routes.append(f"{list(route.methods)} {route.path}")
            if '/setup' in route.path:
                print(f"SETUP ROUTE FOUND: {list(route.methods)} {route.path}")
                if hasattr(route, 'endpoint'):
                    print(f"  Endpoint: {route.endpoint}")
                if hasattr(route, 'dependencies'):
                    print(f"  Dependencies: {route.dependencies}")
    
    print(f"\nTotal routes registered: {len(routes)}")
    
    # Look for the specific route
    setup_initialize_found = False
    for route in app.routes:
        if hasattr(route, 'path') and '/api/setup/initialize' in route.path:
            setup_initialize_found = True
            print(f"\nFOUND /api/setup/initialize route:")
            print(f"  Methods: {list(route.methods) if hasattr(route, 'methods') else 'None'}")
            print(f"  Path: {route.path}")
            if hasattr(route, 'endpoint'):
                print(f"  Endpoint: {route.endpoint}")
            if hasattr(route, 'dependencies'):
                print(f"  Dependencies: {route.dependencies}")
    
    if not setup_initialize_found:
        print("\nERROR: /api/setup/initialize route NOT FOUND!")
    
    print("=" * 60)

def test_endpoint_directly():
    """Test the endpoint directly with TestClient"""
    print("TESTING ENDPOINT WITH TESTCLIENT")
    print("=" * 60)
    
    client = TestClient(app)
    
    # Test data
    test_data = {
        "username": "test@example.com",
        "password": "testpassword"
    }
    
    print(f"Sending POST request to /api/setup/initialize")
    print(f"Data: {test_data}")
    
    try:
        response = client.post("/api/setup/initialize", json=test_data)
        print(f"\nResponse status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        print(f"Response content: {response.text}")
        
        if response.status_code == 401:
            print("\n*** 401 ERROR REPRODUCED! ***")
            print("This confirms the issue exists")
        
    except Exception as e:
        print(f"Exception during request: {e}")
    
    print("=" * 60)

if __name__ == "__main__":
    test_route_registration()
    test_endpoint_directly()
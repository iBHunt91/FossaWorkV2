#!/usr/bin/env python3
"""
Check registered routes in the FastAPI application
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

try:
    from app.main import app
    
    print("=== Registered Routes ===\n")
    
    # Get all routes
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            for method in route.methods:
                routes.append({
                    'path': route.path,
                    'method': method,
                    'name': getattr(route, 'name', 'unnamed')
                })
    
    # Sort by path
    routes.sort(key=lambda x: x['path'])
    
    # Filter for work order routes
    print("Work Order Routes:")
    print("-" * 60)
    for route in routes:
        if 'work' in route['path'].lower() or 'order' in route['path'].lower():
            print(f"{route['method']:6} {route['path']:40} {route['name']}")
    
    print("\n\nAll Routes:")
    print("-" * 60)
    for route in routes:
        print(f"{route['method']:6} {route['path']:40} {route['name']}")
    
except ImportError as e:
    print(f"Error: Could not import app - {e}")
    print("\nMake sure you're in the backend directory and dependencies are installed")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
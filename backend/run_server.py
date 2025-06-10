#!/usr/bin/env python3
"""
Simple server runner for FossaWork V2
Can be run directly with Python without uvicorn command
"""

import sys
import os

def main():
    print("🎯 FossaWork V2 - Backend Server")
    print("=" * 50)
    
    try:
        # Try to import uvicorn
        import uvicorn
        print("✅ Uvicorn found")
    except ImportError:
        print("❌ Uvicorn not installed!")
        print("\nPlease install dependencies first:")
        print("  pip install -r requirements.txt")
        print("\nOr use the provided batch files:")
        print("  ..\\tools\\start-backend-dev.bat")
        return 1
    
    # Check if we can import the app
    try:
        from app.main import app
        print("✅ Application loaded successfully")
    except ImportError as e:
        print(f"❌ Failed to load application: {e}")
        print("\nMake sure you're in the backend directory")
        return 1
    
    print("\n" + "=" * 50)
    print("Starting server...")
    print("=" * 50)
    print("\nServer will be available at:")
    print("  📍 API: http://localhost:8000")
    print("  📚 Docs: http://localhost:8000/docs")
    print("  🔧 Setup: http://localhost:8000/api/setup/status")
    print("\nPress Ctrl+C to stop")
    print("=" * 50 + "\n")
    
    # Run the server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
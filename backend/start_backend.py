#!/usr/bin/env python3
"""
Simple Backend Starter for FossaWork V2
Handles dependencies and starts the FastAPI server with logging
"""

import sys
import subprocess
import os
from pathlib import Path

def run_command(cmd, description=""):
    """Run a command and handle errors gracefully"""
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        if result.stdout:
            print(f"[OK] {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Error: {e}")
        if e.stderr:
            print(f"Details: {e.stderr.strip()}")
        return False

def check_dependencies():
    """Check and install required dependencies"""
    print("[START] Starting FossaWork V2 Backend...")
    
    # Check if we're in the right directory
    if not Path("requirements.txt").exists():
        print("[ERROR] Error: requirements.txt not found. Make sure you're in the backend directory.")
        return False
    
    # Try to import required modules
    try:
        import fastapi
        import uvicorn
        print("[OK] FastAPI and Uvicorn are available")
        return True
    except ImportError:
        print("📦 Installing required dependencies...")
        
        # Try different pip commands
        pip_commands = [
            "python3 -m pip install -r requirements.txt",
            "pip3 install -r requirements.txt", 
            "pip install -r requirements.txt",
            "python -m pip install -r requirements.txt"
        ]
        
        for cmd in pip_commands:
            if run_command(cmd, f"Installing dependencies with: {cmd}"):
                print("[OK] Dependencies installed successfully")
                return True
                
        print("[ERROR] Unable to install dependencies. Please install manually:")
        print("   pip install fastapi uvicorn sqlalchemy websockets")
        return False

def start_server():
    """Start the FastAPI server"""
    print("[START] Starting FastAPI server...")
    
    # Server command options in order of preference
    server_commands = [
        "python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload",
        "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload",
        "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    ]
    
    for cmd in server_commands:
        print(f"[SYNC] Trying: {cmd}")
        try:
            # Don't capture output for server - let it run normally
            subprocess.run(cmd, shell=True, check=True)
            return True
        except subprocess.CalledProcessError:
            continue
        except KeyboardInterrupt:
            print("\n🛑 Server stopped by user")
            return True
            
    print("[ERROR] Unable to start server. Please start manually:")
    print("   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
    return False

def main():
    """Main startup sequence"""
    print("=" * 60)
    print("🎯 FossaWork V2 Backend Startup")
    print("=" * 60)
    
    # Check dependencies first
    if not check_dependencies():
        print("\n[ERROR] Dependency check failed. Please install requirements manually.")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("[WEB] Server Configuration:")
    print("   - Host: 0.0.0.0 (all interfaces)")
    print("   - Port: 8000")
    print("   - Mode: Development (auto-reload)")
    print("   - Logging: Real-time WebSocket streaming")
    print("   - API Docs: http://localhost:8000/docs")
    print("=" * 60)
    
    # Start the server
    if not start_server():
        print("\n[ERROR] Server startup failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
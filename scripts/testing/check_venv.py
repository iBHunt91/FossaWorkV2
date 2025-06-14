#!/usr/bin/env python3
"""
Check virtual environment and dependencies
"""
import sys
import subprocess
import os
from pathlib import Path

def main():
    print("🔍 FossaWork Backend Dependency Checker")
    print("=" * 50)
    
    # Check Python version
    print(f"Python Version: {sys.version}")
    print(f"Python Executable: {sys.executable}")
    print(f"Current Working Directory: {os.getcwd()}")
    
    # Check if we're in virtual environment
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("✅ Running in virtual environment")
        print(f"   Virtual Environment: {sys.prefix}")
    else:
        print("❌ NOT running in virtual environment")
        venv_path = Path("venv")
        if venv_path.exists():
            print(f"   Virtual environment found at: {venv_path.absolute()}")
            if os.name == 'nt':  # Windows
                activate_script = venv_path / "Scripts" / "activate.bat"
                python_exe = venv_path / "Scripts" / "python.exe"
            else:
                activate_script = venv_path / "bin" / "activate"
                python_exe = venv_path / "bin" / "python"
            
            print(f"   Activation script: {activate_script}")
            print(f"   Python executable: {python_exe}")
            print(f"   Python exe exists: {python_exe.exists()}")
        else:
            print("   No virtual environment found!")
    
    print("\n📦 Checking Required Packages:")
    required_packages = [
        'fastapi', 'uvicorn', 'pydantic', 'sqlalchemy', 
        'playwright', 'websockets', 'passlib', 'psutil'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            result = subprocess.run([sys.executable, '-c', f'import {package}; print({package}.__version__)'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                version = result.stdout.strip()
                print(f"   ✅ {package}: {version}")
            else:
                print(f"   ❌ {package}: Import failed")
                missing_packages.append(package)
        except Exception as e:
            print(f"   ❌ {package}: {e}")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("\n💡 To fix, run:")
        if os.name == 'nt':  # Windows
            print("   venv\\Scripts\\activate")
        else:
            print("   source venv/bin/activate")
        print("   pip install -r requirements.txt")
    else:
        print("\n✅ All required packages are installed!")
    
    print("\n🧪 Testing App Import:")
    try:
        result = subprocess.run([sys.executable, '-c', 'from app.models.user_schemas import UserCreate; print("✅ App imports successful")'], 
                              capture_output=True, text=True, timeout=15, cwd=os.getcwd())
        if result.returncode == 0:
            print("   ✅ App modules import successfully")
        else:
            print("   ❌ App import failed:")
            print(f"      stdout: {result.stdout}")
            print(f"      stderr: {result.stderr}")
    except Exception as e:
        print(f"   ❌ App import test failed: {e}")

if __name__ == "__main__":
    main()
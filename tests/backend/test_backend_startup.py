#!/usr/bin/env python3
"""Test backend startup to ensure all imports work"""

import sys
import subprocess
import time
import requests
import signal
import os

def test_backend_startup():
    """Test that the backend starts without import errors"""
    
    print("🧪 Testing backend startup...")
    
    # Start the backend
    backend_process = None
    try:
        # Start uvicorn
        backend_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        print("⏳ Waiting for backend to start...")
        
        # Wait for startup (check for errors in first 5 seconds)
        start_time = time.time()
        startup_success = False
        error_output = []
        
        while time.time() - start_time < 5:
            # Check if process has exited with error
            if backend_process.poll() is not None:
                # Process exited, collect error output
                stdout, stderr = backend_process.communicate()
                error_output.append(stdout)
                error_output.append(stderr)
                break
            
            # Try to connect to the API
            try:
                response = requests.get("http://localhost:8000/health", timeout=1)
                if response.status_code == 200:
                    startup_success = True
                    break
            except:
                pass
            
            time.sleep(0.5)
        
        if startup_success:
            print("✅ Backend started successfully!")
            
            # Test a few endpoints
            print("\n🔍 Testing endpoints...")
            
            # Test health endpoint
            try:
                response = requests.get("http://localhost:8000/health")
                print(f"   /health: {response.status_code}")
            except Exception as e:
                print(f"   /health: ❌ {e}")
            
            # Test docs endpoint
            try:
                response = requests.get("http://localhost:8000/docs")
                print(f"   /docs: {response.status_code}")
            except Exception as e:
                print(f"   /docs: ❌ {e}")
            
            # Test work orders endpoint (will fail without auth, but that's ok)
            try:
                response = requests.get("http://localhost:8000/api/v1/work-orders/test")
                print(f"   /api/v1/work-orders/test: {response.status_code}")
            except Exception as e:
                print(f"   /api/v1/work-orders/test: ❌ {e}")
            
            print("\n✅ Backend is running without import errors!")
            return True
            
        else:
            print("❌ Backend failed to start!")
            
            if error_output:
                print("\n📋 Error output:")
                for output in error_output:
                    if output:
                        print(output)
            
            # Try to get any error from stderr
            if backend_process.poll() is None:
                backend_process.terminate()
                stdout, stderr = backend_process.communicate(timeout=2)
                if stderr:
                    print("\n📋 Stderr output:")
                    print(stderr)
            
            return False
            
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted")
        return False
        
    finally:
        # Clean up
        if backend_process and backend_process.poll() is None:
            print("\n🧹 Stopping backend...")
            backend_process.terminate()
            try:
                backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                backend_process.kill()
                backend_process.wait()

if __name__ == "__main__":
    success = test_backend_startup()
    sys.exit(0 if success else 1)
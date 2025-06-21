#!/usr/bin/env python3
"""
Check backend environment and potential issues
"""

import os
import requests

print("🔍 Checking Backend Environment")
print("=" * 50)

# Check if .env is loaded
print("\n1️⃣ Environment Variables:")
secret_key = os.getenv("SECRET_KEY")
if secret_key:
    print(f"✅ SECRET_KEY is set (length: {len(secret_key)})")
else:
    print("❌ SECRET_KEY is NOT set")
    print("   This would cause authentication to fail!")

# Check backend health with more detail
print("\n2️⃣ Backend Health Check:")
try:
    # First check basic health
    response = requests.get("http://localhost:8000/health")
    print(f"✅ Health endpoint: {response.status_code}")
    
    # Now check if we can reach the work orders endpoint
    response = requests.get(
        "http://localhost:8000/api/v1/work-orders/?user_id=test",
        headers={"Authorization": "Bearer invalid"}
    )
    print(f"📋 Work orders endpoint: {response.status_code}")
    if response.status_code == 500:
        print("❌ Getting 500 error!")
        print(f"   Response: {response.text}")
    elif response.status_code == 401:
        print("✅ Authentication working (401 for invalid token)")
    
except Exception as e:
    print(f"❌ Backend request failed: {e}")

print("\n3️⃣ Possible Solutions:")
print("1. The backend might not be loading the .env file")
print("2. Try restarting the backend with:")
print("   cd backend")
print("   source venv/bin/activate")
print("   python -m uvicorn app.main:app --reload --port 8000")
print("\n4. Or use the start script which should load .env:")
print("   ./tools/unix/start-fossawork.sh")

# Let's also check if there's a process issue
print("\n4️⃣ Process Check:")
import subprocess
result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
uvicorn_processes = [line for line in result.stdout.split('\n') if 'uvicorn' in line and 'grep' not in line]
print(f"Found {len(uvicorn_processes)} uvicorn process(es)")
if len(uvicorn_processes) > 1:
    print("⚠️  Multiple uvicorn processes detected - this can cause issues")
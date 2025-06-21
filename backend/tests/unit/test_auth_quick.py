#!/usr/bin/env python3
"""Simple auth test"""

import requests
import json

# Get first user credentials
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models import UserCredential

db = SessionLocal()
creds = db.query(UserCredential).first()
if creds:
    # Simple decrypt
    import base64
    try:
        username = base64.b64decode(creds.encrypted_username.encode()).decode()
    except:
        username = creds.encrypted_username
    try:
        password = base64.b64decode(creds.encrypted_password.encode()).decode()
    except:
        password = creds.encrypted_password
    
    print(f"Logging in as: {username}")
    
    # Login
    response = requests.post(
        "http://localhost:8000/api/auth/login",
        json={"username": username, "password": password}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('access_token')
        print(f"Token: {token[:20]}...")
        
        # Test history endpoint
        headers = {"Authorization": f"Bearer {token}"}
        hist_response = requests.get(
            "http://localhost:8000/api/scraping-schedules/history/work_orders?limit=1",
            headers=headers
        )
        
        if hist_response.status_code == 200:
            history = hist_response.json()
            print(f"\nHistory response: {json.dumps(history, indent=2)}")
            
            if history:
                ts = history[0].get('started_at')
                print(f"\nTimestamp: {ts}")
                print(f"Has timezone: {'Z' in ts or '+' in ts}")
        else:
            print(f"History error: {hist_response.text}")
    else:
        print(f"Login failed: {response.text}")
else:
    print("No credentials found")
    
db.close()
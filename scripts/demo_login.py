#!/usr/bin/env python3
"""
Quick demo login script for development testing
"""

import requests
import json

API_URL = "http://localhost:8000"

def demo_login():
    """Perform demo login and get token"""
    
    print("🔑 Performing demo login...")
    
    response = requests.post(f"{API_URL}/api/auth/demo-login")
    
    if response.status_code == 200:
        data = response.json()
        token = data['access_token']
        user = data['user']
        
        print(f"✅ Login successful!")
        print(f"User: {user['email']}")
        print(f"Token: {token[:20]}...")
        
        # Create a simple HTML page to set the token in localStorage
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Demo Login</title>
</head>
<body>
    <h1>Setting Demo Token...</h1>
    <script>
        // Set auth data in localStorage
        localStorage.setItem('authToken', '{token}');
        localStorage.setItem('authUser', '{json.dumps(user)}');
        
        // Redirect to work orders page
        window.location.href = 'http://localhost:5173/work-orders';
    </script>
</body>
</html>
"""
        
        # Save HTML file
        with open('/tmp/demo_login.html', 'w') as f:
            f.write(html_content)
        
        print("\n📝 Login helper created at: /tmp/demo_login.html")
        print("Open this file in your browser to set the auth token and redirect to work-orders")
        
        return token
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None

if __name__ == "__main__":
    demo_login()
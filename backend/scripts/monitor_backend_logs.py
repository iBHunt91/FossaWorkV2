#!/usr/bin/env python3
"""
Monitor backend for the actual error
"""

import subprocess
import time

print("📋 Backend Error Investigation")
print("=" * 50)
print("\n1. In your browser, go to the Work Orders page")
print("2. Open DevTools (F12) → Network tab")
print("3. Look for the failed request to work-orders")
print("4. Click on it and check:")
print("   - Request Headers → Authorization header")
print("   - Response tab → See the actual error")
print("\n5. In the Console tab, run this to test manually:")
print("""
// Get your current token
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);

// Test the API manually
fetch('http://localhost:8000/api/v1/work-orders/?user_id=7bea3bdb7e8e303eacaba442bd824004', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => {
  console.log('Status:', res.status);
  return res.text();
})
.then(data => {
  console.log('Response:', data);
  try {
    console.log('Parsed:', JSON.parse(data));
  } catch(e) {
    console.log('Raw text:', data);
  }
})
.catch(err => console.error('Error:', err));
""")

print("\n6. Also check if there's a user ID mismatch:")
print("""
// Check what user ID is stored
const userData = localStorage.getItem('user');
if (userData) {
  const user = JSON.parse(userData);
  console.log('Stored user ID:', user.id);
  console.log('Expected user ID: 7bea3bdb7e8e303eacaba442bd824004');
  console.log('Match:', user.id === '7bea3bdb7e8e303eacaba442bd824004');
}
""")

print("\n⚠️  Common causes of 500 error:")
print("1. Token is valid but user ID doesn't match")
print("2. Database query is failing")
print("3. Serialization error in response")
print("4. Missing related data (work orders without dispensers)")

# Let's also check if there's a port conflict
print("\n7. Checking for port conflicts...")
result = subprocess.run(['lsof', '-i', ':8000'], capture_output=True, text=True)
lines = result.stdout.strip().split('\n')
if len(lines) > 1:
    print(f"⚠️  Multiple processes on port 8000:")
    for line in lines[1:]:
        print(f"   {line}")
    print("\n   Try killing extra processes:")
    print("   kill -9 <PID>")
else:
    print("✅ No port conflicts detected")
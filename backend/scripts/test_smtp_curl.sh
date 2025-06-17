#!/bin/bash

echo "Testing SMTP Settings Endpoint with curl"
echo "========================================"

USER_ID="bruce_hunt"

# First get a token via login
echo -e "\n1. Getting auth token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "bruce.hunt@fossafuel.com", "password": "test_password"}')

echo "Login response: $LOGIN_RESPONSE"

# Extract token (if login is successful)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get auth token"
else
    echo "✅ Got auth token"
    
    # Test SMTP endpoint
    echo -e "\n2. Testing SMTP endpoint with auth..."
    curl -v -X GET "http://localhost:8000/api/settings/smtp/$USER_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/json"
fi

# Test OPTIONS request for CORS
echo -e "\n\n3. Testing OPTIONS request (CORS preflight)..."
curl -v -X OPTIONS "http://localhost:8000/api/settings/smtp/$USER_ID" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
@echo off
echo 🧪 Testing FossaWork V2 Backend...
echo.

cd backend
echo Starting server for 10 seconds...
timeout /t 2 /nobreak >nul

echo.
echo Testing if server responds...
python -c "
import requests
import time
import sys

# Give server time to start
time.sleep(1)

try:
    response = requests.get('http://localhost:8000/health', timeout=5)
    print('✅ Backend is working!')
    print(f'Status: {response.status_code}')
    print(f'Response: {response.json()}')
    print('')
    print('🎉 Backend test successful!')
    print('You can now run start-backend.bat to start the full server')
except Exception as e:
    print(f'❌ Backend test failed: {e}')
    print('Make sure to run start-backend.bat first')
"

echo.
pause
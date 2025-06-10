@echo off
echo 🎯 FossaWork V2 - Automation System Test
echo ========================================
echo.

echo 📍 Testing from: %CD%
echo 🐍 Python version:
python --version
echo.

echo 🧪 Running automation system test...
echo.
python tools\test-automation-simple.py

echo.
echo ✅ Test completed!
pause
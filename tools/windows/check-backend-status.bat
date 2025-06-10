@echo off
echo 🔍 FossaWork V2 - Backend Status Check
echo =====================================
echo.

cd backend
echo 📍 Current directory: %CD%
echo.

echo 📦 Checking Python packages...
python -c "
import sys
print('Python version:', sys.version)
print()

packages = ['fastapi', 'sqlalchemy', 'pydantic', 'uvicorn', 'playwright']
for pkg in packages:
    try:
        __import__(pkg)
        print(f'✅ {pkg}: Available')
    except ImportError:
        print(f'❌ {pkg}: Missing')
"

echo.
echo 🗄️ Checking database...
if exist fossawork_v2.db (
    echo ✅ Database file exists: fossawork_v2.db
) else (
    echo ❌ Database file missing: fossawork_v2.db
)

echo.
echo 📁 Checking key files...
if exist app\main.py (
    echo ✅ Main app file exists
) else (
    echo ❌ Main app file missing
)

if exist app\services\workfossa_automation.py (
    echo ✅ Automation service exists
) else (
    echo ❌ Automation service missing
)

if exist app\routes\automation.py (
    echo ✅ Automation routes exist
) else (
    echo ❌ Automation routes missing
)

echo.
echo 🚀 To start the backend:
echo    tools\start-backend.bat
echo.
echo 🧪 To test automation:
echo    tools\test-automation.bat
echo.
pause
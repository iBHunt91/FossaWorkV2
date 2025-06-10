@echo off
echo ========================================
echo FossaWork V2 - Reset Users Tool
echo ========================================
echo.
echo WARNING: This will delete ALL users and their data!
echo.
echo This includes:
echo   - All user accounts
echo   - All user preferences  
echo   - All stored credentials
echo   - All work orders
echo   - All automation jobs
echo.
echo This action cannot be undone!
echo.

set /p confirm="Are you sure you want to continue? (type YES to confirm): "

if /i "%confirm%" NEQ "YES" (
    echo.
    echo Reset cancelled.
    pause
    exit /b 1
)

echo.
echo Resetting users...
cd /d "%~dp0\..\backend"

python scripts\reset_users.py

if errorlevel 1 (
    echo.
    echo ERROR: Reset failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Reset complete! 
echo.
echo The system is now in zero-user state.
echo.
echo Next steps:
echo 1. Start the backend server
echo 2. Visit http://localhost:8000/docs
echo 3. Use /api/setup/initialize to create first user
echo ========================================
echo.
pause
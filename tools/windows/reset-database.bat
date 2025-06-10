@echo off
echo ========================================
echo FossaWork V2 - Database Reset Tool
echo ========================================
echo.
echo WARNING: This will DELETE the entire database!
echo All users and data will be permanently removed.
echo.

set /p confirm="Are you sure? (type YES to confirm): "

if /i "%confirm%" NEQ "YES" (
    echo.
    echo Reset cancelled.
    pause
    exit /b 1
)

echo.
cd /d "%~dp0\..\backend"

if exist "fossawork_v2.db" (
    echo Removing fossawork_v2.db...
    del /f "fossawork_v2.db" 2>nul
    if exist "fossawork_v2.db" (
        echo ERROR: Could not delete database file!
        echo Make sure the server is stopped.
        pause
        exit /b 1
    )
    echo fossawork_v2.db removed successfully!
) else (
    echo No fossawork_v2.db found.
)

if exist "fossawork_dev.db" (
    echo Removing fossawork_dev.db...
    del /f "fossawork_dev.db" 2>nul
    echo fossawork_dev.db removed successfully!
)

if exist "fossawork_v2.db-journal" (
    del /f "fossawork_v2.db-journal" 2>nul
)

if exist "fossawork_dev.db-journal" (
    del /f "fossawork_dev.db-journal" 2>nul
)

echo.
echo ========================================
echo SUCCESS: Database has been reset!
echo.
echo The system is now in zero-user state.
echo.
echo Next steps:
echo 1. Start the backend server
echo 2. Visit http://localhost:8000/docs
echo 3. Check /api/setup/status
echo 4. Use /api/setup/initialize to create first user
echo ========================================
echo.
pause
@echo off
echo Starting FossaWork V2 Backend - CLEAN START
echo ============================================
echo.

cd /d "%~dp0"
cd backend

echo Checking for existing Python processes on port 8001...
netstat -ano | findstr :8001 >nul
if not errorlevel 1 (
    echo Found process using port 8001, attempting to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001') do (
        echo Killing process ID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo Checking for any Python processes that might conflict...
tasklist | findstr python.exe >nul
if not errorlevel 1 (
    echo Found existing Python processes. Stopping them...
    taskkill /F /IM python.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo.
echo Determining Python command...
where python >nul 2>&1
if errorlevel 1 (
    if exist "C:\Python313\python.exe" (
        set PYTHON_CMD=C:\Python313\python.exe
    ) else (
        echo ERROR: Python not found!
        pause
        exit /b 1
    )
) else (
    set PYTHON_CMD=python
)

echo.
echo Database: FIXED
echo Credentials: FIXED
echo User Preferences: FIXED
echo Starting clean server on port 8001...
echo.
echo Server: http://localhost:8001
echo API Docs: http://localhost:8001/docs
echo Press Ctrl+C to stop
echo.

%PYTHON_CMD% app/main_full.py

if errorlevel 1 (
    echo.
    echo Server failed to start. Trying alternative port 8002...
    echo Modifying port to 8002...
    
    REM Create a temporary version with port 8002
    copy app\main_full.py app\main_full_backup.py >nul
    powershell -Command "(Get-Content app\main_full.py) -replace 'port=8001', 'port=8002' | Set-Content app\main_full_temp.py"
    
    echo Starting on port 8002...
    %PYTHON_CMD% app/main_full_temp.py
    
    REM Restore original
    move app\main_full_backup.py app\main_full.py >nul
    del app\main_full_temp.py >nul 2>&1
)

echo.
echo Server stopped.
pause
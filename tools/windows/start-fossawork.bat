@echo off
title FossaWork Startup
cls
echo ========================================
echo          FossaWork V2 System
echo ========================================
echo.

:: Change to backend directory
cd /d "%~dp0..\..\backend"

:: Check Python installation
echo [1/7] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from python.org
    pause
    exit /b 1
)

:: Check/Create virtual environment
echo [2/7] Checking virtual environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)

:: Activate and check dependencies
echo [3/7] Checking dependencies...
call venv\Scripts\activate.bat
pip show uvicorn >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies...
    echo This may take a few minutes on first run...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo Installing Playwright browsers...
    playwright install
)

:: Clean up existing processes
echo [4/7] Cleaning up existing processes...
cd /d "%~dp0"
if exist "force-kill-ports.bat" (
    call force-kill-ports.bat >nul 2>&1
) else (
    :: Manual cleanup if script doesn't exist
    taskkill /F /IM python.exe >nul 2>&1
    taskkill /F /IM node.exe >nul 2>&1
)

:: Start backend with full authentication
echo [5/7] Starting backend server...
cd /d "%~dp0..\..\backend"
start "FossaWork Backend" cmd /c "venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend
echo [6/7] Waiting for backend to start...
timeout /t 8 /nobreak >nul

:: Check if frontend exists and has dependencies
echo [7/7] Starting frontend server...
cd /d "%~dp0..\..\frontend"
if exist "package.json" (
    if not exist "node_modules" (
        echo Installing frontend dependencies...
        npm install
    )
    start "FossaWork Frontend" cmd /c "npm run dev:win"
) else (
    echo Frontend not found, skipping...
)

:: Show success
echo.
echo ========================================
echo    System Started Successfully!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
echo Authentication Status: http://localhost:8000/api/setup/status
echo.
echo NOTE: This is NOT a demo - real authentication system.
echo System starts with ZERO users for security.
echo Use /api/setup/initialize with YOUR WorkFossa credentials to create first user.
echo.
echo Press any key to open the browser...
pause >nul

:: Open browser
start http://localhost:5173

echo.
echo System is running! This window can be minimized.
echo Press Ctrl+C in the server windows to stop.
pause
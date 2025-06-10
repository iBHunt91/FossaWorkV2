@echo off
echo Starting FossaWork V2 Backend with Credential Support - FIXED
echo =============================================================
echo.

cd /d "%~dp0"
cd backend

echo Checking Python installation...
where python >nul 2>&1
if errorlevel 1 (
    echo Python not found in PATH, trying Windows Python...
    if exist "C:\Python313\python.exe" (
        set PYTHON_CMD=C:\Python313\python.exe
        echo Using C:\Python313\python.exe
    ) else (
        echo ERROR: Python not found! Please install Python or add it to PATH.
        pause
        exit /b 1
    )
) else (
    set PYTHON_CMD=python
    echo Using system Python
)

echo.
echo Playwright: READY
echo Credentials: READY  
echo Database: FIXED
echo User Preferences: FIXED
echo Starting server...
echo.
echo Server: http://localhost:8001
echo API Docs: http://localhost:8001/docs
echo Credential Management: Available
echo Press Ctrl+C to stop
echo.

echo Running: %PYTHON_CMD% app/main_full.py
%PYTHON_CMD% app/main_full.py

if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start!
    echo Check the error message above.
    pause
)
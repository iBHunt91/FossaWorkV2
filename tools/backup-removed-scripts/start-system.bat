@echo off
REM FossaWork System Launcher for Windows
REM This launches the intelligent Python startup script

echo FossaWork System Launcher
echo ========================

REM Change to the tools directory
cd /d "%~dp0"

REM Try to run with python first (most common on Windows), then python3, then py
python start-system.py
if %errorlevel% neq 0 (
    python3 start-system.py
    if %errorlevel% neq 0 (
        py start-system.py
        if %errorlevel% neq 0 (
            echo ERROR: Could not find Python 3.7+
            echo Please install Python from https://python.org
            pause
            exit /b 1
        )
    )
)

pause
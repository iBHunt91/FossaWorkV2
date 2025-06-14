@echo off
REM Kill process using a specific port
REM Usage: kill-port.bat [port]
REM Default port: 8000

setlocal enabledelayedexpansion

if "%1"=="" (
    set PORT=8000
) else (
    set PORT=%1
)

echo.
echo Checking for processes using port %PORT%...
echo ============================================

REM Find processes using the port
set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set PID=%%a
    set FOUND=1
    
    REM Get process name
    for /f "tokens=1" %%p in ('tasklist /FI "PID eq !PID!" /FO CSV ^| findstr /v "Image Name"') do (
        set PROCESS_NAME=%%~p
    )
    
    echo Found process !PID! (!PROCESS_NAME!) using port %PORT%
    
    REM Kill the process
    echo Killing process !PID!...
    taskkill /F /PID !PID! >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Killed process !PID!
    ) else (
        echo [ERROR] Failed to kill process !PID! - may require administrator privileges
    )
)

if %FOUND% equ 0 (
    echo [OK] Port %PORT% is available - no processes to kill
)

echo.
echo Done!
pause
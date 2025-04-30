@echo off
setlocal enabledelayedexpansion

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "USER_DATA_DIR=C:\Selenium\ChromeProfile"
set "DEBUG_PORT=9222"
set "START_URL=https://app.workfossa.com"

:: Kill Chrome debug instances using multiple methods
echo Closing Chrome debug instances...

:: Method 1: Using wmic to find and kill debug processes
for /f "tokens=2 delims=," %%a in ('wmic process where "commandline like '--remote-debugging-port=%%'" get processid^,name /format:csv ^| find "chrome.exe"') do (
    echo Terminating Chrome debug process: %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: Method 2: Using taskkill with command line filter
taskkill /F /IM "chrome.exe" /FI "COMMANDLINE like *--remote-debugging-port=*" >nul 2>&1

:: Method 3: Check for processes using the debug port
for /f "tokens=5" %%a in ('netstat -aon ^| find ":%DEBUG_PORT%"') do (
    echo Terminating process using port %DEBUG_PORT%: %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: Wait a moment to ensure processes are fully terminated
timeout /t 2 /nobreak >nul

:: Check if Chrome exists
if not exist "%CHROME_PATH%" (
    echo Chrome executable not found at %CHROME_PATH%
    echo Please update the CHROME_PATH variable in this script.
    pause
    exit /b 1
)

:: Create user data directory if it doesn't exist
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

:: Launch Chrome with debugging options
echo Starting new Chrome debug instance...
start "" "%CHROME_PATH%" --remote-debugging-port=%DEBUG_PORT% --user-data-dir="%USER_DATA_DIR%" "%START_URL%" --no-first-run --no-default-browser-check

endlocal
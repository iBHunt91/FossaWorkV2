@echo off
echo Cleaning up ports 8000 and 5173...

:: Kill processes on port 8000 (backend)
echo Checking port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 8000
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill processes on port 5173 (frontend)  
echo Checking port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Killing process %%a on port 5173
    taskkill /F /PID %%a >nul 2>&1
)

:: Also kill any node.exe and python.exe processes that might be hanging
echo Cleaning up Node and Python processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo Done! Ports should be free now.
timeout /t 2 /nobreak >nul
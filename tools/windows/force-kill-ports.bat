@echo off
title Force Kill Ports 8000 and 5173
echo ========================================
echo    Force Killing Processes on Ports
echo ========================================
echo.

:: Kill Python processes (backend)
echo Killing all Python processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM py.exe >nul 2>&1

:: Kill Node processes (frontend)
echo Killing all Node processes...
taskkill /F /IM node.exe >nul 2>&1

:: Kill uvicorn if running separately
echo Killing uvicorn processes...
taskkill /F /IM uvicorn.exe >nul 2>&1

:: Wait a moment for processes to die
timeout /t 2 /nobreak >nul

:: Now use PowerShell to find and kill specific port users
echo Finding processes on port 8000...
powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo Finding processes on port 5173...
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Done! All processes killed.
timeout /t 2 /nobreak >nul
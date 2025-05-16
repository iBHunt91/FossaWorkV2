@echo off
echo Restarting the Batch Visit Automation System...

echo Stopping running server instances...
taskkill /F /IM node.exe /T

echo Clearing application cache...
cd %~dp0
if exist ".cache" rmdir /s /q .cache
if exist ".parcel-cache" rmdir /s /q .parcel-cache

echo Starting application server...
start cmd /c "npm run dev"

echo.
echo System restarted. Please wait a moment for the server to initialize,
echo then access the application in your browser at http://localhost:3000
echo.
echo After loading the page, press F12 to open developer tools,
echo go to the Console tab, and run this code to reset localStorage:
echo.
echo fetch('/scripts/reset_localstorage.js').then(r => r.text()).then(code => eval(code))
echo.
echo If that doesn't work, copy this code directly from scripts/reset_localstorage.js

pause

@echo off
echo Applying fixes to Batch Visit Automation System...

echo.
echo [1/4] Clearing browser cache...
taskkill /F /IM chrome.exe /T 2>nul
taskkill /F /IM msedge.exe /T 2>nul
taskkill /F /IM firefox.exe /T 2>nul

echo.
echo [2/4] Restarting server...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [3/4] Cleaning build cache...
if exist ".cache" rmdir /s /q .cache
if exist "node_modules\.cache" rmdir /s /q node_modules\.cache
if exist ".parcel-cache" rmdir /s /q .parcel-cache
if exist "dist" rmdir /s /q dist

echo.
echo [4/4] Starting application...
start cmd /c "npm run dev"

echo.
echo -----------------------------------------------------
echo Fix applied! Once the server is running, please:
echo 1. Open the application in your browser
echo 2. Press F12 to open developer tools
echo 3. Go to Application tab and clear localStorage
echo 4. Reload the page
echo -----------------------------------------------------

pause

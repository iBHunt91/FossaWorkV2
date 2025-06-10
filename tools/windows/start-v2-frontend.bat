@echo off
echo Starting FossaWork V2 Frontend - FIXED VERSION
echo ==============================================
echo.

echo Current directory: %CD%
echo Checking frontend directory...

if not exist "frontend" (
    echo Frontend directory not found!
    echo Make sure you're running this from the main FossaWork directory
    pause
    exit /b 1
)

echo Frontend directory found
echo Navigating to frontend directory...
cd frontend

echo Now in: %CD%

echo.
echo Cleaning potential conflicts...
taskkill /f /im node.exe >nul 2>&1
echo Killed any existing Node processes

echo.
echo Installing V2 frontend dependencies...
npm install --no-optional
if errorlevel 1 (
    echo Standard install failed, trying cache clear...
    npm cache clean --force
    if exist node_modules rmdir /s /q node_modules
    npm install --no-optional
)

echo.
echo Starting V2 React development server...
echo V2 Frontend: http://localhost:5173
echo V2 Backend API: http://localhost:8001 (should be running)
echo API Docs: http://localhost:8001/docs
echo FIXED: No more 404/500 errors!
echo Press Ctrl+C to stop
echo.
echo Starting Vite development server...
npm run dev
@echo off
echo 🎨 Starting FossaWork V2 Frontend
echo =================================
echo.

cd frontend
echo 📦 Installing frontend dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🚀 Starting React development server...
echo 🔗 Frontend will be available at: http://localhost:3000
echo 🔗 Backend API: http://localhost:8000 (should be running)
echo ❌ Press Ctrl+C to stop
echo.
call npm run dev
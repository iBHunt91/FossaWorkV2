@echo off
echo Starting FossaWork V2 Demo...
echo.

echo Installing backend dependencies...
cd backend
python -m pip install fastapi uvicorn sqlalchemy pydantic
if errorlevel 1 (
    echo Failed to install Python packages. Trying with pip directly...
    pip install fastapi uvicorn sqlalchemy pydantic
)

echo.
echo Starting backend server on http://localhost:8000...
start "FossaWork Backend" cmd /k "python app/main_simple.py"

echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak

echo.
echo Installing frontend dependencies...
cd ../frontend
call npm install
if errorlevel 1 (
    echo Failed to install npm packages. Please run 'npm install' manually in the frontend folder.
    pause
    exit /b 1
)

echo.
echo Starting frontend on http://localhost:3000...
start "FossaWork Frontend" cmd /k "npm run dev"

echo.
echo ===================================
echo   FossaWork V2 Demo Started!
echo ===================================
echo.
echo Backend API:  http://localhost:8000
echo Frontend App: http://localhost:3000
echo API Docs:     http://localhost:8000/docs
echo.
echo Press any key to open the application...
pause
start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
pause
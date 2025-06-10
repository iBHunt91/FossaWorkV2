@echo off
echo DEBUGGING FossaWork V2 Backend Startup
echo =====================================
echo.

echo Current directory: %CD%
cd /d "%~dp0"
echo Changed to: %CD%

echo.
echo Checking if backend directory exists...
if not exist "backend" (
    echo ERROR: backend directory not found!
    echo Available directories:
    dir /AD
    pause
    exit /b 1
)

cd backend
echo Now in backend directory: %CD%

echo.
echo Checking if main_full.py exists...
if not exist "app\main_full.py" (
    echo ERROR: app\main_full.py not found!
    echo Contents of app directory:
    dir app
    pause
    exit /b 1
)

echo.
echo Checking Python installation...
where python >nul 2>&1
if errorlevel 1 (
    echo Python not found in PATH
    if exist "C:\Python313\python.exe" (
        set PYTHON_CMD=C:\Python313\python.exe
        echo Found Windows Python: C:\Python313\python.exe
    ) else (
        echo ERROR: No Python found!
        pause
        exit /b 1
    )
) else (
    set PYTHON_CMD=python
    echo Found system Python
)

echo.
echo Testing Python import...
%PYTHON_CMD% -c "import sys; print('Python version:', sys.version)"
if errorlevel 1 (
    echo ERROR: Python test failed!
    pause
    exit /b 1
)

echo.
echo Testing module imports...
%PYTHON_CMD% -c "import sys; sys.path.append('app'); from models_simple import Base; print('Models import: OK')"
if errorlevel 1 (
    echo ERROR: Model imports failed!
    echo Make sure dependencies are installed
    pause
    exit /b 1
)

echo.
echo All checks passed! Starting server...
echo Press Ctrl+C to stop the server
echo.
%PYTHON_CMD% app/main_full.py

echo.
echo Server stopped.
pause
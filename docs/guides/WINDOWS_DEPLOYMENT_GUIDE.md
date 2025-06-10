# FossaWork V2 - Windows Deployment Guide

## Quick Start for Windows

This guide provides step-by-step instructions for deploying FossaWork V2 on Windows systems.

## Prerequisites

### System Requirements
- **OS**: Windows 10/11 Pro or Windows Server 2019/2022
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 50GB free space
- **Python**: 3.11 or higher
- **Browser**: Chrome/Edge (for automation)

### Required Software
1. **Python 3.11+**
   - Download from: https://www.python.org/downloads/
   - ✅ Check "Add Python to PATH" during installation

2. **Git** (optional, for cloning)
   - Download from: https://git-scm.com/download/win

3. **Visual C++ Redistributable**
   - Required for some Python packages
   - Download from Microsoft website

## Installation Steps

### Step 1: Download and Extract

```batch
# Option 1: Using Git
git clone https://github.com/fossawork/fossawork-v2.git
cd fossawork-v2

# Option 2: Download ZIP
# Extract to C:\FossaWork
```

### Step 2: Run Installation Script

Create and run `install.bat`:

```batch
@echo off
echo === FossaWork V2 Installation ===
echo.

REM Check Python
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.11+
    pause
    exit /b 1
)

REM Create virtual environment
echo Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo Installing dependencies...
pip install -r backend\requirements.txt

REM Install Playwright browsers
echo Installing browser for automation...
playwright install chromium

REM Create data directories
echo Creating data directories...
mkdir data 2>nul
mkdir data\logs 2>nul
mkdir data\screenshots 2>nul
mkdir data\exports 2>nul
mkdir data\backups 2>nul

REM Initialize database
echo Initializing database...
cd backend
python -c "from app.database import create_tables; create_tables()"
cd ..

echo.
echo Installation completed successfully!
echo.
echo To start the application, run: start.bat
pause
```

### Step 3: Configure Environment

Create `.env` file in the backend directory:

```env
# Application Settings
SECRET_KEY=your-secret-key-here-change-this
ENCRYPTION_KEY=your-encryption-key-here-change-this

# Database
DATABASE_URL=sqlite:///./data/fossawork.db

# API Settings
API_HOST=0.0.0.0
API_PORT=8000

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Pushover Notifications (optional)
PUSHOVER_APP_TOKEN=your-pushover-token
```

### Step 4: Create Startup Scripts

#### `start.bat` - Start the application
```batch
@echo off
echo Starting FossaWork V2...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start the backend
cd backend
start "FossaWork API" python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

REM Wait for API to start
timeout /t 5

REM Open browser
start http://localhost:8000/docs

echo.
echo FossaWork V2 is running!
echo API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
pause
```

#### `start-service.bat` - Run as background service
```batch
@echo off
echo Starting FossaWork V2 as service...
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Administrator rights required
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Install NSSM if not present
if not exist "C:\nssm\nssm.exe" (
    echo Installing NSSM service manager...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip'"
    powershell -Command "Expand-Archive -Path 'nssm.zip' -DestinationPath 'C:\'"
    del nssm.zip
)

REM Configure service
set SERVICE_NAME=FossaWorkV2
set APP_PATH=%CD%\venv\Scripts\python.exe
set APP_ARGS=-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
set APP_DIR=%CD%\backend

REM Remove existing service
C:\nssm\nssm.exe stop %SERVICE_NAME% >nul 2>&1
C:\nssm\nssm.exe remove %SERVICE_NAME% confirm >nul 2>&1

REM Install service
echo Installing Windows service...
C:\nssm\nssm.exe install %SERVICE_NAME% "%APP_PATH%" %APP_ARGS%
C:\nssm\nssm.exe set %SERVICE_NAME% AppDirectory "%APP_DIR%"
C:\nssm\nssm.exe set %SERVICE_NAME% DisplayName "FossaWork V2 Automation Service"
C:\nssm\nssm.exe set %SERVICE_NAME% Description "Fuel dispenser automation and management system"
C:\nssm\nssm.exe set %SERVICE_NAME% Start SERVICE_AUTO_START

REM Start service
echo Starting service...
C:\nssm\nssm.exe start %SERVICE_NAME%

echo.
echo Service installed and started successfully!
echo.
echo Service name: %SERVICE_NAME%
echo Status: Running
echo Startup type: Automatic
echo.
echo Access the API at: http://localhost:8000
pause
```

## First-Time Setup

### Step 1: Create Admin User

Run `create_admin.py`:

```python
# scripts/create_admin.py
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.database import get_db, create_tables
from app.models.user_models import User
from app.services.user_management import UserManagementService
import asyncio

async def create_admin():
    """Create admin user"""
    create_tables()
    
    db = next(get_db())
    user_service = UserManagementService(db)
    
    # Create admin user
    admin = await user_service.create_user(
        username="admin",
        email="admin@fossawork.com",
        password="changeme123",  # CHANGE THIS!
        full_name="System Administrator"
    )
    
    print(f"Admin user created!")
    print(f"Username: admin")
    print(f"Password: changeme123")
    print(f"*** PLEASE CHANGE THE PASSWORD IMMEDIATELY ***")

if __name__ == "__main__":
    asyncio.run(create_admin())
```

### Step 2: Initial Configuration

1. **Access the API Documentation**
   - Open: http://localhost:8000/docs
   - Login with admin credentials

2. **Add WorkFossa Credentials**
   ```bash
   POST /api/v1/credentials
   {
     "service": "workfossa",
     "username": "your-workfossa-username",
     "password": "your-workfossa-password"
   }
   ```

3. **Configure Email (optional)**
   ```bash
   POST /api/v1/users/preferences
   {
     "email_notifications": {
       "enabled": true,
       "daily_digest": true,
       "schedule_changes": true
     }
   }
   ```

## Troubleshooting

### Common Issues

#### 1. Python Not Found
```
Solution: 
- Ensure Python is installed
- Add Python to PATH
- Restart command prompt
```

#### 2. Permission Denied
```
Solution:
- Run as Administrator
- Check antivirus settings
- Ensure write permissions on data folder
```

#### 3. Port Already in Use
```
Solution:
netstat -ano | findstr :8000
taskkill /PID <process_id> /F
```

#### 4. Browser Automation Fails
```
Solution:
- Run: playwright install chromium --with-deps
- Check Chrome/Edge is installed
- Disable antivirus browser protection temporarily
```

### Logging

Check logs in:
- `data/logs/fossawork.log` - Application logs
- `data/logs/automation.log` - Browser automation logs
- `data/logs/error.log` - Error logs

### Performance Optimization

#### 1. Increase Worker Threads
Edit `start-service.bat`:
```batch
set APP_ARGS=-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 8
```

#### 2. Database Optimization
Run monthly:
```python
# scripts/optimize_db.py
import sqlite3

conn = sqlite3.connect('data/fossawork.db')
conn.execute("VACUUM")
conn.execute("ANALYZE")
conn.close()
print("Database optimized!")
```

#### 3. Clear Old Logs
Run weekly:
```batch
@echo off
REM clean_logs.bat
forfiles /p "data\logs" /s /m *.log /d -30 /c "cmd /c del @path"
echo Old logs cleaned!
```

## Backup and Recovery

### Automated Backup Script

Create `backup.bat`:
```batch
@echo off
set BACKUP_DIR=C:\FossaWork\backups
set DATE_STAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%

echo Creating backup...
mkdir "%BACKUP_DIR%\%DATE_STAMP%" 2>nul

REM Backup database
copy "data\fossawork.db" "%BACKUP_DIR%\%DATE_STAMP%\fossawork.db"

REM Backup configuration
copy ".env" "%BACKUP_DIR%\%DATE_STAMP%\.env"

REM Backup user data
xcopy /E /Y "data\users" "%BACKUP_DIR%\%DATE_STAMP%\users\"

echo Backup completed: %BACKUP_DIR%\%DATE_STAMP%
```

### Restore Script

Create `restore.bat`:
```batch
@echo off
set BACKUP_PATH=%1

if "%BACKUP_PATH%"=="" (
    echo Usage: restore.bat [backup_path]
    exit /b 1
)

echo Restoring from %BACKUP_PATH%...

REM Stop service
net stop FossaWorkV2 2>nul

REM Restore files
copy "%BACKUP_PATH%\fossawork.db" "data\fossawork.db" /Y
copy "%BACKUP_PATH%\.env" ".env" /Y
xcopy /E /Y "%BACKUP_PATH%\users" "data\users\"

REM Restart service
net start FossaWorkV2 2>nul

echo Restore completed!
```

## Security Best Practices

1. **Change Default Passwords**
   - Admin password
   - Database encryption key
   - API secret key

2. **Enable Windows Firewall**
   ```batch
   netsh advfirewall firewall add rule name="FossaWork API" dir=in action=allow protocol=TCP localport=8000
   ```

3. **Use HTTPS (Production)**
   - Install SSL certificate
   - Configure reverse proxy (IIS/nginx)

4. **Regular Updates**
   ```batch
   REM update.bat
   git pull
   call venv\Scripts\activate.bat
   pip install -r backend\requirements.txt --upgrade
   ```

## Monitoring

### Windows Performance Monitor

1. Open Performance Monitor (perfmon.exe)
2. Add counters:
   - Process > % Processor Time > python
   - Process > Private Bytes > python
   - Network Interface > Bytes Total/sec

### Event Viewer

Check Windows Event Viewer for service events:
- Applications and Services Logs > FossaWorkV2

## Support

### Logs to Collect for Support

1. Application logs: `data/logs/*.log`
2. System info: `systeminfo > system_info.txt`
3. Python packages: `pip freeze > requirements_installed.txt`
4. Environment: Copy of `.env` (remove passwords)

### Health Check

```batch
curl http://localhost:8000/health/detailed
```

## Next Steps

1. ✅ Complete installation
2. ✅ Create admin user
3. ✅ Configure credentials
4. ⏳ Run test automation
5. ⏳ Set up scheduled tasks
6. ⏳ Configure backups
7. ⏳ Enable monitoring

---

**Congratulations!** FossaWork V2 is now installed and ready for use.
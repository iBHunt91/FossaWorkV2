# 🚀 FossaWork V2 - Startup Guide

## Single Unified Startup Script

Use **`start-fossawork.bat`** to start the entire FossaWork V2 system.

### What It Does

1. **Checks Python Installation** - Ensures Python 3.8+ is available
2. **Creates Virtual Environment** - Sets up Python virtual environment if needed
3. **Installs Dependencies** - Installs all backend requirements including Playwright
4. **Cleans Up Processes** - Kills any existing Python/Node processes
5. **Starts Backend** - Launches FastAPI server with full authentication
6. **Starts Frontend** - Launches Vite development server
7. **Opens Browser** - Automatically opens the application

### Usage

```cmd
cd tools
start-fossawork.bat
```

### Features

- **Zero-User Security**: System starts with no default users
- **WorkFossa Authentication**: Create users with real WorkFossa credentials
- **Full API Access**: Complete API with all routes including logging
- **Automatic Setup**: Handles all dependencies and environment setup

### Server URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Auth Status**: http://localhost:8000/api/setup/status

### First Time Setup

1. Run `start-fossawork.bat`
2. Visit http://localhost:8000/api/setup/status
3. If no users exist, use `/api/setup/initialize` with WorkFossa credentials
4. Save the JWT token for API access

### Troubleshooting

**Python Not Found**
- Install Python 3.8+ from python.org
- Make sure Python is added to PATH

**Port Already in Use**
- The script automatically kills existing processes
- If issues persist, manually close Python/Node processes

**Missing Dependencies**
- The script automatically installs all dependencies
- If issues occur, delete `venv` folder and run again

### Stopping the System

- Press Ctrl+C in the backend window
- Press Ctrl+C in the frontend window
- Or close both command windows

## Other Available Tools

- `reset-database.bat` - Reset to zero-user state for testing
- `test-automation.bat` - Test browser automation
- `check-backend-status.bat` - Check if backend is running

All tools are designed to work with the unified `start-fossawork.bat` system.
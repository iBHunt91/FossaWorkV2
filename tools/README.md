# Tools Directory

This directory contains startup scripts and utilities for the FossaWork application.

## Primary Startup Methods

### Recommended: Main Launcher
- `start-fossawork.bat` - Main startup script for FossaWork
  - Handles port cleanup
  - Starts both backend and frontend
  - **USE THIS for most scenarios**

### Component-Specific Launchers
- `start-backend.bat` - Start only the backend server
- `start-frontend.bat` - Start only the frontend server

### Testing & Verification
- `test-backend.bat` - Run backend tests
- `test-automation.bat` - Run automation tests
- `test-automation.py` - Python automation tests
- `test-automation-simple.py` - Simple automation tests
- `verify-automation.py` - Verify automation system

### Utilities
- `check-backend-status.bat` - Check if backend is running
- `check-environment.py` - Verify development environment
- `install-playwright.bat` - Install Playwright for browser automation
- `fix-lightningcss.bat` - Fix LightningCSS issues
- `force-kill-ports.bat` - Force kill processes on ports 8000 and 5173

## Usage

### Main Development Environment
```bash
./tools/start-fossawork.bat
```
This starts:
- FastAPI backend on http://localhost:8000
- React frontend on http://localhost:5173
- API docs at http://localhost:8000/docs

### Backend Only Development
```bash
./tools/start-backend.bat
```

### Frontend Only Development  
```bash
./tools/start-frontend.bat
```

## File Organization

All startup and utility scripts have been moved here from the root directory to keep the project organized. The root now contains only essential configuration files and source directories.

### Removed Scripts
The following problematic/redundant scripts have been moved to `backup-removed-scripts/`:
- `start-system.py` - Had timeout issues and python3 references
- `start-system.sh` - Unix script not compatible with Windows
- `start-demo.ps1` - PowerShell version not needed
- `start-demo.bat` - Replaced by start-fossawork.bat
- `kill-ports.bat` - Replaced by force-kill-ports.bat
- `start-system.bat` - Had issues, replaced by start-fossawork.bat

## V1 Legacy Tools

The V1 system tools are archived in `/V1-Archive-2025-01-07/tools/` and contain extensive automation utilities for the legacy system.
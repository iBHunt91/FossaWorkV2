# Cross-Platform Development Guide

## Overview

FossaWork V2 is designed to run on Windows, macOS, and Linux. This guide covers platform-specific considerations and best practices for cross-platform development.

## Quick Start by Platform

### Windows
```batch
# Using batch scripts
cd tools\windows
start-fossawork.bat

# Or using npm directly
cd frontend
npm run dev:win
```

### macOS/Linux
```bash
# Using shell scripts
cd tools/unix
./start-fossawork.sh

# Or using npm directly
cd frontend
npm run dev
```

## Platform-Specific Tools

### Windows Tools (`/tools/windows/`)
- `start-fossawork.bat` - Start entire system
- `start-backend.bat` - Start backend only
- `start-frontend.bat` - Start frontend only
- `kill-ports.bat` - Kill processes on ports
- `reset-database.bat` - Reset database
- `check-backend-status.bat` - Check backend health

### Unix/macOS Tools (`/tools/unix/`)
- `start-fossawork.sh` - Start entire system
- `start-backend.sh` - Start backend only
- `start-frontend.sh` - Start frontend only
- `kill-ports.sh` - Kill processes on ports
- `reset-database.sh` - Reset database
- `check-backend-status.sh` - Check backend health

## Development Environment Setup

### Windows

1. **Install Prerequisites:**
   ```batch
   # Install Node.js from https://nodejs.org
   # Install Python from https://python.org
   # Install Git from https://git-scm.com
   ```

2. **Setup Project:**
   ```batch
   git clone <repository>
   cd FossaWorkV2
   
   # Backend setup
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   
   # Frontend setup
   cd ..\frontend
   npm install
   ```

3. **Run Development:**
   ```batch
   # Use the convenient script
   tools\windows\start-fossawork.bat
   ```

### macOS

1. **Install Prerequisites:**
   ```bash
   # Install Homebrew
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install Node.js
   brew install node
   
   # Install Python
   brew install python@3.11
   ```

2. **Setup Project:**
   ```bash
   git clone <repository>
   cd FossaWorkV2
   
   # Backend setup
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   # Frontend setup
   cd ../frontend
   npm install
   ```

3. **Run Development:**
   ```bash
   # Use the convenient script
   ./tools/unix/start-fossawork.sh
   ```

### Linux (Ubuntu/Debian)

1. **Install Prerequisites:**
   ```bash
   # Update package list
   sudo apt update
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install Python and pip
   sudo apt install -y python3 python3-pip python3-venv
   ```

2. **Setup and run same as macOS**

## Code Considerations

### Path Handling

**✓ DO:**
```javascript
// JavaScript
const path = require('path');
const configPath = path.join(__dirname, 'config', 'settings.json');
```

```python
# Python
from pathlib import Path
config_path = Path(__file__).parent / 'config' / 'settings.json'
```

**✗ DON'T:**
```javascript
// Bad - hardcoded separator
const configPath = __dirname + '/config/settings.json';
```

### Platform Detection

```javascript
// JavaScript/TypeScript
const os = require('os');

function getPlatform() {
    const platform = process.platform;
    switch(platform) {
        case 'win32': return 'windows';
        case 'darwin': return 'macos';
        case 'linux': return 'linux';
        default: return platform;
    }
}

// Use platform-specific logic
if (process.platform === 'win32') {
    // Windows-specific code
} else {
    // Unix-like systems
}
```

```python
# Python
import platform
import sys

def get_platform():
    system = platform.system()
    if system == 'Windows':
        return 'windows'
    elif system == 'Darwin':
        return 'macos'
    elif system == 'Linux':
        return 'linux'
    return system.lower()

# Use platform-specific logic
if platform.system() == 'Windows':
    # Windows-specific code
    venv_python = 'venv\\Scripts\\python.exe'
else:
    # Unix-like systems
    venv_python = 'venv/bin/python'
```

### Environment Variables

Use `cross-env` for consistent environment variable handling:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:win": "cross-env NODE_ENV=development vite",
    "build": "cross-env NODE_ENV=production vite build"
  }
}
```

### File System Operations

1. **Case Sensitivity:**
   - Windows: Case-insensitive
   - macOS: Case-insensitive by default (can be case-sensitive)
   - Linux: Case-sensitive

2. **Line Endings:**
   - Windows: CRLF (`\r\n`)
   - Unix/macOS: LF (`\n`)
   - Use `.gitattributes` to handle automatically

3. **File Permissions:**
   - Windows: Different permission model
   - Unix/macOS: Standard Unix permissions
   - Make scripts executable on Unix: `chmod +x script.sh`

### Process Management

**Windows:**
```batch
:: Kill process by port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /PID %%a /F

:: Check if port is in use
netstat -ano | findstr :3001
```

**macOS/Linux:**
```bash
# Kill process by port
lsof -t -i:3001 | xargs kill -9

# Check if port is in use
lsof -i:3001
```

### Console/Terminal Output

The project includes `SafeConsoleFormatter` for Windows compatibility:

```python
# backend/app/utils/console_utils.py
# Automatically handles emoji compatibility for Windows terminals
```

## Common Issues and Solutions

### Issue: Port Already in Use

**Windows:**
```batch
tools\windows\kill-ports.bat
```

**macOS/Linux:**
```bash
./tools/unix/kill-ports.sh
```

### Issue: Python Virtual Environment

**Windows:**
```batch
# Activate
venv\Scripts\activate

# Deactivate
deactivate
```

**macOS/Linux:**
```bash
# Activate
source venv/bin/activate

# Deactivate
deactivate
```

### Issue: File Permissions (Unix/macOS)

```bash
# Make scripts executable
chmod +x tools/unix/*.sh

# Fix permission denied errors
sudo chown -R $USER:$USER .
```

### Issue: Playwright Browser Installation

**All Platforms:**
```bash
# Install browsers
npx playwright install

# With dependencies (Linux)
npx playwright install --with-deps
```

## Testing Across Platforms

1. **Use CI/CD for multi-platform testing**
2. **Test file operations with different path separators**
3. **Verify console output on different terminals**
4. **Check process management commands**
5. **Test with case-sensitive file systems**

## Best Practices

1. **Always use path.join() or pathlib.Path**
2. **Never hardcode path separators**
3. **Use cross-platform npm packages when available**
4. **Test on all target platforms before release**
5. **Document platform-specific requirements**
6. **Use virtual environments for Python**
7. **Handle encoding properly (UTF-8)**
8. **Be aware of line ending differences**

## Resources

- [Node.js OS Module](https://nodejs.org/api/os.html)
- [Python platform Module](https://docs.python.org/3/library/platform.html)
- [cross-env Documentation](https://github.com/kentcdodds/cross-env)
- [Playwright Cross-Platform](https://playwright.dev/docs/browsers)
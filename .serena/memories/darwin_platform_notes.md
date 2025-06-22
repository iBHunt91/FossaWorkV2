# Darwin/macOS Platform Notes for FossaWork V2

## Platform Information
- **System:** Darwin (macOS)
- **Project Path:** `/Users/ibhunt/Documents/GitHub/FossaWorkV2`

## macOS-Specific Commands

### Process Management
```bash
# Kill processes on specific ports (macOS)
lsof -ti:8000 | xargs kill -9    # Kill backend port
lsof -ti:5173 | xargs kill -9    # Kill frontend port

# Find processes
ps aux | grep python              # Find Python processes
ps aux | grep node                # Find Node processes

# Kill Chromium browser processes (from Playwright)
pkill -f chromium
```

### File System Commands
```bash
# macOS file operations
open .                           # Open current directory in Finder
open -a "Visual Studio Code" .   # Open in VS Code
pbcopy < file.txt                # Copy file contents to clipboard
pbpaste > file.txt               # Paste clipboard to file

# File permissions
chmod +x script.sh               # Make script executable
```

## Unix Shell Scripts Available

### Start Scripts (in `/tools/unix/`)
- `start-fossawork.sh` - Starts both backend and frontend
- `start-backend.sh` - Starts only the backend server
- `start-frontend.sh` - Starts only the frontend dev server
- `kill-ports.sh` - Kills processes on common ports (8000, 5173)
- `kill-port.sh` - Kill process on a specific port
- `check-backend-status.sh` - Checks if backend is running
- `reset-database.sh` - Resets the SQLite database

### Making Scripts Executable
```bash
chmod +x tools/unix/*.sh         # Make all scripts executable
```

## Python Environment on macOS

### Using Python 3
```bash
python3 --version                # Check Python version
python3 -m venv venv            # Create virtual environment
source venv/bin/activate        # Activate virtual environment
deactivate                      # Deactivate virtual environment
```

### Common Python Paths
- System Python: `/usr/bin/python3`
- Homebrew Python: `/opt/homebrew/bin/python3` (Apple Silicon)
- Virtual Environment: `./venv/bin/python`

## Node.js on macOS

### Node Version Management
```bash
node --version                   # Check Node version
npm --version                    # Check npm version
which node                       # Find Node location
```

### Common Node Issues on macOS
- If `EACCES` errors: Use `sudo` or fix npm permissions
- If port already in use: Use `kill-ports.sh` script
- For memory issues: Increase Node memory with `NODE_OPTIONS`

## Browser Automation on macOS

### Playwright Configuration
- No sandbox flags needed (unlike Linux)
- Browsers installed in: `~/Library/Caches/ms-playwright/`
- Screenshots saved to: `backend/data/screenshots/`

### Chrome/Chromium Debugging
```bash
# Find Chromium processes
ps aux | grep -i chromium

# Kill all Chromium processes
pkill -f chromium

# Open Chrome with debugging
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

## Environment Variables on macOS

### Setting Environment Variables
```bash
# Temporary (current session)
export VAR_NAME=value

# Permanent (add to ~/.zshrc or ~/.bash_profile)
echo 'export VAR_NAME=value' >> ~/.zshrc
source ~/.zshrc
```

### Common Environment Variables
```bash
export NODE_OPTIONS="--max-old-space-size=8192"  # Increase Node memory
export PYTHONUNBUFFERED=1                        # Python unbuffered output
export DATABASE_URL="sqlite:///./fossawork_v2.db" # Database path
```

## macOS Security Considerations

### Gatekeeper Issues
If macOS blocks the Electron app:
1. Right-click the app
2. Select "Open"
3. Click "Open" in the dialog

### Code Signing (for distribution)
```bash
# Sign the app (requires Apple Developer certificate)
codesign --deep --force --sign "Developer ID Application: Your Name" FossaWork.app

# Verify signature
codesign --verify --verbose FossaWork.app
```

## Useful macOS Developer Tools

### System Monitoring
```bash
top                             # Process monitor
htop                            # Better process monitor (install via brew)
Activity Monitor.app            # GUI process monitor
Console.app                     # System logs
```

### Network Debugging
```bash
netstat -an | grep LISTEN       # Show listening ports
lsof -i :8000                   # Show what's using port 8000
curl http://localhost:8000      # Test backend
```

### File Watching (for development)
```bash
fswatch -o . | xargs -n1 echo "File changed"  # Watch current directory
```

## Homebrew Packages (recommended)

```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Useful packages for development
brew install python@3.11        # Python 3.11
brew install node               # Node.js
brew install git                # Latest Git
brew install httpie             # HTTP client
brew install jq                 # JSON processor
brew install watch              # Watch command output
```

## Troubleshooting macOS Issues

### Port Already in Use
```bash
./tools/unix/kill-ports.sh      # Kill common ports
./tools/unix/kill-port.sh 8000  # Kill specific port
```

### Python Module Not Found
```bash
# Ensure virtual environment is activated
source backend/venv/bin/activate
which python                    # Should show venv path
pip list                        # Check installed packages
```

### Node Memory Issues
```bash
# Increase memory for npm commands
NODE_OPTIONS="--max-old-space-size=8192" npm run build
```

### File Permission Issues
```bash
# Fix permissions for project
sudo chown -R $(whoami) .
chmod -R u+rw .
```

## VS Code Integration on macOS

### Launch from Terminal
```bash
code .                          # Open current directory
code file.py                    # Open specific file
```

### Recommended Extensions
- Python
- Pylance
- ESLint
- Prettier
- GitLens
- Thunder Client (API testing)
#!/bin/bash
# Start Backend Server - Unix/macOS version

echo "Starting FossaWork Backend..."
echo "============================="

# Get the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKEND_DIR="$PROJECT_ROOT/backend"

cd "$BACKEND_DIR"

# Check Python installation
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "Using Python: $PYTHON_CMD"

# Check/create virtual environment
if [ -d "venv" ]; then
    echo "Activating existing virtual environment..."
    source venv/bin/activate
else
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    
    echo "Installing requirements..."
    pip install --upgrade pip
    pip install -r requirements.txt
fi

# Kill any process using port 8000
echo "Checking for processes on port 8000..."
if command -v lsof &> /dev/null; then
    PIDS=$(lsof -ti :8000)
    if [ ! -z "$PIDS" ]; then
        echo "Found processes using port 8000: $PIDS"
        echo "Killing processes..."
        kill -9 $PIDS 2>/dev/null || true
        echo "Processes killed"
    else
        echo "Port 8000 is available"
    fi
else
    echo "Warning: lsof not found, cannot check port availability"
fi

# Start the backend
echo ""
echo "Starting backend server on http://localhost:8000"
echo "API Docs available at: http://localhost:8000/docs"
echo "Press Ctrl+C to stop"
echo ""

$PYTHON_CMD start_backend.py
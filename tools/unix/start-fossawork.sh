#!/bin/bash
# Start FossaWork V2 System - Unix/macOS version

echo "Starting FossaWork V2 System..."
echo "================================"

# Get the project root directory (two levels up from this script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "Error: Python is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check if required ports are available and kill existing processes
echo "Checking port availability..."
if check_port 8000; then
    echo "Port 8000 is in use. Killing existing backend process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 2
    echo "Backend process killed."
fi
if check_port 5173; then
    echo "Port 5173 is in use. Killing existing frontend process..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 2
    echo "Frontend process killed."
fi

# Start the backend
echo ""
echo "Starting backend server..."
cd backend
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
else
    echo "Creating virtual environment..."
    python3 -m venv venv || python -m venv venv
    source venv/bin/activate
    echo "Installing backend dependencies..."
    pip install -r requirements.txt
fi

# Start backend in background
python start_backend.py &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Start the frontend
echo ""
echo "Starting frontend..."
cd ../frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start frontend
echo "Starting Vite development server..."
npm run dev

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down FossaWork..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup INT TERM

# Wait for user input
echo ""
echo "FossaWork is running. Press Ctrl+C to stop."
wait
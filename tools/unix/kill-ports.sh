#!/bin/bash
# Kill processes on specific ports - Unix/macOS version

echo "FossaWork Port Cleanup Utility"
echo "=============================="

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local pids=$(lsof -t -i:$port)
    
    if [ -z "$pids" ]; then
        echo "Port $port is not in use"
    else
        echo "Killing process(es) on port $port: $pids"
        for pid in $pids; do
            kill -9 $pid 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "  Killed PID $pid"
            else
                echo "  Failed to kill PID $pid (may require sudo)"
            fi
        done
    fi
}

# Check for specific port argument
if [ $# -eq 1 ]; then
    kill_port $1
else
    # Default: kill common FossaWork ports
    echo "Checking default FossaWork ports..."
    echo ""
    
    # Backend port
    echo "Backend (3001):"
    kill_port 3001
    echo ""
    
    # Frontend port
    echo "Frontend (5173):"
    kill_port 5173
    echo ""
    
    # Alternative Vite port
    echo "Alternative Frontend (5174):"
    kill_port 5174
fi

echo ""
echo "Port cleanup complete."
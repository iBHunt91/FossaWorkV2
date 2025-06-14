#!/bin/bash
# Check Backend Status - Unix/macOS version

echo "FossaWork Backend Status Check"
echo "=============================="
echo ""

# Check if backend port is in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✓ Backend port 8000 is active"
    
    # Try to get process info
    PID=$(lsof -t -i:8000 | head -1)
    if [ ! -z "$PID" ]; then
        echo "  Process ID: $PID"
        ps -p $PID -o comm= | xargs echo "  Process: "
    fi
    
    # Try to ping the backend
    echo ""
    echo "Checking backend health..."
    if command -v curl &> /dev/null; then
        response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null)
        if [ "$response" = "200" ]; then
            echo "✓ Backend is responding to health checks"
            
            # Get backend info
            info=$(curl -s http://localhost:8000/api/system/info 2>/dev/null)
            if [ ! -z "$info" ]; then
                echo ""
                echo "Backend Information:"
                echo "$info" | python3 -m json.tool 2>/dev/null || echo "$info"
            fi
        else
            echo "✗ Backend is not responding (HTTP $response)"
        fi
    else
        echo "Note: curl not found, cannot check backend health"
    fi
else
    echo "✗ Backend port 8000 is not active"
    echo ""
    echo "To start the backend, run:"
    echo "  ./tools/unix/start-backend.sh"
fi

echo ""
echo "Other services:"

# Check frontend
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✓ Frontend port 5173 is active"
else
    echo "✗ Frontend port 5173 is not active"
fi

# Check for Python virtual environment
BACKEND_DIR="$(dirname "$(dirname "$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )")")/backend"
if [ -d "$BACKEND_DIR/venv" ]; then
    echo "✓ Python virtual environment exists"
else
    echo "✗ Python virtual environment not found"
fi
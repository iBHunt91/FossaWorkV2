#!/bin/bash
# Kill process using a specific port
# Usage: ./kill-port.sh [port]
# Default port: 8000

PORT=${1:-8000}

echo "🔍 Checking for processes using port $PORT..."

if command -v lsof &> /dev/null; then
    PIDS=$(lsof -ti :$PORT)
    if [ ! -z "$PIDS" ]; then
        echo "⚠️  Found the following processes using port $PORT:"
        # Show process details
        for PID in $PIDS; do
            PROCESS_INFO=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
            echo "   - PID: $PID ($PROCESS_INFO)"
        done
        
        echo ""
        echo "Killing processes..."
        for PID in $PIDS; do
            if kill -9 $PID 2>/dev/null; then
                echo "✅ Killed process $PID"
            else
                echo "❌ Failed to kill process $PID (may require sudo)"
            fi
        done
    else
        echo "✅ Port $PORT is available - no processes to kill"
    fi
else
    echo "❌ Error: lsof command not found"
    echo "   Please install lsof or use: netstat -tulpn | grep :$PORT"
    exit 1
fi

echo ""
echo "Done!"
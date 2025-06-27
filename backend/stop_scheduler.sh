#!/bin/bash

# Stop the FossaWork V2 Scheduler Daemon

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if PID file exists
if [ ! -f "$SCRIPT_DIR/scheduler_daemon.pid" ]; then
    echo "PID file not found. Checking for running processes..."
    
    # Try to find the process
    PID=$(pgrep -f "scheduler_daemon.py")
    
    if [ -z "$PID" ]; then
        echo "Scheduler daemon is not running"
        exit 0
    fi
else
    # Read PID from file
    PID=$(cat "$SCRIPT_DIR/scheduler_daemon.pid")
fi

# Check if process is running
if ps -p $PID > /dev/null 2>&1; then
    echo "Stopping scheduler daemon (PID: $PID)..."
    kill $PID
    
    # Wait for process to stop
    sleep 2
    
    # Check if it's still running
    if ps -p $PID > /dev/null 2>&1; then
        echo "Process didn't stop gracefully, forcing..."
        kill -9 $PID
    fi
    
    echo "Scheduler daemon stopped"
else
    echo "Scheduler daemon is not running (PID: $PID not found)"
fi

# Remove PID file
rm -f "$SCRIPT_DIR/scheduler_daemon.pid"
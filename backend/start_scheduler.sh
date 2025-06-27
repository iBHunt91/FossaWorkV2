#!/bin/bash

# Start the FossaWork V2 Scheduler Daemon

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if virtual environment exists
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "Error: Virtual environment not found at $SCRIPT_DIR/venv"
    echo "Please run 'python3 -m venv venv' first"
    exit 1
fi

# Activate virtual environment
source "$SCRIPT_DIR/venv/bin/activate"

# Check if scheduler is already running
if pgrep -f "scheduler_daemon.py" > /dev/null; then
    echo "Scheduler daemon is already running"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Start the scheduler daemon
echo "Starting FossaWork V2 Scheduler Daemon..."
nohup python "$SCRIPT_DIR/scheduler_daemon.py" > "$SCRIPT_DIR/logs/scheduler_daemon.log" 2>&1 &

# Get the PID
PID=$!
echo $PID > "$SCRIPT_DIR/scheduler_daemon.pid"

echo "Scheduler daemon started with PID: $PID"
echo "Log file: $SCRIPT_DIR/logs/scheduler_daemon.log"
echo ""
echo "To monitor logs: tail -f $SCRIPT_DIR/logs/scheduler_daemon.log"
echo "To stop: ./stop_scheduler.sh"
#!/bin/bash
# Restart the scheduler daemon

echo "Stopping scheduler daemon..."
pkill -f "scheduler_daemon.py" || true

echo "Waiting for process to stop..."
sleep 2

echo "Starting scheduler daemon..."
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
source venv/bin/activate
nohup python scheduler_daemon.py > scheduler_daemon.log 2>&1 &

echo "Scheduler daemon restarted. PID: $!"
echo "Check logs with: tail -f scheduler_daemon.log"
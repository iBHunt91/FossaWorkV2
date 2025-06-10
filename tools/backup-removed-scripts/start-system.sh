#!/bin/bash
# FossaWork System Launcher for Unix/Linux/Mac
# This launches the intelligent Python startup script

echo "FossaWork System Launcher"
echo "========================"

# Change to the tools directory
cd "$(dirname "$0")"

# Try to run with python3 first, then python
if command -v python3 >/dev/null 2>&1; then
    python3 start-system.py
elif command -v python >/dev/null 2>&1; then
    python start-system.py
else
    echo "ERROR: Could not find Python 3.7+"
    echo "Please install Python 3.7 or higher"
    exit 1
fi
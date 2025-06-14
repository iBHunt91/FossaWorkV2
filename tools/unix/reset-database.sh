#!/bin/bash
# Reset Database - Unix/macOS version

echo "FossaWork Database Reset Utility"
echo "================================"
echo ""
echo "WARNING: This will delete ALL data including:"
echo "  - User accounts"
echo "  - Work orders"
echo "  - Credentials"
echo "  - Settings"
echo "  - Logs"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

# Get the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

echo ""
echo "Resetting database..."

# Run the Python reset script
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python is not installed."
    exit 1
fi

cd backend/scripts
$PYTHON_CMD reset_database_simple.py

echo ""
echo "Database reset complete."
echo "You can now start fresh with a clean database."
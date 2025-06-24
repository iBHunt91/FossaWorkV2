#!/bin/bash

# This script sets up the form-prep worktree environment

set -e

WORKTREE_PATH="../FossaWorkV2-form-prep"

echo "Setting up environment in form-prep worktree..."

# Navigate to worktree and run setup
cd "$WORKTREE_PATH"

# Run the setup script
if [ -f "scripts/setup/setup-worktree.sh" ]; then
    echo "Running setup script..."
    bash scripts/setup/setup-worktree.sh
else
    echo "Setup script not found, running manual setup..."
    
    # Install npm dependencies
    if [ -f "package.json" ]; then
        echo "Installing npm dependencies..."
        npm install
    fi

    # Install frontend dependencies
    if [ -f "frontend/package.json" ]; then
        echo "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi

    # Install backend dependencies
    if [ -f "backend/package.json" ]; then
        echo "Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi

    # Set up Python virtual environment if needed
    if [ -f "backend/requirements.txt" ]; then
        echo "Setting up Python virtual environment..."
        cd backend
        python3 -m venv venv
        
        # Activate and install based on OS
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            # Windows
            venv/Scripts/python.exe -m pip install --upgrade pip
            venv/Scripts/pip.exe install -r requirements.txt
        else
            # macOS/Linux
            source venv/bin/activate
            pip install --upgrade pip
            pip install -r requirements.txt
            deactivate
        fi
        cd ..
    fi
fi

echo "✅ Form-prep worktree setup complete!"
echo "Location: $WORKTREE_PATH"
echo ""
echo "To start working:"
echo "  cd $WORKTREE_PATH"
echo "  # Start frontend: npm run dev"
echo "  # Start backend: cd backend && uvicorn app.main:app --reload --port 8000"
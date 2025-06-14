#!/bin/bash

# Script to set up a new worktree with all dependencies

echo "Setting up worktree environment..."

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
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

echo "Worktree setup complete!"
#!/bin/bash

cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend

# Activate virtual environment
source venv/bin/activate

# Start backend
echo "Starting backend server..."
uvicorn app.main:app --reload --port 8000
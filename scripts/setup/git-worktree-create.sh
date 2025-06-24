#!/bin/bash

# Script to create a git worktree and automatically set up its environment
# Usage: ./scripts/setup/git-worktree-create.sh <worktree-name> <branch-name>
#
# Examples:
#   ./scripts/setup/git-worktree-create.sh form-prep feature/form-prep
#   ./scripts/setup/git-worktree-create.sh bugfix-auth bugfix/auth-token

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we have the required arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo "Usage: $0 <worktree-name> <branch-name>"
    echo "Example: $0 form-prep feature/form-prep"
    exit 1
fi

WORKTREE_NAME=$1
BRANCH_NAME=$2
WORKTREE_PATH="../FossaWorkV2-${WORKTREE_NAME}"
CURRENT_DIR=$(pwd)

echo -e "${GREEN}Creating git worktree for ${WORKTREE_NAME}...${NC}"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo -e "${RED}Error: Worktree directory $WORKTREE_PATH already exists${NC}"
    exit 1
fi

# Create the worktree
echo -e "${YELLOW}Creating worktree at ${WORKTREE_PATH} with branch ${BRANCH_NAME}...${NC}"
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

# Navigate to the worktree
cd "$WORKTREE_PATH"

echo -e "${GREEN}Setting up environment in worktree...${NC}"

# Install npm dependencies
if [ -f "package.json" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
fi

# Install frontend dependencies
if [ -f "frontend/package.json" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Install backend dependencies
if [ -f "backend/package.json" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Set up Python virtual environment if needed
if [ -f "backend/requirements.txt" ]; then
    echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
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

# Return to original directory
cd "$CURRENT_DIR"

echo -e "${GREEN}✅ Worktree setup complete!${NC}"
echo -e "${GREEN}Location: ${WORKTREE_PATH}${NC}"
echo -e "${GREEN}Branch: ${BRANCH_NAME}${NC}"
echo ""
echo -e "${YELLOW}To start working:${NC}"
echo "  cd $WORKTREE_PATH"
echo "  # Start frontend: npm run dev"
echo "  # Start backend: cd backend && uvicorn app.main:app --reload --port 8000"
echo ""
echo -e "${YELLOW}To open in a new Claude Code session:${NC}"
echo "  cd $WORKTREE_PATH && claude"
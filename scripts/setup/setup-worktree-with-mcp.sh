#!/bin/bash

# Enhanced script to set up a new worktree with all dependencies and MCP config
# Usage: ./setup-worktree-with-mcp.sh [worktree-path]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the source directory (where this script is located)
SOURCE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WORKTREE_PATH="${1:-$(pwd)}"

echo -e "${GREEN}Setting up worktree environment at: ${WORKTREE_PATH}${NC}"

# Function to copy configuration files
copy_config_files() {
    echo -e "${YELLOW}Copying configuration files...${NC}"
    
    # Copy MCP configuration
    if [ -f "$SOURCE_DIR/.mcp.json" ]; then
        cp "$SOURCE_DIR/.mcp.json" "$WORKTREE_PATH/.mcp.json"
        echo "✓ Copied .mcp.json"
        
        # Update SERENA_PROJECT_PATH in the copied MCP config
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"|g" "$WORKTREE_PATH/.mcp.json"
        else
            # Linux
            sed -i "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"|g" "$WORKTREE_PATH/.mcp.json"
        fi
        echo "✓ Updated SERENA_PROJECT_PATH in .mcp.json"
    else
        echo -e "${RED}Warning: .mcp.json not found in source directory${NC}"
    fi
    
    # Copy .env.example if it exists
    if [ -f "$SOURCE_DIR/backend/.env.example" ] && [ ! -f "$WORKTREE_PATH/backend/.env" ]; then
        cp "$SOURCE_DIR/backend/.env.example" "$WORKTREE_PATH/backend/.env.example"
        echo "✓ Copied backend/.env.example"
    fi
    
    # Copy VS Code settings if they exist
    if [ -d "$SOURCE_DIR/.vscode" ] && [ ! -d "$WORKTREE_PATH/.vscode" ]; then
        cp -r "$SOURCE_DIR/.vscode" "$WORKTREE_PATH/.vscode"
        echo "✓ Copied .vscode settings"
    fi
}

# Navigate to worktree directory
cd "$WORKTREE_PATH"

# Copy configuration files first
copy_config_files

# Install npm dependencies
if [ -f "package.json" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ npm dependencies installed${NC}"
fi

# Install frontend dependencies
if [ -f "frontend/package.json" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
fi

# Install backend dependencies
if [ -f "backend/package.json" ]; then
    echo -e "${YELLOW}Installing backend Node.js dependencies...${NC}"
    cd backend && npm install && cd ..
    echo -e "${GREEN}✓ Backend Node.js dependencies installed${NC}"
fi

# Set up Python virtual environment if needed
if [ -f "backend/requirements.txt" ]; then
    echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
    cd backend
    
    # Create virtual environment
    python3 -m venv venv
    
    # Activate and install dependencies
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        # Windows
        venv/Scripts/activate && pip install -r requirements.txt
    else
        # Unix/macOS
        source venv/bin/activate && pip install -r requirements.txt
    fi
    
    # Create .env file from example if it doesn't exist
    if [ -f ".env.example" ] && [ ! -f ".env" ]; then
        cp .env.example .env
        echo -e "${YELLOW}Created .env file from .env.example - please update with your values${NC}"
    fi
    
    # Run setup-env.py if it exists
    if [ -f "scripts/setup-env.py" ] && [ ! -f ".env" ]; then
        python3 scripts/setup-env.py
        echo -e "${GREEN}✓ Generated secure .env file${NC}"
    fi
    
    cd ..
    echo -e "${GREEN}✓ Python environment set up${NC}"
fi

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p logs
mkdir -p backend/data/users
mkdir -p backend/data/credentials
mkdir -p screenshots
echo -e "${GREEN}✓ Directories created${NC}"

# Final summary
echo -e "\n${GREEN}=== Worktree Setup Complete! ===${NC}"
echo -e "Worktree path: ${WORKTREE_PATH}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Navigate to the worktree: cd ${WORKTREE_PATH}"
echo "2. Activate Python venv: source backend/venv/bin/activate"
echo "3. Update backend/.env with your configuration"
echo "4. Start development with the start scripts in tools/"
echo -e "\n${GREEN}MCP servers configured and ready to use!${NC}"
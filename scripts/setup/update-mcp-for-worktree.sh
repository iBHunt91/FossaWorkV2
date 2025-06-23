#!/bin/bash

# Script to update MCP configuration for the current worktree
# Usage: ./update-mcp-for-worktree.sh [worktree-path]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the worktree path (current directory if not specified)
WORKTREE_PATH="${1:-$(pwd)}"
WORKTREE_PATH="$(cd "$WORKTREE_PATH" && pwd)"  # Get absolute path

# MCP config file location
MCP_CONFIG="$HOME/.config/claude-desktop/config.json"

echo -e "${GREEN}Updating MCP configuration for worktree: ${WORKTREE_PATH}${NC}"

# Check if MCP config exists
if [ ! -f "$MCP_CONFIG" ]; then
    echo -e "${RED}Error: MCP configuration not found at $MCP_CONFIG${NC}"
    echo "Please ensure Claude Desktop is installed and has been run at least once."
    exit 1
fi

# Backup existing config
cp "$MCP_CONFIG" "$MCP_CONFIG.backup"
echo "✓ Backed up existing configuration"

# Update SERENA_PROJECT_PATH in the config
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"|g" "$MCP_CONFIG"
else
    # Linux
    sed -i "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"|g" "$MCP_CONFIG"
fi

echo -e "${GREEN}✓ Updated SERENA_PROJECT_PATH to: $WORKTREE_PATH${NC}"

# Verify the update
if grep -q "\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"" "$MCP_CONFIG"; then
    echo -e "${GREEN}✓ Configuration verified${NC}"
else
    echo -e "${RED}Error: Failed to update configuration${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Important: You need to restart Claude Desktop for the changes to take effect!${NC}"
echo -e "1. Quit Claude Desktop completely (Cmd+Q on macOS)"
echo -e "2. Start Claude Desktop again"
echo -e "3. The MCP servers will use the new project path: $WORKTREE_PATH"

# Also update the local .mcp.json if it exists (for reference)
if [ -f "$WORKTREE_PATH/.mcp.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"|g" "$WORKTREE_PATH/.mcp.json"
    else
        sed -i "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$WORKTREE_PATH\"|g" "$WORKTREE_PATH/.mcp.json"
    fi
    echo -e "\n✓ Also updated local .mcp.json for reference"
fi
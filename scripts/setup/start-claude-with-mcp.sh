#!/bin/bash

# Script to start Claude Code with project-specific MCP configuration
# This ensures MCP servers are available in any worktree

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Find .mcp.json in current directory or use the one from main project
if [ -f ".mcp.json" ]; then
    MCP_CONFIG="$(pwd)/.mcp.json"
    echo -e "${GREEN}Using local .mcp.json from current directory${NC}"
elif [ -f "$PROJECT_ROOT/.mcp.json" ]; then
    MCP_CONFIG="$PROJECT_ROOT/.mcp.json"
    echo -e "${YELLOW}Using .mcp.json from main project directory${NC}"
else
    echo -e "${RED}Error: No .mcp.json found${NC}"
    exit 1
fi

# Update SERENA_PROJECT_PATH in the MCP config to match current directory
CURRENT_DIR="$(pwd)"
TEMP_MCP="/tmp/claude-mcp-$$.json"

# Create a temporary MCP config with updated SERENA_PROJECT_PATH
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$CURRENT_DIR\"|g" "$MCP_CONFIG" > "$TEMP_MCP"
else
    # Linux
    sed "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$CURRENT_DIR\"|g" "$MCP_CONFIG" > "$TEMP_MCP"
fi

echo -e "${GREEN}Starting Claude Code with MCP servers...${NC}"
echo "MCP Config: $TEMP_MCP"
echo "Project Path: $CURRENT_DIR"
echo ""

# Start Claude with the MCP configuration
claude --mcp-config "$TEMP_MCP" "$@"

# Clean up temporary file
rm -f "$TEMP_MCP"
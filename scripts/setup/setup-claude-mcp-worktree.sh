#!/bin/bash

# Script to set up Claude Code MCP servers for worktrees
# This ensures consistent MCP configuration across all worktrees

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Claude Code MCP Worktree Setup${NC}"
echo "================================"

# Get the target directory (current directory if not specified)
TARGET_DIR="${1:-$(pwd)}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"  # Get absolute path

echo -e "\n${YELLOW}Setting up MCP for: $TARGET_DIR${NC}"

# Step 1: Copy .mcp.json if it doesn't exist
if [ ! -f "$TARGET_DIR/.mcp.json" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    SOURCE_MCP="$(cd "$SCRIPT_DIR/../.." && pwd)/.mcp.json"
    
    if [ -f "$SOURCE_MCP" ]; then
        cp "$SOURCE_MCP" "$TARGET_DIR/.mcp.json"
        echo -e "${GREEN}✓ Copied .mcp.json to worktree${NC}"
    else
        echo -e "${RED}Error: Source .mcp.json not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .mcp.json already exists${NC}"
fi

# Step 2: Update SERENA_PROJECT_PATH
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$TARGET_DIR\"|g" "$TARGET_DIR/.mcp.json"
else
    sed -i "s|\"SERENA_PROJECT_PATH\": \".*\"|\"SERENA_PROJECT_PATH\": \"$TARGET_DIR\"|g" "$TARGET_DIR/.mcp.json"
fi
echo -e "${GREEN}✓ Updated SERENA_PROJECT_PATH${NC}"

# Step 3: Reset project choices for Claude Code
echo -e "\n${YELLOW}Resetting Claude Code project choices...${NC}"
echo "This will allow Claude to re-prompt for MCP server approval"
echo ""
echo "Run this command in the worktree directory:"
echo -e "${BLUE}cd $TARGET_DIR && claude mcp reset-project-choices${NC}"

# Step 4: Create a starter script
STARTER_SCRIPT="$TARGET_DIR/start-claude.sh"
cat > "$STARTER_SCRIPT" << 'EOF'
#!/bin/bash
# Start Claude Code with project MCP servers

# First, try to start normally - Claude will prompt for MCP approval
claude "$@"

# If you need to force MCP config, uncomment the line below:
# claude --mcp-config .mcp.json "$@"
EOF

chmod +x "$STARTER_SCRIPT"
echo -e "\n${GREEN}✓ Created start-claude.sh script${NC}"

# Step 5: Instructions
echo -e "\n${GREEN}=== Setup Complete! ===${NC}"
echo -e "\n${YELLOW}To use MCP servers in this worktree:${NC}"
echo ""
echo "1. Navigate to the worktree:"
echo -e "   ${BLUE}cd $TARGET_DIR${NC}"
echo ""
echo "2. Reset Claude's project choices (one time only):"
echo -e "   ${BLUE}claude mcp reset-project-choices${NC}"
echo ""
echo "3. Start Claude Code:"
echo -e "   ${BLUE}claude${NC}"
echo "   (Claude will prompt to approve project MCP servers)"
echo ""
echo "4. Alternative: Use the starter script:"
echo -e "   ${BLUE}./start-claude.sh${NC}"
echo ""
echo -e "${YELLOW}Note: You only need to approve MCP servers once per worktree.${NC}"
echo -e "${YELLOW}After approval, just use 'claude' normally.${NC}"
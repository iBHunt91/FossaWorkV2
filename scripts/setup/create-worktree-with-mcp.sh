#!/bin/bash

# Script to create a new git worktree and set it up with MCP configuration
# Usage: ./create-worktree-with-mcp.sh <worktree-name> [branch-name]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Usage: $0 <worktree-name> [branch-name]${NC}"
    echo "Example: $0 security-fixes"
    echo "         $0 feature-auth feature-auth-branch"
    exit 1
fi

WORKTREE_NAME="$1"
BRANCH_NAME="${2:-$1}"  # Use worktree name as branch name if not specified
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PARENT_DIR="$(dirname "$SOURCE_DIR")"
WORKTREE_PATH="$PARENT_DIR/FossaWorkV2-$WORKTREE_NAME"

echo -e "${GREEN}Creating worktree: $WORKTREE_NAME${NC}"
echo "Source directory: $SOURCE_DIR"
echo "Worktree path: $WORKTREE_PATH"
echo "Branch name: $BRANCH_NAME"

# Create the worktree
cd "$SOURCE_DIR"
echo -e "${YELLOW}Creating git worktree...${NC}"
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

# Run the setup script
echo -e "${YELLOW}Setting up worktree environment...${NC}"
"$SCRIPT_DIR/setup-worktree-with-mcp.sh" "$WORKTREE_PATH"

echo -e "\n${GREEN}=== Worktree Created Successfully! ===${NC}"
echo -e "Worktree location: ${WORKTREE_PATH}"
echo -e "\n${YELLOW}To start working:${NC}"
echo "1. cd $WORKTREE_PATH"
echo "2. claude  # Start Claude Code in the new worktree"
echo -e "\n${GREEN}Happy coding!${NC}"
#\!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Setting up security-fixes worktree environment...${NC}"

# Navigate to the worktree
WORKTREE_PATH="../FossaWorkV2-security-fixes"

if [ \! -d "$WORKTREE_PATH" ]; then
    echo -e "${RED}Error: Worktree directory $WORKTREE_PATH does not exist${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing dependencies in worktree...${NC}"

# Install root dependencies
cd "$WORKTREE_PATH"
echo "Installing root npm dependencies..."
npm install --legacy-peer-deps

# Install frontend dependencies
cd frontend
echo "Installing frontend dependencies..."
npm install --legacy-peer-deps
cd ..

# Install backend dependencies
cd backend
echo "Installing backend npm dependencies..."
npm install --legacy-peer-deps

# Set up Python virtual environment
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Install additional security packages for the audit fixes
echo -e "${YELLOW}Installing additional security packages...${NC}"
pip install secure python-multipart python-magic bleach

echo -e "${GREEN}Environment setup complete\!${NC}"
echo ""
echo "To work in the security-fixes worktree:"
echo "1. cd $WORKTREE_PATH"
echo "2. cd backend && source venv/bin/activate"
echo ""
echo "To run the development servers:"
echo "- Backend: cd backend && uvicorn app.main:app --reload --port 8000"
echo "- Frontend: npm run dev"

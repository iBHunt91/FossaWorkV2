#!/bin/bash
# This script requires sudo to install claude system-wide

echo "This will create a symlink to claude in /usr/local/bin"
echo "You'll need to enter your password."
echo ""

# Create /usr/local/bin if it doesn't exist
sudo mkdir -p /usr/local/bin

# Create the symlink
sudo ln -sf /Users/ibhunt/.npm-global/bin/claude /usr/local/bin/claude

echo "Done! Claude is now available system-wide."
echo "Please restart Claudia and try again."
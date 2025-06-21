#!/bin/bash

# Kill any existing Claudia instances
pkill -f Claudia

# Set up environment
export PATH="/Users/ibhunt/.npm-global/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
export HOME="/Users/ibhunt"

# Create claude wrapper in multiple locations just to be sure
mkdir -p ~/.local/bin
mkdir -p ~/.claude/local

# Create wrapper script
cat > ~/.local/bin/claude << 'EOF'
#!/bin/bash
exec /Users/ibhunt/.npm-global/bin/claude "$@"
EOF
chmod +x ~/.local/bin/claude

# Copy to other locations
cp ~/.local/bin/claude ~/.claude/local/claude
cp ~/.local/bin/claude ~/claude

# Launch Claudia with the correct environment
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/claudia/src-tauri/target/release/bundle/macos/
./Claudia.app/Contents/MacOS/Claudia
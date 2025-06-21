#!/bin/bash
# Claudia launcher with proper PATH

# Add necessary paths
export PATH="/Users/ibhunt/.npm-global/bin:/Users/ibhunt/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Change to home directory to avoid path issues
cd ~

# Launch the Claudia app directly
/Users/ibhunt/Documents/GitHub/FossaWorkV2-hourly-scrape/claudia/src-tauri/target/release/bundle/macos/Claudia.app/Contents/MacOS/Claudia
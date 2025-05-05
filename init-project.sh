#!/bin/bash
echo "=== Fossa Monitor Initialization ==="
echo "Setting up the minimal environment for first launch..."

# Create basic data directory structure
mkdir -p data
mkdir -p logs

# Create basic scraped_content.json file
echo '{"jobs":[],"lastUpdated":"2025-05-05T00:00:00.000Z"}' > data/scraped_content.json

# Copy template to .env if it doesn't exist
if [ ! -f .env ]; then
  cp .env.template .env
  echo "Created .env from template"
fi

echo ""
echo "Setup complete!"
echo "You can now run 'npm install' and then 'npm run electron:dev:start'"
echo "" 
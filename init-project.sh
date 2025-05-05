#!/bin/bash
echo "=== Fossa Monitor Initialization ==="
echo "Setting up the minimal environment for first launch..."

# Create basic data directory structure
mkdir -p data
mkdir -p logs
mkdir -p data/users
mkdir -p data/templates

# Create/Update .env file
echo "RUNNING_ELECTRON_DEV=true" > .env
echo "Created/updated .env with RUNNING_ELECTRON_DEV=true"

# Generate the bootstrap templates if they don't exist yet
if [ ! -f data/templates/dispenser_store.template.json ]; then
  echo "Running bootstrap templates generation script..."
  node scripts/bootstrap-templates.js
else
  echo "Template files already exist, skipping bootstrap."
fi

# Run the initialization from templates
echo "Running initialization from templates..."
node -e "require('./scripts/init-data.js').initializeDataFromTemplates()"

echo ""
echo "Setup complete!"
echo "You can now run 'npm install' and then 'npm run electron:dev:start'"
echo "You will need to create a new user through the UI and provide your FOSSA credentials."
echo "" 
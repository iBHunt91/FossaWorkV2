#!/bin/bash
echo "=== Fossa Monitor Initialization ==="
echo "Setting up the minimal environment for first launch..."

# Create basic data directory structure
mkdir -p data
mkdir -p logs
mkdir -p data/users

# Create basic scraped_content.json file
echo '{"jobs":[],"lastUpdated":"2025-05-05T00:00:00.000Z","workOrders":[]}' > data/scraped_content.json

# Create basic users.json file
echo '{"users":[]}' > data/users.json

# Create basic email-settings if not exist
if [ ! -f data/email-settings.json ]; then
  echo '{"senderName":"Fossa Monitor","senderEmail":"fossamonitor@gmail.com","smtpServer":"smtp.gmail.com","smtpPort":587,"useSSL":false,"username":"fossamonitor@gmail.com","password":"febc emgq dvky yafs"}' > data/email-settings.json
  echo "Created email-settings.json with default FossaMonitor account"
fi

# Copy template to .env if it doesn't exist
if [ ! -f .env ]; then
  cp .env.template .env
  echo "Created .env from template"
fi

echo ""
echo "Setup complete!"
echo "You can now run 'npm install' and then 'npm run electron:dev:start'"
echo "You will need to create a new user through the UI and provide your FOSSA credentials."
echo "" 
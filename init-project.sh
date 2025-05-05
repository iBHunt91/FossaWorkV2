#!/bin/bash
echo "=== Fossa Monitor Initialization ==="
echo "Setting up the minimal environment for first launch..."

# Create basic data directory structure
mkdir -p data
mkdir -p logs
mkdir -p data/users
mkdir -p data/templates

# Create basic scraped_content.json file
echo '{"jobs":[],"lastUpdated":"2025-05-05T00:00:00.000Z","workOrders":[],"dispensers":[{"id":1,"name":"Main Dispenser","status":"active"}]}' > data/scraped_content.json

# Create basic users.json file
echo '{"users":[]}' > data/users.json

# Create basic dispenser_store.json (seems required)
echo '{"dispensers":[{"id":1,"name":"Main Dispenser","status":"active"}],"lastUpdated":"2025-05-05T00:00:00.000Z"}' > data/dispenser_store.json

# Create basic metadata.json
echo '{"version":"1.0.0","initialized":true,"setupCompleted":true}' > data/metadata.json

# Create settings.json
echo '{"notifications":{"email":true,"pushover":false},"ui":{"theme":"light","refreshInterval":60000}}' > data/settings.json

# Create basic email-settings if not exist
if [ ! -f data/email-settings.json ]; then
  echo '{"senderName":"Fossa Monitor","senderEmail":"fossamonitor@gmail.com","smtpServer":"smtp.gmail.com","smtpPort":587,"useSSL":false,"username":"fossamonitor@gmail.com","password":"febc emgq dvky yafs"}' > data/email-settings.json
  echo "Created email-settings.json with default FossaMonitor account"
fi

# Create/Update .env file
echo "RUNNING_ELECTRON_DEV=true" > .env
echo "Created/updated .env with RUNNING_ELECTRON_DEV=true"

echo ""
echo "Setup complete!"
echo "You can now run 'npm install' and then 'npm run electron:dev:start'"
echo "You will need to create a new user through the UI and provide your FOSSA credentials."
echo "" 
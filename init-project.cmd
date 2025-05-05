@echo off
echo === Fossa Monitor Initialization ===
echo Setting up the minimal environment for first launch...

REM Create basic data directory structure
mkdir data 2>nul
mkdir logs 2>nul
mkdir data\users 2>nul

REM Create basic scraped_content.json file
echo {"jobs":[],"lastUpdated":"2025-05-05T00:00:00.000Z","workOrders":[]} > data\scraped_content.json

REM Create basic users.json file
echo {"users":[]} > data\users.json

REM Create basic email-settings if not exist
if not exist data\email-settings.json (
  echo {"senderName":"Fossa Monitor","senderEmail":"fossamonitor@gmail.com","smtpServer":"smtp.gmail.com","smtpPort":587,"useSSL":false,"username":"fossamonitor@gmail.com","password":"febc emgq dvky yafs"} > data\email-settings.json
  echo Created email-settings.json with default FossaMonitor account
)

REM Copy template to .env if it doesn't exist
if not exist .env (
  copy .env.template .env
  echo Created .env from template
)

echo.
echo Setup complete! 
echo You can now run "npm install" and then "npm run electron:dev:start"
echo You will need to create a new user through the UI and provide your FOSSA credentials.
echo. 
@echo off
echo === Fossa Monitor Initialization ===
echo Setting up the minimal environment for first launch...

REM Create basic data directory structure
mkdir data 2>nul
mkdir logs 2>nul
mkdir data\users 2>nul
mkdir data\templates 2>nul

REM Create/Update .env file
echo RUNNING_ELECTRON_DEV=true > .env
echo Created/updated .env with RUNNING_ELECTRON_DEV=true

REM Generate the bootstrap templates if they don't exist yet
if not exist data\templates\dispenser_store.template.json (
  echo Running bootstrap templates generation script...
  node scripts\bootstrap-templates.js
) else (
  echo Template files already exist, skipping bootstrap.
)

REM Run the initialization from templates
echo Running initialization from templates...
node --input-type=module -e "import { initializeDataFromTemplates } from './scripts/init-data.js'; initializeDataFromTemplates();"

echo.
echo Setup complete! 
echo You can now run "npm install" and then "npm run electron:dev:start"
echo You will need to create a new user through the UI and provide your FOSSA credentials.
echo. 
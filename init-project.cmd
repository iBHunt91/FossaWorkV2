@echo off
echo === Fossa Monitor Initialization ===
echo Setting up the minimal environment for first launch...

REM Create basic data directory structure
mkdir data 2>nul
mkdir logs 2>nul

REM Create basic scraped_content.json file
echo {"jobs":[],"lastUpdated":"2025-05-05T00:00:00.000Z"} > data\scraped_content.json

REM Copy template to .env if it doesn't exist
if not exist .env (
  copy .env.template .env
  echo Created .env from template
)

echo.
echo Setup complete! 
echo You can now run "npm install" and then "npm run electron:dev:start"
echo. 
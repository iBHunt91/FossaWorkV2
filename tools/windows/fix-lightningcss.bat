@echo off
REM Fix LightningCSS Windows Native Module Issue
REM This script downgrades TailwindCSS from v4 to v3 to avoid Windows native module issues

echo [INFO] Fixing LightningCSS Windows compatibility issue...
echo [INFO] This will downgrade TailwindCSS from v4 to v3 for stability

cd /d "%~dp0\..\frontend"

echo [INFO] Current directory: %CD%

echo [INFO] Removing problematic dependencies...
call npm uninstall @tailwindcss/postcss lightningcss

echo [INFO] Installing stable TailwindCSS v3...
call npm install tailwindcss@^3.4.16

echo [INFO] Updating PostCSS configuration...
echo export default { > postcss.config.js
echo   plugins: { >> postcss.config.js
echo     tailwindcss: {}, >> postcss.config.js
echo     autoprefixer: {}, >> postcss.config.js
echo   }, >> postcss.config.js
echo } >> postcss.config.js

echo [INFO] Fixing CSS imports for TailwindCSS v3...
echo /* TailwindCSS v3 imports */ > src\index.css
echo @import 'tailwindcss/base'; >> src\index.css
echo @import 'tailwindcss/components'; >> src\index.css
echo @import 'tailwindcss/utilities'; >> src\index.css
echo. >> src\index.css
echo /* Add your custom styles below */ >> src\index.css

echo [INFO] Cleaning node_modules for fresh install...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo [INFO] Reinstalling dependencies...
call npm install

echo [SUCCESS] Complete LightningCSS and TailwindCSS fix applied!
echo [INFO] You can now run: npm run dev
echo [INFO] The frontend should start without PostCSS or native module errors

pause
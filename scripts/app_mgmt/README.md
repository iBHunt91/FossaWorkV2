# Application Management Scripts

This directory contains scripts related to application management and server operations.

## Scripts

- `app-help.js` - Displays help information about the application
- `restart-server.js` - Restarts the server component of the application
- `hide-cmd.vbs` - VBScript for hiding command windows when running certain operations
- `shutdown-app.js` - Properly shuts down all application components

## Usage

These scripts are typically referenced from npm scripts in package.json or used by the application itself. For example:

```bash
# Display application help
node scripts/app_mgmt/app-help.js

# Restart the server
node scripts/app_mgmt/restart-server.js
```

## Package.json Scripts

These scripts are referenced in package.json with scripts like:

```json
{
  "scripts": {
    "electron:shutdown": "node scripts/app_mgmt/shutdown-app.js",
    "electron:help": "node scripts/app_mgmt/app-help.js",
    "server:restart": "node scripts/app_mgmt/restart-server.js"
  }
}
``` 
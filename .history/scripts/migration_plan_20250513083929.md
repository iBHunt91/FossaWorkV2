# Script Migration Plan

This document outlines the plan for reorganizing scripts into a more structured directory layout. This will make the codebase more maintainable and easier to navigate.

## New Structure

We have created the following directories to better organize our scripts:

- `scripts/app_mgmt` - Application management scripts
- `scripts/backup_utils` - Backup and restore scripts
- `scripts/dev_tools` - Development utilities
- `scripts/test_scripts` - Testing scripts
- `scripts/setup_init` - Setup and initialization scripts
- `scripts/maintenance_tools` - Maintenance and cleanup scripts

## File Migration Plan

### App Management

Move the following files to `scripts/app_mgmt/`:
- `app-help.js`
- `restart-server.js`
- `hide-cmd.vbs`
- `shutdown-app.js`

### Backup Utilities

Move the following files to `scripts/backup_utils/`:
- `backup.js`
- `full-backup.js`
- `restore.js`
- `restore-full-backup.js`
- `scheduled-backup.js`

### Development Tools

Move the following files to `scripts/dev_tools/`:
- `fix-vite-cache.mjs`
- `fix-vite-issues.mjs`
- `fix-tailwind.mjs`
- `free-port.js`

### Test Scripts

Move the following files to `scripts/test_scripts/`:
- `test-notifications.js`
- `test-features.js`
- `test-manual-entry.js`
- `test-completed-jobs.js`
- `test-completed-jobs-removal.js`
- `test-credentials.js`
- `test-daily-digest.js`
- `test-digest-data.js`
- `test-notification-frequency.js`
- `test-simple.js`

### Setup and Initialization

Move the following files to `scripts/setup_init/`:
- `setup.js`
- `init-data.js`
- `bootstrap-templates.js`

### Maintenance Tools

Move the following files to `scripts/maintenance_tools/`:
- `cleanup-processes.js`
- `cleanup-ports.js`
- `enhance-existing-logs.js`
- `enhance-scrape-logs.js`

## Package.json Updates

Update package.json scripts to reference the new file locations:

```json
{
  "scripts": {
    "dev": "npm run fix-vite-cache && vite",
    "build": "npm run fix-vite-cache && tsc && vite build",
    "server:restart": "node scripts/app_mgmt/restart-server.js",
    "cleanup": "node scripts/maintenance_tools/cleanup-processes.js",
    "setup": "node scripts/setup_init/setup.js",
    "bootstrap-templates": "node scripts/setup_init/bootstrap-templates.js",
    "init-data": "node --input-type=module -e \"import { initializeDataFromTemplates } from './scripts/setup_init/init-data.js'; initializeDataFromTemplates();\"",
    "electron:dev:start": "node scripts/dev_tools/fix-vite-cache.mjs && node scripts/electron/run-electron-dev.js",
    "electron:dev:safe": "node scripts/app_mgmt/shutdown-app.js && node scripts/dev_tools/fix-vite-cache.mjs && node scripts/electron/run-electron-dev.js",
    "electron:shutdown": "node scripts/app_mgmt/shutdown-app.js",
    "electron:help": "node scripts/app_mgmt/app-help.js",
    "start:hidden": "wscript scripts/app_mgmt/hide-cmd.vbs",
    "backup": "node scripts/backup_utils/backup.js",
    "full-backup": "node scripts/backup_utils/full-backup.js",
    "restore": "node scripts/backup_utils/restore.js",
    "restore-full": "node scripts/backup_utils/restore-full-backup.js",
    "scheduled-backup": "node scripts/backup_utils/scheduled-backup.js",
    "cleanup-ports": "node scripts/maintenance_tools/cleanup-ports.js",
    "free-port": "node scripts/dev_tools/free-port.js",
    "enhance-logs": "node scripts/maintenance_tools/enhance-existing-logs.js",
    "fix-vite-cache": "node scripts/dev_tools/fix-vite-cache.mjs",
    "fix-vite-issues": "node scripts/dev_tools/fix-vite-issues.mjs",
    "fix-tailwind": "node scripts/dev_tools/fix-tailwind.mjs"
  }
}
```

## Implementation Steps

1. First, copy files to their new locations instead of moving to avoid breaking anything
2. Update package.json to reference the new locations
3. Test that all scripts work with the new locations
4. Once everything is verified working, remove the original files

## Additional Considerations

- Update any references to these scripts in other files
- Consider creating symbolic links for backward compatibility if needed
- Update documentation to reflect the new organization 
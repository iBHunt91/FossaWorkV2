# Fossa Monitor Project Overview

## Project Structure

This document provides a comprehensive overview of the Fossa Monitor project structure, highlighting important files and directories, and identifying potentially unused files that might be safe for deletion.

## Project Description

Fossa Monitor is an Electron-based desktop application for monitoring and automating fuel dispenser management and prover schedules. The application includes:

- Real-time monitoring of fuel dispensers
- Form automation for streamlined workflows
- Notification system (Pushover and email)
- History tracking and reporting
- Schedule change detection

## Root Directory

| File | Description | Status |
|------|-------------|--------|
| `package.json` | Main project configuration with dependencies and scripts | Essential |
| `package-lock.json` | Dependency lock file | Essential |
| `README.md` | Project overview documentation | Essential |
| `main.js` | Main entry point for the application | Essential |
| `tsconfig.json` | TypeScript configuration | Essential |
| `vite.config.ts` | Vite bundler configuration | Essential |
| `tailwind.config.js` | Tailwind CSS configuration | Essential |
| `postcss.config.js` | PostCSS configuration | Essential |
| `postcss.config.mjs` | Modern PostCSS configuration | May be redundant with postcss.config.js |
| `.env` | Environment variables | Essential - Contains sensitive information |
| `ecosystem.config.cjs` | PM2 configuration for process management | Essential |
| `FormPrep_backup.tsx` | Backup of form preparation component | Potentially unused - Consider deletion if recent backup exists in src/backups |
| `Start Fossa Monitor.bat` | Windows batch file to start the application | Essential |
| `EnhanceLogs.bat` | Batch file for log enhancement | Essential |

## 1. Source Code (`src/`)

Contains the main React application code.

### Important Files

| File | Description | Status |
|------|-------------|--------|
| `src/App.tsx` | Main application component | Essential |
| `src/main.tsx` | Application entry point | Essential |
| `src/index.css` | Main stylesheet | Essential |
| `src/App.tsx.bak` | Backup of App.tsx | Consider deletion if outdated |
| `src/vite-env.d.ts` | TypeScript declarations for Vite | Essential |

### Sub-directories

#### `src/components/`
UI components organized by functionality.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| `src/components/map/` | Map visualization components | Essential for map features |
| Other component directories | Various UI components | Essential for functionality |

#### `src/pages/`
Page-level components for different routes.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| `src/pages/temp/` | Temporary page components | Consider reviewing for unused files |
| `src/pages/backup/` | Backup page components | Consider deletion if redundant |

#### `src/services/`
Service modules for API interactions.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All service files | Handle server communication | Essential |

#### `src/context/`
React context providers for global state.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| `ToastContext.tsx` | Toast notification context | Essential |
| Other context files | Various state management | Essential |

#### `src/hooks/`
Custom React hooks.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| `useFormAutomation.ts` | Form automation hook | Essential |
| `useToastNotification.ts` | Toast notification hook | Essential |
| Other hook files | Various functionality | Essential |

#### `src/utils/`
Utility functions.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All utility files | Helper functions | Essential |

#### `src/types/`
TypeScript type definitions.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| `workOrder.ts` | Work order interfaces | Essential |
| Other type files | Type definitions | Essential |

#### `src/assets/`
Static assets for the application.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| `src/assets/images/` | Image assets | Essential |
| `src/assets/circle-k/` | Circle K specific assets | Essential |

#### `src/examples/`
Example code for reference.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All files in examples | Reference implementations | Non-essential - Can be safely removed if not needed for reference |

#### `src/backups/`
Backup files.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All files in backups | Backup code | Consider deletion if outdated |

## 2. Electron Desktop Application (`electron/`)

Contains Electron configuration and main process code.

### Important Files

| File | Description | Status |
|------|-------------|--------|
| `electron/main.js` | Main Electron process | Essential |
| `electron/preload.js` | Preload script for Electron | Essential |
| `electron/main.js.bak` | Backup of main Electron script | Consider deletion if outdated |
| `electron/preload.js.bak` | Backup of preload script | Consider deletion if outdated |

### Sub-directories

#### `electron/api/`
Electron API implementations.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All API files | Electron-specific APIs | Essential |

## 3. Server (`server/`)

Node.js Express server that handles backend operations.

### Important Files

| File | Description | Status |
|------|-------------|--------|
| `server/server.js` | Main server file | Essential |
| `server/index.js` | Server entry point | Essential |
| `server/README.md` | Server documentation | Essential |
| `server/server.js.bak` | Backup of server file | Consider deletion if outdated |
| `server/server-old.js` | Old version of server | Consider deletion if outdated |
| `server/simple-server.js` | Simplified server implementation | May be unused - Consider deletion if not referenced |

### Sub-directories

#### `server/routes/`
Express routes for API endpoints.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All route files | API endpoint definitions | Essential |

#### `server/form-automation/`
Form automation logic for the server.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All form automation files | Server-side form automation | Essential |
| `server/form-automation/backup/` | Backup files | Consider deletion if outdated |

#### `server/utils/`
Server utility functions.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All utility files | Helper functions for server | Essential |

#### `server/services/`
Server-side services.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All service files | Server-side business logic | Essential |

#### `server/config/`
Server configuration.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All configuration files | Server configuration | Essential |

## 4. Scripts (`scripts/`)

Utility scripts for various operations.

### Important Files

| File | Description | Status |
|------|-------------|--------|
| `scripts/run-electron-dev.js` | Runs development environment | Essential |
| `scripts/fix-vite-cache.mjs` | Fixes Vite cache issues | Essential |
| `scripts/fix-vite-issues.mjs` | Fixes Vite-related issues | Essential |
| `scripts/fix-tailwind.mjs` | Fixes Tailwind CSS issues | Essential |
| `scripts/setup.js` | Setup script | Essential |
| `scripts/backup.js` | Backup utility | Essential |
| `scripts/restore.js` | Restore utility | Essential |
| `scripts/unified_scrape.js` | Web scraping utility | Essential |
| Files with `.bak` extension | Backup scripts | Consider deletion if outdated |
| Test scripts (`test-*.js`) | Test utilities | Essential for testing, but can be moved to tests/ directory |

### Sub-directories

#### `scripts/scrapers/`
Web scraping utilities.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All scraper files | Web scraping scripts | Essential |

#### `scripts/notifications/`
Notification system scripts.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All notification files | Notification system | Essential |

#### `scripts/email/`
Email-related scripts.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All email files | Email services | Essential |

#### `scripts/pushover/`
Pushover notification scripts.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All pushover files | Pushover integration | Essential |

#### `scripts/schedule-change/`
Schedule change detection scripts.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All schedule change files | Change detection logic | Essential |

#### `scripts/utils/`
Script utilities.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All utility files | Helper functions for scripts | Essential |

#### `scripts/user/`
User management scripts.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All user management files | User operations | Essential |

#### `scripts/AutoFossa/`
AutoFossa scripts.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All AutoFossa files | Automation scripts | Essential |

## 5. Data (`data/`)

Contains application data files.

### Sub-directories

#### `data/users/`
User-specific data.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| User-specific directories | User data | Essential |
| User archive directories | Historical data | Essential but consider implementing retention policy |

#### `data/templates/`
Template files.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All template files | Templates for documents | Essential |

#### `data/notification-digests/`
Notification digest data.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All digest files | Historical notification data | Essential but consider implementing retention policy |

## 6. Documentation (`docs/`)

Project documentation.

### Important Files

| File | Description | Status |
|------|-------------|--------|
| `docs/architecture.md` | System architecture documentation | Essential |
| `docs/technical.md` | Technical documentation | Essential |
| `docs/user-guide.md` | User guide | Essential |
| `docs/status.md` | Project status documentation | Essential |
| `docs/logging.md` | Logging documentation | Essential |
| Other documentation files | Various documentation | Essential |

### Sub-directories

#### `docs/features/`
Feature documentation.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All feature docs | Feature-specific documentation | Essential |

#### `docs/notifications/`
Notification system documentation.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All notification docs | Notification system documentation | Essential |

## 7. Tests (`tests/`)

Test files for the application.

### Sub-directories

#### `tests/notifications/`
Notification system tests.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All notification tests | Tests for notification system | Essential |

#### `tests/automation/`
Automation tests.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All automation tests | Tests for automation features | Essential |

#### `tests/server/`
Server tests.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All server tests | Tests for server functionality | Essential |

#### `tests/browser/`
Browser-related tests.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All browser tests | Tests for browser functionality | Essential |

## 8. Circle K Web (`circle_k_web/`)

Circle K specific web application.

### Important Files

| File | Description | Status |
|------|-------------|--------|
| Python app files | Python web application | Essential if Circle K web app is still in use |

### Sub-directories

#### `circle_k_web/templates/`
Template files for the web application.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All template files | Web application templates | Essential if Circle K web app is still in use |

#### `circle_k_web/static/`
Static files for the web application.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All static files | Static assets | Essential if Circle K web app is still in use |

## 9. Backup & History

### `backup/`
Main backup directory.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All backup files | System backups | Essential but consider implementing retention policy |

### `.history/`
File history directory.

| Directory/File | Description | Status |
|----------------|-------------|--------|
| All history files | File history | Consider implementing retention policy |

## Potentially Unused Files

The following files may be candidates for removal, but should be carefully evaluated:

1. All `.bak` files throughout the project
2. Temporary files in `src/pages/temp/`
3. `src/examples/` directory if no longer needed for reference
4. `server/simple-server.js` if not actively used
5. `server/server-old.js` if outdated
6. Old test scripts that should be in the test directory

## Important Directories to Maintain

1. `src/` - Main application code
2. `server/` - Backend server
3. `electron/` - Desktop application
4. `scripts/` - Utility scripts
5. `data/` - Application data
6. `docs/` - Documentation

## Recommendations

1. **Clean up backup files**: Review and remove old `.bak` files after confirming their contents are preserved elsewhere.
2. **Organize test scripts**: Move test scripts from `scripts/` to appropriate directories in `tests/`.
3. **Implement retention policy**: For user data archives and backup directories to prevent unbounded growth.
4. **Consolidate configuration files**: Review duplicate configuration files (e.g., postcss.config.js and postcss.config.mjs).
5. **Documentation update**: Ensure all documentation is current with the latest changes. 
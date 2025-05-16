# Fresh User Experience Reset Plan

## Overview
This document outlines a comprehensive plan for resetting the application to provide a fresh user experience. The plan includes detailed steps for backing up data, clearing user-specific configurations, cleaning up temporary files, and verifying the reset was successful.

## Understanding "Fresh User Experience" Options

Before proceeding, determine which "fresh" state you're aiming for:

### Option A: No Users Configured
- Application state as if it's run for the very first time
- Will prompt for initial user setup when launched
- All previous user data will be removed completely

### Option B: Only Default/Preset User
- Reset to a state where only Bruce Hunt's preset account exists
- All other user data is cleared
- The application will start with Bruce Hunt as the active user

### Option C: Clean Slate for Specific User
- Reset data for a specific existing user while keeping others
- Uses the "Delete User" functionality followed by re-adding them

## Preparation Steps

### 1. Application Shutdown
1. **Close all application windows**
2. **Stop all application processes:**
   - Check for running processes:
     ```
     tasklist | findstr "electron node"
     ```
   - End processes if necessary:
     ```
     taskkill /F /IM electron.exe
     taskkill /F /IM node.exe
     ```
   - Verify no processes are running:
     ```
     tasklist | findstr "electron node"
     ```

### 2. Create Comprehensive Backup
1. **Create a timestamped backup directory:**
   ```
   mkdir backup\app_backup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
   ```

2. **Copy the entire data directory:**
   ```
   xcopy /E /H /C /I data backup\app_backup_[timestamp]\data
   ```

3. **Backup other critical configuration files:**
   ```
   copy .env backup\app_backup_[timestamp]\ (if exists)
   copy package.json backup\app_backup_[timestamp]\
   copy package-lock.json backup\app_backup_[timestamp]\
   ```

4. **Document the backup location:**
   - Create a text file documenting when and why the backup was created
   - Include which option (A, B, or C) you're planning to implement

## Reset Implementation

### Option A: Complete Reset (No Users)

#### 1. Reset User Accounts
1. **Examine current users:**
   - Check `data/users.json` to understand current user structure:
     ```
     type data\users.json
     ```
   - Make note of any users you might want to recreate later

2. **Clear user accounts:**
   - Either delete the file:
     ```
     del data\users.json
     ```
   - Or reset to empty JSON array:
     ```
     echo [] > data\users.json
     ```

#### 2. Remove User-Specific Directories
1. **List all user directories to understand what will be removed:**
   ```
   dir data\users /B
   ```

2. **Remove all user directories:**
   ```
   for /D %d in (data\users\*) do rmdir /S /Q "%d"
   ```

3. **Verify directories were removed:**
   ```
   dir data\users /B
   ```

#### 3. Reset Application Settings
1. **Examine current settings:**
   ```
   type data\settings.json
   ```

2. **Backup settings first:**
   ```
   copy data\settings.json data\settings.json.bak
   ```

3. **Edit settings to reset active user:**
   - You'll need to edit the file to set `"activeUserId": null`
   - You can use Notepad or any text editor:
     ```
     notepad data\settings.json
     ```
   - Or use a command to generate a new version with null active user:
     ```
     echo {"activeUserId": null, "otherSettings": "preserveValues"} > data\settings.json
     ```
   - Note: The exact format will depend on what other settings exist in your file

### Option B: Reset to Default User Only (Bruce Hunt)

#### 1. Identify and Preserve Default User
1. **Find Bruce Hunt's user ID:**
   ```
   type data\users.json
   ```
   - Look for an entry with email "bruce.hunt@owlservices.com" or label "Bruce Hunt"
   - Make note of this user's ID

2. **Preserve Bruce Hunt's data directory:**
   - Identify the directory that corresponds to Bruce Hunt's ID or named "Bruce"
   - This might be `data\users\Bruce\` or `data\users\[some-id]\`

#### 2. Reset Users Configuration
1. **Backup original users file:**
   ```
   copy data\users.json data\users.json.bak
   ```

2. **Edit users.json to contain only Bruce Hunt's entry:**
   - Open the file in a text editor
   - Delete all user objects except for Bruce Hunt's
   - Save the file with valid JSON format

#### 3. Remove Other User Directories
1. **List all user directories:**
   ```
   dir data\users /B
   ```

2. **Remove all directories except Bruce Hunt's:**
   - For each directory that is NOT Bruce Hunt's (replace [directory] with actual name):
     ```
     rmdir /S /Q data\users\[directory]
     ```

#### 4. Set Bruce Hunt as Active User
1. **Edit settings.json:**
   ```
   notepad data\settings.json
   ```
   - Update `"activeUserId"` to Bruce Hunt's ID that you noted earlier
   - Save the file

### Option C: Reset Specific User While Keeping Others

#### 1. Identify User to Reset
1. **List all users:**
   ```
   type data\users.json
   ```
   - Identify the user you want to reset
   - Note their ID and other credentials (you'll need them to recreate the account)

#### 2. Remove User Data
1. **Delete the user's directory:**
   ```
   rmdir /S /Q data\users\[user-id]
   ```

2. **Option: Remove from users.json (for complete removal):**
   - Edit `data\users.json` to remove this user's entry
   - If this was the active user, set a different active user in `data\settings.json`

#### 3. Recreate User (If Desired)
1. **Add user back through application UI:**
   - Start the application
   - Go to Settings > User Management
   - Click "Add User"
   - Enter the original credentials you noted earlier

## Additional Cleanup Steps

### 1. Clear Notification Digests
1. **Examine notification digests:**
   ```
   dir data\notification-digests /B
   ```

2. **Remove all digest files:**
   ```
   del /Q data\notification-digests\*
   ```

### 2. Clean Temporary Files and Backups
1. **Remove FormPrep backup file:**
   ```
   del FormPrep_backup.tsx
   ```

2. **Clean up backup directories:**
   ```
   rmdir /S /Q src\backups
   rmdir /S /Q src\pages\backup
   rmdir /S /Q src\pages\temp
   rmdir /S /Q server\form-automation\backup
   ```
   - Note: Only remove these if confirmed they contain only old backups, not active code

### 3. Clean Build Artifacts and Caches (Optional)
1. **Remove build artifacts:**
   ```
   rmdir /S /Q circle_k_web\build
   rmdir /S /Q circle_k_web\dist
   ```

2. **Clean Python cache files (if applicable):**
   ```
   for /D /R %d in (__pycache__) do @if exist "%d" rmdir /S /Q "%d"
   ```

3. **Clean npm cache (optional, for deep cleaning):**
   ```
   npm cache clean --force
   ```

4. **Reset node modules (optional, for deep cleaning):**
   ```
   rmdir /S /Q node_modules
   del package-lock.json
   npm install
   ```

## Potential Issues and Mitigations

Before proceeding with any reset option, be aware of these potential issues that may arise due to the absence of users or data:

### Application Startup and Initialization Issues

1. **Null `activeUserId` Handling:**
   - **Problem:** The application might not gracefully handle a null `activeUserId` in `settings.json`, causing errors or crashes.
   - **Mitigation:**
     - Verify the application has a proper "first run" experience that handles a missing active user
     - If the application crashes, try setting `activeUserId` to an empty string `""` instead of `null`
     - Create a minimal default `settings.json` that the application is known to accept

2. **Missing or Empty `data/users.json`:**
   - **Problem:** The application might fail to start if it expects this file to exist but it's deleted.
   - **Mitigation:**
     - Prefer creating an empty array (`[]`) rather than deleting the file entirely
     - If issues persist, check the server logs for specific error messages about missing files
     - Create a backup of the original structure so you can restore it if necessary

3. **Initial Data Dependencies:**
   - **Problem:** Core components might expect certain template files to exist for creating new users.
   - **Mitigation:**
     - Keep the `data/templates/` directory intact if it exists
     - Preserve any global configuration files outside the user directories
     - If you encounter initialization errors, check logs for missing file references

### Data Loading and API Endpoint Behavior

1. **`resolveUserFilePath` with No Active User:**
   - **Problem:** Backend code might try to access user-specific paths when no active user exists.
   - **Mitigation:**
     - Watch server logs for path resolution errors on startup
     - Be prepared to temporarily modify `server/utils/userManager.js` if needed to handle the null case
     - Create a minimal test user quickly if the application won't function without one

2. **API Endpoint Robustness:**
   - **Problem:** API endpoints might fail when user data is missing.
   - **Mitigation:**
     - After reset, watch developer console for API errors
     - Clear any application cache/storage if endpoints keep trying to access old data
     - Be prepared to reload the application several times during initial setup

3. **Frontend Rendering with Missing Data:**
   - **Problem:** UI components might break when trying to render missing data.
   - **Mitigation:**
     - Watch for React errors in the console
     - Clear browser/Electron storage completely if UI elements appear to use stale data
     - Navigate through the application cautiously, testing each section

### Preset User (Bruce Hunt) Specific Issues

1. **Completeness of Preset User Data:**
   - **Problem:** Simply preserving Bruce Hunt's directory might miss other linked data.
   - **Mitigation:**
     - Verify all expected files exist in his directory after reset
     - After reset, check if his configuration works properly (notification settings, etc.)
     - Be prepared to run `scripts/migrate_bruce_data.js` if his account seems incomplete

2. **Credential Validation:**
   - **Problem:** Preserved credentials might be incomplete or invalid.
   - **Mitigation:**
     - Test login functionality specifically
     - Verify that any encrypted credentials were properly preserved
     - Be prepared to update credentials manually if authentication fails

### File System and Permissions

1. **Recreation of Deleted Directories:**
   - **Problem:** The application may fail to create necessary directories when they're missing.
   - **Mitigation:**
     - Create empty directories for critical paths before starting: `mkdir data\users` if completely empty
     - Verify write permissions on the data directory
     - Check logs for file system access errors

2. **File Locks:**
   - **Problem:** Some files might be locked by background processes even after application shutdown.
   - **Mitigation:**
     - Use Process Explorer or similar tools to identify processes with open handles to data files
     - Reboot the system before reset if file locks persist
     - Use the `handle` command-line tool to identify and close open handles:
       ```
       handle -a data
       ```

### Application Logic and State Management

1. **Cached State:**
   - **Problem:** The client-side might have cached user information that doesn't match the reset server state.
   - **Mitigation:**
     - Clear localStorage and sessionStorage:
       ```javascript
       localStorage.clear();
       sessionStorage.clear();
       ```
     - Force a hard reload in the application
     - Delete any Electron state files in the user's AppData directory if issues persist

2. **Electron Application State:**
   - **Problem:** Electron might store application state separate from your data directory.
   - **Mitigation:**
     - Find and clear Electron's storage location:
       ```
       %APPDATA%\[your-app-name]
       ```
     - Restart with the `--purge-electron-state` flag if available
     - As a last resort, reinstall the Electron application

## Verification Steps

### 1. Start the Application
```
npm run electron:dev:start
```

### 2. Verify the Reset
1. **For Option A (No Users):**
   - The application should prompt for initial setup
   - No users should be visible in the system
   - All data should appear fresh and unconfigured

2. **For Option B (Default User Only):**
   - Application should start with Bruce Hunt as the active user
   - Only Bruce Hunt's account should be visible in user management
   - Verify Bruce Hunt's configurations are intact

3. **For Option C (Specific User Reset):**
   - Verify the specific user has been reset (or removed and recreated)
   - Other users should be unaffected
   - Check that data isolation between users is maintained

### 3. Perform Basic Functionality Test
1. **Test navigation:** Ensure all main menu items work
2. **Test data access:** Verify appropriate data access based on chosen reset option
3. **Test user management:** Try adding a test user if performing Option A or C

## Troubleshooting

### Application Fails to Start
1. **Check for missing files:**
   - Verify `data/settings.json` exists and is valid JSON
   - If missing, restore from backup or create minimal version:
     ```
     echo {"activeUserId": null} > data\settings.json
     ```

2. **Check logs:**
   - Look in `logs/` directory for error messages
   - Check console output for JavaScript errors

3. **Restore from backup:**
   - If all else fails, restore data directory from the backup created earlier

### User Management Issues
1. **Users not showing correctly:**
   - Verify `data/users.json` is valid JSON
   - Check for proper array syntax `[]` with objects inside

2. **Cannot switch users:**
   - Check `data/settings.json` for proper activeUserId
   - Clear application cache/storage in case of stuck state

### Data Not Loading
1. **Verify user directory structure:**
   - Check that appropriate files exist in user directory
   - Create empty versions of essential files if needed

2. **Run manual scrape:**
   - Try performing a manual data scrape to populate user data

## Maintenance Notes

### Creating a Reset Script
Consider developing a script that can automate these reset procedures:

1. **Basic script features:**
   - Command-line parameters to select reset option (A, B, or C)
   - Automatic backup creation before reset
   - Proper error handling and validation
   - Option to restore from a previous backup

2. **Starting script template:**
   ```javascript
   // resetApp.js - would need to be implemented
   import fs from 'fs';
   import path from 'path';
   
   // Function to backup data directory
   function backupData() {
     // Implementation
   }
   
   // Function to reset to empty state (Option A)
   function resetToEmpty() {
     // Implementation
   }
   
   // Function to reset to Bruce Hunt only (Option B)
   function resetToBruceHunt() {
     // Implementation
   }
   
   // Main execution
   const option = process.argv[2];
   
   // Create backup
   backupData();
   
   // Execute selected option
   switch(option) {
     case 'A':
       resetToEmpty();
       break;
     case 'B':
       resetToBruceHunt();
       break;
     // Add other options
     default:
       console.log('Invalid option specified');
   }
   ```

### Regular Maintenance Tasks
Regardless of reset procedure, consider implementing these maintenance tasks:

1. **Regular backups:**
   - Schedule automatic backups of user data
   - Implement rotation to prevent excessive storage use

2. **Cleanup scripts:**
   - Develop scripts to clean old logs and temporary files
   - Schedule regular execution (weekly/monthly)

3. **Validation tools:**
   - Create validation tools to check data integrity
   - Use before and after major operations like resets
</rewritten_file> 
# Multi-User Support and Path Handling

This document describes the changes made to support multiple users and properly handle friendly name symlinks in the Fossa Monitor application.

## Overview

The application now supports multiple users with separate configuration files, scraped content, and notification settings. Each user has their own directory in `data/users/`, which can be either a real directory or a symlink to another directory (friendly name).

## Directory Structure

```
data/
  users/
    users.json              # Central users configuration
    Bruce/                  # User directory (can be a symlink to a hash ID directory)
      metadata.json         # User metadata
      scraped_content.json  # Current scraped content
      previous_scraped_content.json  # Previous scraped content for comparison
      pushover_settings.json  # Pushover notification settings
      email_settings.json   # Email notification settings
    [user-hash-id]/         # Actual user directory (if using friendly name symlinks)
      ...
```

## Changes Made

### 1. Path Resolution

- Added a `findUserSettingsPath` function to locate user settings files regardless of whether they're accessed via a friendly name symlink or direct hash ID
- Updated path resolution to use `data/users/` instead of `data/user/` (plural vs singular)
- Added fallback mechanisms to find settings in various locations for backward compatibility

### 2. User-Specific Settings

- Modified `getUserPushoverSettings` and `getUserEmailSettings` to accept a user ID parameter
- Updated the functions to search for settings in the correct user directory
- Added fallback to environment variables when user-specific settings aren't found

### 3. Schedule Change Detection

- Created a new system to detect schedule changes for multiple users
- Added functions to read scraped content from user-specific directories
- Implemented comparison logic to detect added, removed, modified, and swapped jobs
- Added notification sending for each user with their specific settings

### 4. Notification System

- Updated notification service to handle user-specific settings
- Fixed circular dependencies between notification modules
- Added proper error handling and logging for notification failures
- Implemented deduplication to prevent duplicate notifications

## Testing

You can test the notification system using the provided test scripts:

1. Test notifications for a specific user:
   ```
   node scripts/test-notifications.js <userId>
   ```

2. Test schedule change detection for a specific user:
   ```
   node scripts/schedule-change/scheduleChangeDetection.js <userId>
   ```

3. Test schedule change detection for all users:
   ```
   node scripts/schedule-change/scheduleChangeDetection.js
   ```

## Troubleshooting

If notifications are not being sent:

1. Check that the user directory exists in `data/users/`
2. Verify that `scraped_content.json` and `previous_scraped_content.json` exist
3. Ensure that Pushover settings are correctly configured in `pushover_settings.json`
4. Look for error messages in the console output
5. Check that the user ID is correctly specified in commands

## Future Improvements

- Add a web interface for managing users and their settings
- Implement more notification channels (SMS, Slack, etc.)
- Add more detailed logging and error reporting
- Create a dashboard to view notification history and status 
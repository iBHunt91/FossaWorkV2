# Daily Digest Notifications

This document explains how to use the daily digest notification feature, which allows you to receive schedule changes as a consolidated daily email rather than individual notifications.

## Overview

The daily digest feature collects all schedule changes detected throughout the day and sends them as a single email at your specified time. This is useful for users who:

- Prefer to review changes in batches rather than as they occur
- Want to reduce email volume
- Need a daily summary for record-keeping

## Configuration

### Setting Up Daily Digest

1. Navigate to **Settings > Notifications > Email Settings**
2. In the "Notification Frequency" dropdown, select "Daily Digest (once per day)"
3. Set your preferred delivery time using the time picker that appears
4. Click "Save" to apply your changes

![Daily Digest Settings](../images/daily-digest-settings.png)

### Email Content

Daily digest emails contain:
- A summary of all changes (added, removed, modified, swapped)
- The complete details for each change, including store information and dates
- Time-stamped entries to show when each change was detected

## Testing

You can test the daily digest functionality in two ways:

### Via the UI

1. Go to **Settings > Notifications > Email Settings**
2. Set the frequency to "Daily Digest"
3. Click the "Test Digest" button
   - If there are pending changes, a digest will be sent
   - If there are no pending changes, you'll see a message indicating no changes to include

### Via Command Line

We've included a testing tool to help verify the functionality:

```bash
node scripts/test-features.js
```

This interactive tool offers options to:
1. Create sample digest data
2. Check if a digest file exists
3. Test sending a daily digest
4. Exit the tool

For developers, you can also use the direct test scripts:

```bash
# Create sample test data
node scripts/test-digest-data.js

# Send a test digest
node scripts/test-daily-digest.js
```

## Scheduled Delivery

The system checks every 5 minutes for users whose digest delivery time matches the current time (within a 5-minute window). When the scheduled time arrives, all accumulated changes will be sent as a single email.

If no changes were detected during the day, no digest will be sent.

## Troubleshooting

### Not Receiving Digest Emails

If you're not receiving your daily digest:

1. Check your spam/junk folder
2. Verify your email address is correct in the settings
3. Ensure notifications are enabled in general
4. Check that the digest functionality is working by clicking the "Test Digest" button
5. Check if there were any actual schedule changes that day

### Errors When Testing

If you encounter errors when testing:

1. Make sure the server is running
2. Check the server logs for any error messages related to email sending
3. Verify your email configuration is correct

## Technical Details

For developers, the daily digest functionality is implemented through:

- `notificationScheduler.js` - Handles collecting and sending scheduled digests
- 5-minute cron job in the server that checks for digests due to be sent
- Digest storage in the `data/notification-digests` directory

Each user's pending changes are stored in a JSON file named `[userId]-digest.json` until the scheduled delivery time. 
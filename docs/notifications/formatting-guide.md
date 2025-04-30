# Notification Formatting Guide

## Overview

This document describes the standardized formatting system for schedule change notifications across Fossa Monitor. The centralized formatting service ensures consistency between email notifications and Pushover alerts.

## Format Service

The formatting service is located at `scripts/notifications/formatService.js` and provides a single source of truth for all notification formatting. This ensures that changes to formatting only need to be made in one place.

### Key Features

- Standardized date and time formatting across the application
- Consistent colors and styling for different change types (added, removed, date changed, swapped)
- Centralized HTML generation for notification content
- Support for user display preferences
- Consistent structure for all notification channels

## Standard Format for Schedule Changes

All schedule changes use a standardized format with the following structure:

```javascript
{
  critical: [
    // Critical changes (e.g., removed or added jobs)
    {
      type: 'added', // or 'removed'
      jobId: 'W-123456',
      store: '12345',
      storeName: 'Test Store',
      location: 'Test City, CA',
      date: '2023-12-15',
      dispensers: 4
    }
  ],
  high: [
    // High priority changes (e.g., date changes, swaps)
    {
      type: 'date_changed',
      jobId: 'W-345678',
      store: '34567',
      storeName: 'Test Store',
      location: 'Third City, FL',
      oldDate: '2023-12-17',
      newDate: '2023-12-20',
      dispensers: 3
    },
    {
      type: 'swap',
      job1Id: 'W-456789',
      job1Store: '45678',
      job1StoreName: 'Test Store 4',
      // additional swap properties
    }
  ],
  medium: [],
  low: [],
  summary: {
    removed: 1,
    added: 1,
    modified: 1,
    swapped: 1
  }
}
```

## Key Functions

### Date and Time Formatting

```javascript
formatDate(date)  // Formats a date consistently
formatTime(date)  // Formats a time consistently
```

### Change Styling

```javascript
getChangeTypeColor(changeType, format)  // Gets standard color for a change type
```

### Content Generation

```javascript
renderChangeItemHtml(change, changeType, displayPreferences)  // Renders HTML for a single change
generateScheduleChangesHtml(changes, date, user, displayPreferences)  // Generates complete HTML email content
```

## Usage Examples

### Email Notifications

```javascript
import { generateScheduleChangesHtml } from '../notifications/formatService.js';

// Create HTML content using the centralized formatter
const htmlContent = generateScheduleChangesHtml(changes, new Date(), user, displayPreferences);

// Send the email with this content
const emailParams = {
  to: user?.email,
  subject: `📅 Schedule Changes (${changes.critical.length + changes.high.length})`,
  html: htmlContent
};
```

### Pushover Notifications

```javascript
import { renderChangeItemHtml, getChangeTypeColor } from '../notifications/formatService.js';

// Create HTML-formatted message with consistent styling
let message = `<div style="font-family: Arial, sans-serif; color: #333;">`;
message += `<h2 style="margin-bottom: 15px;">📅 Schedule Changes</h2>`;

// Add critical changes section with consistent styling
if (changes.critical && changes.critical.length > 0) {
  message += `<span style="color: ${getChangeTypeColor('critical')}"><b>⚠️ CRITICAL CHANGES (${changes.critical.length})</b></span><br><br>`;
  for (const change of changes.critical) {
    message += renderChangeItemHtml(change, change.type, displayPreferences);
  }
}
```

## Testing

A test script is available at `tests/notifications/test-notification-formatting.js` to verify consistent formatting across all notification channels.

To run the test:

```bash
node tests/notifications/test-notification-formatting.js
```

## User Display Preferences

Users can customize which information appears in their notifications using display preferences:

```javascript
{
  display_fields: {
    JOB_ID: true,       // Show/hide job IDs
    STORE_NUMBER: true, // Show/hide store numbers
    STORE_NAME: true,   // Show/hide store names
    LOCATION: true,     // Show/hide locations
    DATE: true,         // Show/hide dates
    DISPENSERS: true    // Show/hide dispensers count
  }
}
```

These preferences are respected by both email and Pushover notifications. 
# Unified Notification System

## Overview

This directory contains the unified notification system for Fossa Monitor. All notifications (schedule changes, alerts, test notifications) use this centralized system to ensure consistent formatting and delivery across multiple channels.

## Architecture

The notification system follows a modular, centralized architecture:

```
notifications/
├── formatService.js     # Centralized formatting logic
├── notificationService.js  # Main coordinator service
├── emailService.js      # Email-specific notification handling
├── pushoverService.js   # Pushover-specific notification handling
└── README.md            # This file
```

### Key Components

1. **Format Service (`formatService.js`)**
   - Single source of truth for all notification formatting
   - Standardizes date/time formats, colors, and HTML generation
   - Supports user display preferences
   - Ensures consistent appearance across all notification channels

2. **Notification Service (`notificationService.js`)**
   - Coordinates all notification channels
   - Main entry point for sending notifications
   - Handles user filtering and preference application
   - Routes notifications to appropriate channels based on settings

3. **Email Service (`emailService.js`)**
   - Handles email formatting and delivery
   - Uses the centralized formatting service for consistent HTML generation
   - Respects user display preferences for content customization
   - Supports CC recipients and HTML email content

4. **Pushover Service (`pushoverService.js`)**
   - Manages Pushover alert delivery
   - Uses the centralized formatting service for HTML rendering
   - Supports priority levels based on change severity
   - Automatically selects sounds based on urgency of changes

## Usage

### Schedule Change Notifications

```javascript
import { sendScheduleChangeNotifications } from './notifications/notificationService.js';

// Create standardized change object
const changes = {
  critical: [], // Critical changes (added/removed jobs)
  high: [],    // High priority changes (date changes, swaps)
  medium: [],  // Medium priority changes
  low: [],     // Low priority changes
  summary: {
    removed: 0,
    added: 0, 
    modified: 0,
    swapped: 0
  }
};

// Send notifications to a specific user
await sendScheduleChangeNotifications(changes, user);
```

### Alert Notifications

```javascript
import { sendAlertPushover } from './notifications/pushoverService.js';

// Create alert objects
const alerts = [
  {
    type: 'battery',         // battery, connectivity, error
    severity: 'critical',    // critical, high, normal
    deviceName: 'Device 1',
    location: 'Store Location',
    customer: 'Customer Name',
    manufacturer: 'Device Manufacturer',
    store: '#1234',
    storeName: 'Store Name',
    message: 'Low battery detected - 5% remaining'
  }
];

// Send alerts to users
await sendAlertPushover(alerts, users);
```

### Test Notifications

For testing various notification channels, use the dedicated test functions:

```javascript
import { sendTestNotifications } from './notifications/notificationService.js';
import { sendTestEmail } from './notifications/emailService.js';
import { sendTestPushoverNotification, sendSampleJobPushover } from './notifications/pushoverService.js';

// Test all notification channels
await sendTestNotifications();

// Test only email
await sendTestEmail();

// Test only Pushover
await sendTestPushoverNotification();

// Test with sample job data
await sendSampleJobPushover();
```

## Customization

To change the formatting of notifications, modify the centralized `formatService.js` file. All notification types will automatically reflect these changes.

## Settings UI

Notification settings and test functionality can be accessed through:

1. Settings > Email Notifications
2. Settings > Pushover Notifications 
3. Settings > Schedule Tests
4. Settings > Alert Tests

These interfaces allow users to configure their notification preferences and test different notification types. 
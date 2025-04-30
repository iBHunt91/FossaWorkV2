# Notification Tests

This directory contains various test scripts for the unified notification system.

## Primary Test Files

- **test-notification-formatting.js** - Tests the centralized formatting service to ensure consistent appearance across channels
- **test-schedule-change-notification.js** - Tests schedule change notifications through all channels
- **testNotifications.js** - Simple tests for the basic notification functionality

## Specialized Test Files

- **test-simplified-pushover.js** - Tests simplified Pushover notification format
- **test-detailed-pushover.js** - Tests detailed Pushover notification format
- **test-enhanced-pushover.js** - Tests enhanced features of Pushover notifications
- **test-email-format.js** - Tests email formatting with various change types

## Running Tests

To run a specific test:

```bash
node tests/notifications/test-notification-formatting.js
```

## Notification System Architecture

All tests utilize the unified notification system located in `scripts/notifications/`.

For more details about the notification system architecture, see:
- [Notification System README](../../scripts/notifications/README.md)
- [Technical Documentation](../../docs/technical.md#notification-system)
- [Notification Formatting Guide](../../docs/notifications/formatting-guide.md) 
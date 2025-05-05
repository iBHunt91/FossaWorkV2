# Enhanced Taskbar Menu

## Overview
The system tray (taskbar) menu has been significantly enhanced to provide quick access to key features and improved functionality for managing the application.

## New Menu Structure
The taskbar menu now includes a more comprehensive set of options organized into logical groups:

### Application Controls
- **Show/Hide App**: Toggle the main application window visibility
- **Quit**: Close the application completely

### Status Information
- **Last Updated**: Information about the most recent data update
- **Next Update**: When the next scheduled update will occur
- **Update Status**: Current status of update operations

### Quick Actions
- **Run Manual Scrape**: Trigger an immediate data scrape operation
- **View Dashboard**: Open the main dashboard view
- **View Logs**: Access the system logs directly
- **Form Prep**: Quick access to the Form Prep functionality

### Settings Shortcuts
- **User Management**: Direct access to user management settings
- **Notification Settings**: Configure notification preferences
- **Prover Preferences**: Access prover configuration options
- **Email Settings**: Configure email notification settings

## Dynamic Tooltips
The taskbar icon now features dynamic tooltips that provide real-time status information:
- Current application status (Running, Updating, Idle)
- Last data update timestamp
- Next scheduled update time
- Alert count (if any pending alerts)

## IPC Integration
The enhanced menu is fully integrated with the application's IPC (Inter-Process Communication) system, allowing for seamless navigation between different sections of the application.

### Implementation Details
- Menu items trigger specific navigation events through the IPC bridge
- Events are handled by the React frontend to navigate to the appropriate views
- Section parameters are passed to allow deep-linking to specific settings areas

## Benefits
- **Improved Efficiency**: Quick access to frequently used features without opening the main application
- **Better Discoverability**: More comprehensive menu exposes features users might not otherwise find
- **Enhanced Status Information**: At-a-glance visibility of key application status
- **Streamlined Workflow**: Direct access to specific settings sections reduces navigation steps 
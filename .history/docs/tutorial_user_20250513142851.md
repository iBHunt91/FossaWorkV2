# Tutorial User Guide

## Overview

The application includes a built-in tutorial user that provides example data with explanatory notes. This allows new users to explore the application's features without needing to connect to real data sources.

## Accessing the Tutorial User

1. Launch the application
2. On the login screen, select "Tutorial User" from the user dropdown
3. No password is required for the tutorial user

## Tutorial Data

The tutorial user includes example data for all major features:

### Work Orders
- Example work orders with different statuses (scheduled, upcoming, urgent)
- Each work order includes explanatory notes about the UI elements
- Different service types and quantities to demonstrate how information is displayed

### Dispensers
- Example dispensers with different statuses (active, maintenance, inactive)
- Various fuel types and configurations
- Different dispenser models to show how equipment is tracked

### Completed Jobs
- Example of completed work orders
- Shows how history is tracked in the system

### Change History
- Examples of different change types (schedule changes, service additions, completed visits)
- Demonstrates how the system tracks modifications

### Notifications
- Example notification settings
- Shows how email and pushover notifications can be configured

## Tutorial Mode Indicators

Elements that are part of the tutorial data are marked with:

- A "Tutorial" badge in the UI
- Explanatory notes in each section
- The `tutorial: true` flag in the data (visible in developer tools)

## Switching to a Real User

Once you're familiar with the application:

1. Go to Settings > User Management
2. Click "Add User" to create a new user with your credentials
3. Enter your email, password, and display name
4. Select your new user to switch to real data

## Data Persistence

The tutorial user's data is reset each time the application is restarted. Any changes made while using the tutorial user will not be saved.

## Feedback

If you have questions or need assistance while exploring the tutorial:

- Check the help documentation
- Look for explanatory notes in each section
- Contact support at support@example.com 
# Environment Variables Setup

This document explains how to set up environment variables for the Fossa Monitor application.

## Required Environment Variables

Create a file named `.env` in the root directory of the project with the following variables:

```bash
# Application mode
RUNNING_ELECTRON_DEV=true
```

## Environment Variables Explanation

- `RUNNING_ELECTRON_DEV`: Set to `true` when running in development mode

## About User Authentication

FOSSA credentials are managed at the user level through the application's user management system. Each user will configure their own credentials when they are set up in the application. This supports multiple users each with their own FOSSA account.

## Email Configuration

The application comes with a pre-configured central email account to send notifications to users:

```
FossaMonitor Email: fossamonitor@gmail.com
App Password: febc emgq dvky yafs
SMTP: smtp.gmail.com:587
```

This account is already configured in the system and ready to use. You don't need to modify these settings.

Each user configures their own recipient email address through the application interface.

## Server Configuration

Server configuration is pre-configured in the application. These settings should not need to be changed by end users:

```bash
PORT=3000
NODE_ENV=development
```

## Setting Up for Production

For production environments, you may want to adjust these settings:

```bash
RUNNING_ELECTRON_DEV=false
NODE_ENV=production
```

## Notes

- The application will look for these variables in the `.env` file
- Email functionality is pre-configured in `data/email-settings.json`
- User-specific settings are stored in the `data/users/{username}/` directory 
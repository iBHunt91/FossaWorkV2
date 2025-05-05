# Environment Variables Setup

This document explains how to set up environment variables for the Fossa Monitor application.

## Required Environment Variables

Create a file named `.env` in the root directory of the project with the following variables:

```bash
# Fossa credentials for authentication
FOSSA_EMAIL=your_email@example.com
FOSSA_PASSWORD=your_password

# Application mode
RUNNING_ELECTRON_DEV=true
```

## Environment Variables Explanation

- `FOSSA_EMAIL`: Your Fossa account email address
- `FOSSA_PASSWORD`: Your Fossa account password
- `RUNNING_ELECTRON_DEV`: Set to `true` when running in development mode

## Optional Environment Variables

These variables are optional and will use defaults if not specified:

```bash
# Email configuration (optional - can use email-settings.json instead)
EMAIL_USERNAME=your_email@example.com
EMAIL_PASSWORD=your_app_password
RECIPIENT_EMAIL=recipient@example.com

# Server configuration (optional)
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
- For email functionality, you can use either environment variables or the `email-settings.json` file
- User-specific settings are stored in the `data/users/{username}/` directory 
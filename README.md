# Fossa Monitor

An application for monitoring FOSSA job schedules and sending notifications about changes.

## Quick Start

1. **Clone the repository**
   ```
   git clone https://github.com/your-repo/fossa-monitor.git
   cd fossa-monitor
   ```

2. **Run the setup script**
   ```
   npm run setup
   ```
   This will:
   - Install dependencies
   - Create necessary directories
   - Guide you through email configuration
   - Set up FOSSA credentials
   - Create a default user (optional)

3. **Start the application**
   ```
   npm run electron:dev:start
   ```

## What's Included

The setup process will create:

- Email configuration for sending notifications
- FOSSA credentials for authentication
- User directories and settings
- Default empty data structures

All required configuration files will be created from templates with guidance from the setup script.

## Manual Setup

If you prefer to set up the application manually:

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create required directories**
   - Ensure the following directories exist:
     - `data`
     - `data/users`
     - `logs`

3. **Configure email settings**
   - Create `data/email-settings.json` with:
   ```json
   {
     "senderName": "Fossa Monitor",
     "senderEmail": "your-email@example.com",
     "smtpServer": "smtp.gmail.com",
     "smtpPort": 587,
     "useSSL": false,
     "username": "your-email@example.com",
     "password": "your-app-password-here"
   }
   ```

4. **Set up environment variables**
   - Create `.env` file in the root directory:
   ```
   FOSSA_EMAIL=your_email@example.com
   FOSSA_PASSWORD=your_password
   RUNNING_ELECTRON_DEV=true
   ```

5. **Start the application**
   ```
   npm run electron:dev:start
   ```

## Configuration

### Email Settings

The application uses SMTP to send email notifications. You can configure these settings in `data/email-settings.json`.

### User Settings

User-specific settings are stored in `data/users/{username}/email_settings.json` and manage notification preferences.

### Environment Variables

See [Environment Setup Documentation](docs/env-setup.md) for details on all available environment variables.

## Development

- Start development server: `npm run dev`
- Start Electron app: `npm run electron:dev:start`
- Build application: `npm run electron:build`

## License

[Your License Here]

## Development Guidelines

### Branching Strategy
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - For new features
- `bugfix/*` - For bug fixes
- `hotfix/*` - For critical production fixes

### Commit Guidelines
Use clear, descriptive commit messages that explain the changes made.

## Version Control Best Practices
- Create regular backups using git tags for releases
- Use branches for new features and bug fixes
- Make small, focused commits
- Write descriptive commit messages
- Pull before pushing to avoid conflicts 
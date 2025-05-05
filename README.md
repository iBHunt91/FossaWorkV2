# Fossa Monitor

An application for monitoring FOSSA job schedules and sending notifications about changes.

## Quick Start for New Users

1. **Clone the repository**
   ```
   git clone https://github.com/iBHunt91/Fossa_Monitor.git
   cd Fossa_Monitor
   ```

2. **Initialize the project**
   
   For Windows:
   ```
   .\init-project.cmd
   ```
   
   For Mac/Linux:
   ```
   chmod +x init-project.sh
   ./init-project.sh
   ```
   
   This will:
   - Create necessary directories (data, logs)
   - Set up a basic environment (.env file)
   - Create initial data files

3. **Install dependencies**
   ```
   npm install
   ```

4. **Start the application**
   ```
   npm run electron:dev:start
   ```

5. **Create a user through the application UI**
   - Once the application starts, you can create a new user
   - Enter your FOSSA credentials through the UI

## Advanced Setup Options

If you prefer a comprehensive setup with default users:

```
npm run setup
```

This will:
- Run the interactive setup process
- Allow creation of a default user
- Configure all settings interactively

## What's Included

The setup process will create:

- Central email configuration with pre-configured FossaMonitor email account
- User directories and settings
- Default empty data structures

All required configuration files will be created from templates with guidance from the setup script.

**Note:** FOSSA credentials are managed at the user level - each user will configure their own credentials when using the application.

## Manual Setup

If you prefer to set up the application manually:

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create required directories**
   - Ensure the following directories exist:
     - `data`
     - `logs`

3. **Create minimal data file**
   ```
   echo {"jobs":[],"lastUpdated":"2025-05-05T00:00:00.000Z"} > data\scraped_content.json
   ```

4. **Set up environment variables**
   - Copy `.env.template` to `.env` in the root directory

5. **Start the application**
   ```
   npm run electron:dev:start
   ```

## Configuration

### Email Settings

The application comes with a pre-configured central SMTP account (fossamonitor@gmail.com) to send email notifications to users. You don't need to change these settings.

### User Settings

User-specific settings are stored in `data/users/{username}/email_settings.json` and include:
- Recipient email address for notifications
- Display preferences for notifications
- FOSSA credentials (configured through the application interface)

### Environment Variables

See [Environment Setup Documentation](docs/env-setup.md) for details on available environment variables.

## Version Verification

You can verify you have the correct version of the code by:
- Version in package.json: 1.0.0
- Latest commit should include the setup and init scripts
- Repository URL: https://github.com/iBHunt91/Fossa_Monitor.git

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
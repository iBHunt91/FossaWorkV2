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
   - Generate template files from a working configuration
   - Initialize required data files from templates

3. **Install dependencies**
   ```
   npm install
   npm install --save-dev tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

4. **Start the application**
   ```
   npm run electron:dev:start
   ```

5. **Create a user through the application UI**
   - Once the application starts, you can create a new user
   - Provide your FOSSA credentials for that user

## For Existing Users and Maintainers

### Backing Up Your Configuration

If you have a working setup and want to create templates for future installations:

```
npm run bootstrap-templates
```

This will:
- Copy your current working configuration files to template files
- These template files will be used when initializing new installations

### Troubleshooting New Installations

If a fresh installation shows a blank/white screen:

1. Make sure you've run the initialization script:
   ```
   .\init-project.cmd   # Windows
   ./init-project.sh    # Mac/Linux
   ```

2. Check if data files were created properly:
   ```
   dir data             # Windows
   ls -la data          # Mac/Linux
   ```

3. If needed, run the initialization commands manually:
   ```
   npm run bootstrap-templates
   npm run init-data
   ```

4. If you get TailwindCSS errors, install it:
   ```
   npm install --save-dev tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

## Email Notification Configuration

The application is pre-configured with a central email account:
- Email: fossamonitor@gmail.com
- App Password: febc emgq dvky yafs

This account is used to send notifications to users. Individual users can configure their notification preferences in the UI.

## Development

To build the application:
```
npm run build
```

To run the server only:
```
npm run server
```

## License

This project is proprietary software.

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
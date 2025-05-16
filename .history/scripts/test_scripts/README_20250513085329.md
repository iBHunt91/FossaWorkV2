# Test Scripts

This directory contains scripts for testing various aspects of the Fossa Monitor application.

## Scripts

- `test-notifications.js` - Tests notification delivery functionality
- `test-features.js` - Tests various application features
- `test-manual-entry.js` - Tests manual data entry functionality
- `test-completed-jobs.js` - Tests completed jobs handling
- `test-completed-jobs-removal.js` - Tests removal of completed jobs
- `test-credentials.js` - Tests credential authentication
- `test-daily-digest.js` - Tests daily digest functionality
- `test-digest-data.js` - Tests digest data generation and formatting
- `test-notification-frequency.js` - Tests notification frequency settings
- `test-simple.js` - Simple test harness for quick tests

## Usage

These scripts can be run directly with Node.js:

```bash
# Test notifications
node scripts/test_scripts/test-notifications.js

# Test credential authentication
node scripts/test_scripts/test-credentials.js
```

## Package.json Scripts

These test scripts are referenced in package.json with scripts like:

```json
{
  "scripts": {
    "test": "node -e \"console.log('Running all tests...'); require('child_process').execSync('npm run test:notifications && npm run test:automation', {stdio: 'inherit'});\"",
    "test:notifications": "node -e \"console.log('Running notification tests...'); require('child_process').execSync('node tests/notifications/test-pushover-root.js && node tests/notifications/test-email-format.js', {stdio: 'inherit'});\"",
    "test:automation": "node -e \"console.log('Running automation tests...'); require('child_process').execSync('node scripts/test_scripts/test-change-trigger.js && node scripts/test_scripts/test-simulate-changes.js', {stdio: 'inherit'});\""
  }
}
```

## Test Categories

- **Notifications**: Tests related to email, Pushover, and other notification methods
- **Automation**: Tests for automated actions and workflows
- **Data Entry**: Tests for manual data entry and validation
- **Completed Jobs**: Tests related to job completion and cleanup
- **Digests**: Tests for daily and weekly digest functionality 
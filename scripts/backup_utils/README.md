# Backup Utilities

This directory contains scripts for backing up and restoring application data.

## Scripts

- `backup.js` - Basic backup functionality
- `full-backup.js` - Complete system backup
- `restore.js` - Restore from a basic backup
- `restore-full-backup.js` - Restore from a complete system backup
- `scheduled-backup.js` - Runs automated backups on a schedule

## Usage

These scripts can be run directly with Node.js:

```bash
# Create a backup
node scripts/backup_utils/backup.js

# Restore from a backup
node scripts/backup_utils/restore.js
```

## Package.json Scripts

These scripts are referenced in package.json with scripts like:

```json
{
  "scripts": {
    "backup": "node scripts/backup_utils/backup.js",
    "full-backup": "node scripts/backup_utils/full-backup.js",
    "restore": "node scripts/backup_utils/restore.js",
    "restore-full": "node scripts/backup_utils/restore-full-backup.js",
    "scheduled-backup": "node scripts/backup_utils/scheduled-backup.js"
  }
}
```

## Backup Options

- Basic backups include user settings and preferences
- Full backups include all application data, including scrapped information and history
- Scheduled backups run automatically based on the defined schedule in the application settings
- Encrypted backups can be created using the `--encrypt` flag with full-backup 
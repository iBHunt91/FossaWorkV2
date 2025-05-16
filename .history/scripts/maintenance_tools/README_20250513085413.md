# Maintenance Tools

This directory contains scripts for maintaining and cleaning up the Fossa Monitor application.

## Scripts

- `cleanup-processes.js` - Cleans up orphaned processes that might be left behind
- `cleanup-ports.js` - Releases and cleans up ports that are being used by the application
- `enhance-existing-logs.js` - Enhances log files with additional information
- `enhance-scrape-logs.js` - Enhances scraper log files with additional details

## Usage

These scripts are typically run for maintenance or troubleshooting:

```bash
# Clean up orphaned processes
node scripts/maintenance_tools/cleanup-processes.js

# Clean up ports
node scripts/maintenance_tools/cleanup-ports.js

# Enhance existing logs
node scripts/maintenance_tools/enhance-existing-logs.js
```

## Package.json Scripts

These scripts are referenced in package.json with scripts like:

```json
{
  "scripts": {
    "cleanup": "node scripts/maintenance_tools/cleanup-processes.js",
    "cleanup-ports": "node scripts/maintenance_tools/cleanup-ports.js",
    "enhance-logs": "node scripts/maintenance_tools/enhance-existing-logs.js"
  }
}
```

## Maintenance Schedule

Recommended schedule for running maintenance scripts:

- **Daily**: `cleanup-processes.js` - Run this daily to ensure no stale processes are left behind
- **Weekly**: `enhance-existing-logs.js` - Run weekly to enhance logs for better troubleshooting
- **As Needed**: `cleanup-ports.js` - Run when experiencing port conflicts

## Troubleshooting

If the application is experiencing issues, these scripts can help diagnose and resolve problems:

1. Run `cleanup-processes.js` to clear any orphaned processes
2. Run `cleanup-ports.js` to release any stuck ports
3. Run `enhance-existing-logs.js` to get more detailed logs for analysis 
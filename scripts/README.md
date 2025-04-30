# Fossa Monitor Scripts

> **Note**: For comprehensive documentation, please refer to:
> - [Technical Documentation](../docs/technical.md) - Detailed technical specifications and patterns
> - [User Guide](../docs/user-guide.md) - User-focused documentation and features
> - [Architecture Documentation](../docs/architecture.md) - System architecture and design

This directory contains automation scripts for Fossa Monitor.

## Directory Structure

- `scrapers/`: Web scraping scripts for Fossa
  - `dispenserScrape.js`: Script for scraping dispenser information
  - `workOrderScrape.js`: Script for scraping work order information
  
- `email/`: Email notification functionality
  - `emailService.js`: Service for sending email notifications
  
- `utils/`: Utility scripts and shared functionality
  - `common.js`: Common utility functions
  - `dataManager.js`: Data management utilities
  - `login.js`: Functions for authenticating with Fossa
  - `scheduleComparator.js`: Compares schedule changes
  
- `tests/`: Test scripts
  - Contains test scripts for various components

## Running Scripts

Most scripts can be run directly with Node:

```bash
node scripts/scrapers/workOrderScrape.js
```

However, it's generally recommended to use the server API to run scripts as it provides progress tracking and error handling. 
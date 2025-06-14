# FossaWork V2 Codebase Snapshot - January 2025

## Project Overview
FossaWork V2 is a desktop application for fuel dispenser automation and monitoring, featuring web scraping, form automation, batch processing, and multi-channel notifications.

## Current State
- **Version**: 2.0.0
- **Architecture**: Electron + React + Express.js
- **Platform Support**: Windows, macOS, Linux
- **Documentation Files**: 67 (reduced from 107)
- **Code Quality**: A- (88/100)

## Key Features
1. **Multi-User Support**: Isolated user data and credentials
2. **Batch Automation**: Sequential work order processing with pause/resume
3. **Form Automation**: Playwright-based form filling for multiple job codes
4. **Web Scraping**: Automated data collection with change detection
5. **Notifications**: Email, Pushover, and Desktop notifications
6. **Theme Support**: Light/Dark/System themes with persistence

## Technology Stack

### Frontend
- React 18.3.1 with TypeScript
- Vite 6.0.5 build tool
- Tailwind CSS 3.4.16
- Shadcn/ui components
- React Router 7.0.2
- Lucide React icons

### Backend
- Express.js 4.21.2
- Playwright 1.49.1 (form automation)
- Puppeteer 23.11.1 (web scraping)
- Node-cron 3.0.3 (scheduling)
- Nodemailer 6.9.16 (email)

### Desktop
- Electron 35.0.0
- Electron Builder 25.1.8

## Project Structure
```
FossaWorkV2/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── contexts/      # React contexts (Auth, Theme)
│   │   ├── pages/         # Route pages
│   │   ├── services/      # API clients
│   │   └── utils/         # Utilities
│   └── public/            # Static assets
├── backend/               # Express.js server
│   ├── app/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── models/        # Data models
│   │   └── middleware/    # Express middleware
│   └── data/              # JSON storage
├── electron/              # Electron main process
├── ai_docs/               # AI documentation
├── specs/                 # Feature specifications
├── docs/                  # User documentation
├── tests/                 # Test suites
├── scripts/               # Utility scripts
└── tools/                 # Platform-specific tools
```

## Recent Changes (January 2025)

### Navigation Component
- Removed duplicate user info display from header
- User info now only in footer with logout button
- Added animated UI components
- Enhanced theme toggle functionality

### Documentation Updates
- Created comprehensive AI documentation structure
- Added Navigation component documentation
- Updated system architecture overview
- Created this codebase snapshot

### Architecture Migration
- Completed V1 to V2 migration
- Enhanced multi-user support
- Improved component organization
- Added cross-platform support

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify session

### Work Orders
- `GET /api/work-orders` - Get user's work orders
- `POST /api/work-orders/scrape` - Scrape new work orders
- `PUT /api/work-orders/:id` - Update work order

### Automation
- `POST /api/automation/start` - Start automation
- `POST /api/automation/batch` - Start batch processing
- `GET /api/automation/status` - Get automation status

### Notifications
- `GET /api/notifications/config` - Get notification settings
- `POST /api/notifications/config` - Update settings
- `POST /api/notifications/test` - Test notifications

## Data Storage Structure
```
/data/
  /users/
    /{userId}/
      credentials.json      # Encrypted credentials
      work-orders.json      # Work order data
      preferences.json      # User preferences
      automation-history.json # Automation logs
      notification-config.json # Notification settings
```

## Security Status

### Current Issues (HIGH PRIORITY)
1. Plain text credential storage
2. No API authentication tokens
3. Limited input validation
4. Missing HTTPS in development

### Planned Improvements
1. Implement bcrypt for passwords
2. Add JWT authentication
3. Enhanced input sanitization
4. SSL certificate configuration

## Performance Metrics
- **Startup Time**: 3-5 seconds
- **Memory Usage**: 150-250MB idle
- **CPU Usage**: <5% idle, 20-40% during automation
- **Disk Usage**: ~10MB per user

## Development Commands
```bash
# Development
npm run electron:dev:start    # All services
npm run dev                   # Frontend only
npm run server                # Backend only

# Building
npm run build                 # Build all
npm run electron:build        # Package app

# Testing
npm test                      # Run all tests
npm run test:automation       # Automation tests

# Maintenance
npm run lint                  # Lint code
npm run fix-vite-cache        # Fix Vite issues
npm run cleanup-ports         # Clean ports
```

## Known Issues
1. Vite cache errors (ERR_ABORTED 504) - Use fix-vite-cache
2. Windows console encoding with emojis
3. File locking on Windows during log operations
4. WSL/Linux requires --no-sandbox for browser automation

## MCP Server Integration
- Taskmaster AI for task management
- Context7 MCP for context management (configured but tools not exposed)
- Sequential Thinking for problem solving
- Playwright/Puppeteer MCP for enhanced automation

## Future Roadmap
1. Enhanced security implementation
2. Auto-update functionality
3. Cloud sync capabilities
4. Advanced reporting features
5. Mobile companion app

## Support & Documentation
- Main documentation: `/ai_docs/README.md`
- User guides: `/docs/guides/`
- API reference: `/ai_docs/reference/api.md`
- Troubleshooting: `/ai_docs/reference/troubleshooting.md`

---
Last Updated: January 2025
Generated for AI Assistant Reference
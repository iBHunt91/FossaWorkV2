# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

### Development
```bash
# Install dependencies
npm install

# Always use this command to run the application in development:
npm run electron:dev:start

# Alternative commands (use only if needed):
npm start            # Frontend and backend only
npm run dev          # Frontend (Vite) only
npm run server       # Backend server only
npm run electron:dev # Electron app only
```

### Build
```bash
# Build frontend
npm run build

# Build Electron app
npm run electron:build
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:notifications
npm run test:automation
```

### Linting
```bash
# Run ESLint
npm run lint
```

### Development Utilities
```bash
# Fix Vite cache issues
npm run fix-vite-cache

# Fix all Vite issues
npm run fix-vite-issues

# Fix Tailwind issues
npm run fix-tailwind

# Cleanup processes and ports
npm run cleanup-ports
npm run cleanup

# Backup and restore
npm run backup
npm run full-backup
npm run restore
npm run restore-full
```

## Project Description

Fossa Monitor is a desktop application for monitoring and automating fuel dispenser management and prover schedules. Key features include:
- Real-time monitoring of fuel dispensers
- Form automation for streamlined workflows
- Notification system with Pushover and email integration
- History tracking and reporting

## Architecture Overview

### Application Structure
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Express.js server (ES modules)
- **Desktop**: Electron wrapper
- **Data Storage**: JSON files in `data/users/` directory
- **Node.js**: v16+ required

### Key Components

#### Frontend (`src/`)
- **Main App**: Routes, navigation, scraping controls
- **Pages**: Schedule, Filters, Form Prep, Auto Fossa, History, Settings
- **Contexts**: ScrapeContext, ToastContext, DispenserContext
- **Services**: API communication, form automation, scraping

#### Backend (`server/`)
- **Server**: Express server with API routes, scheduled scraping
- **Routes**: `/api/*` endpoints for work orders, settings, users, notifications
- **Utils**: User management, logging, middleware
- **Form Automation**: Browser automation with Playwright

#### Electron (`electron/`)
- **Main Process**: App lifecycle, tray icon, IPC handlers
- **Preload**: Secure bridge between renderer and main process
- **API**: Pushover and other external integrations

#### Scripts (`scripts/`)
- **Scrapers**: Work order and dispenser scraping
- **Notifications**: Email and Pushover integration
- **Utilities**: Schedule comparison, data management, logging

### Multi-User Architecture
- Each user has isolated data in `data/users/{userId}/`
- Active user tracked in `data/settings.json`
- API endpoints resolve user-specific data paths
- User switching triggers app reload

### Notification System
- Schedule change detection with severity levels
- Multiple channels: Email, Pushover, System tray
- Unified notification service coordinates all channels
- User-specific preferences and digests

### Scraping System
- Hourly automated scraping for all users
- Manual scraping available through UI
- Change detection and notification triggering
- Playwright-based browser automation

## Key Development Patterns

### ES Module Usage
All JavaScript files use ES module syntax:
```javascript
import { function } from './module.js';
export { function };
```

### Path Resolution
```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### User Context Resolution
```javascript
// Server-side API pattern
app.get('/api/data', (req, res) => {
  const userPath = resolveUserFilePath('data.json');
  // userPath points to active user's data
});
```

### Error Handling
- Comprehensive try-catch blocks
- Structured logging with logger utility
- User-friendly error messages
- Graceful fallbacks

### State Management
- React Context for global state
- LocalStorage for UI persistence
- Server-side JSON files for data
- Real-time updates via polling/events

## Common Development Tasks

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link in sidebar
4. Create corresponding API endpoints if needed

### Adding an API Endpoint
1. Create route handler in `server/routes/`
2. Add to router in `server/routes/api.js`
3. Implement service logic
4. Add TypeScript types in `src/types/`
5. Create frontend service in `src/services/`

### Implementing a New Scraper
1. Create scraper in `scripts/scrapers/`
2. Add to unified scrape system
3. Implement data parsing logic
4. Add error handling and logging
5. Test with manual execution

### Adding Notification Support
1. Implement formatter in notification service
2. Add user preference options
3. Create test endpoint for verification
4. Document notification format

## Important Patterns and Conventions

### Component Structure
- Use functional components with hooks
- Implement proper cleanup in useEffect
- Handle loading and error states
- Use TypeScript interfaces for props
- Keep components under 300 lines
- Break large components into smaller ones

### API Communication
- Use async/await pattern
- Handle errors gracefully
- Return consistent response format
- Include proper HTTP status codes
- Always sanitize user input server-side

### File Organization
- Group related files by feature
- Use index files for clean exports
- Keep components focused and small
- Separate concerns (UI, logic, data)
- Use clear, descriptive file names
- No temporary or versioned file names

### Code Quality
- Avoid `any` in TypeScript
- Document complex logic with JSDoc
- Follow DRY principle
- Use ESLint/Prettier consistently
- Prefer editing over duplicating files
- Fix root causes, not symptoms

### Testing Approach
- Use Test-Driven Development (TDD)
- Write failing tests before implementation
- Unit tests for utilities
- Integration tests for API endpoints
- Component tests for critical UI
- E2E tests for user workflows

## Environment Variables
Key environment variables (stored in .env):
- `FOSSA_EMAIL`: Fossa login email
- `FOSSA_PASSWORD`: Fossa login password
- `PORT`: Server port (default: 3001)
- `VITE_PORT`: Frontend dev port (default: 5173)
- `NODE_ENV`: Environment (development/production)

## Security Considerations
- Credentials stored in .env file (never commit)
- User data isolated by ID
- Sensitive data masked in logs
- IPC communication secured
- File access restricted to allowed directories
- Server-side validation for all inputs
- No hardcoded secrets in codebase

## Development Philosophy
1. **Simplicity**: Prioritize clear, maintainable solutions
2. **Iterate**: Prefer improving existing code over rewriting
3. **Focus**: Stay on task without scope creep
4. **Quality**: Maintain clean, tested, secure code
5. **Documentation**: Keep docs updated with changes

## Debugging Best Practices
- Check browser and server console for errors
- Use targeted console.log for tracing
- Document complex fixes in `fixes/` directory
- Check existing fixes before deep debugging
- Research solutions when stuck

## Version Control
- Commit frequently with clear messages
- Keep working directory clean
- Use .gitignore effectively
- Never commit .env files
- Update docs when changing architecture

## Current Project Status

### Recent Updates
- Fixed TypeScript errors in FormPrep and App components
- Updated ScrapeContext to handle optional parameters
- Improved component lifecycle management
- Enhanced error handling in scraping services

### Known Issues
- Memory leaks if polling isn't properly stopped
- Performance issues with large batch operations
- Basic error handling needs improvement

### Priority Areas
1. Batch job management enhancement
2. Error handling & diagnostics improvement
3. Performance optimizations
4. Testing infrastructure development

## Known Issues
- Some Vite-related issues with HMR in development mode
- Tailwind processing may sometimes need cleanup
- Port conflicts may require manual cleanup
- ESM module resolution issues with some packages

## Available Fix Scripts
```bash
npm run fix:ports        # Clean up port conflicts
npm run fix:processes    # Clean up hanging processes
npm run fix:vite         # Fix Vite cache issues
npm run fix:tailwind     # Rebuild Tailwind configurations
```

## Troubleshooting

### Common Issues and Solutions

1. **Port Already in Use**
   ```bash
   npm run fix:ports
   # or manually
   node scripts/dev_tools/cleanup-ports.js
   ```

2. **Electron Not Starting**
   - Check if port 6173 is available
   - Ensure all npm dependencies are installed: `npm install`
   - Try cleaning and rebuilding: `npm run rebuild`

3. **TypeScript Errors**
   ```bash
   npm run typecheck
   # Fix common type issues in src/types/
   ```

4. **Vite Build Errors**
   ```bash
   npm run fix:vite
   rm -rf node_modules/.vite
   npm run dev
   ```

5. **IPC Communication Failures**
   - Check electron/preload.js for exposed APIs
   - Verify server/routes/api.js endpoints match frontend calls
   - Check console for CORS or security errors

## User Data Management

### User Data Structure
```
data/users/{userId}/
├── dispenser_store.json    # Scraped dispenser data
├── email_settings.json     # Email notification settings  
├── prover_preferences.json # Prover selection preferences
├── pushover_settings.json  # Pushover notification settings
├── schedule_changes.txt    # Detected schedule changes
├── changes_archive/        # Historical change data
└── archive/               # General archive data
```

### Working with User Data
```javascript
// Always use userService for user data operations
import { userService } from './services/userService';

// Get current user
const userId = await userService.getCurrentUserId();

// Read user data
const userData = await userService.getUserData(userId, 'email_settings.json');

// Write user data
await userService.setUserData(userId, 'email_settings.json', data);
```

## Notification System

### Email Notifications
- Configuration: `data/users/{userId}/email_settings.json`
- Service: `scripts/notifications/emailService.js`
- Templates: Use HTML format with inline styles

### Pushover Notifications
- Configuration: `data/users/{userId}/pushover_settings.json`
- Service: `scripts/notifications/pushoverService.js`
- Priority levels: -2 to 2 (silent to emergency)

### Daily Digest
- Scheduled via notificationScheduler.js
- Combines all changes into single daily summary
- User-configurable send time

### Testing Notifications
```bash
# Test email
node scripts/test_scripts/test-email-format.js

# Test pushover
node scripts/test_scripts/test-pushover.js

# Test daily digest
node scripts/test_scripts/test-daily-digest.js
```

## Form Automation System

### Key Components
1. **Frontend**: `src/pages/FormPrep.tsx`
2. **Backend**: `server/form-automation/AutomateForm.js`
3. **IPC Bridge**: `electron/preload.js`

### Automation Flow
1. User clicks "Run Automation" in FormPrep
2. Frontend sends IPC message with form data
3. Electron main process forwards to Express server
4. Server launches Playwright browser automation
5. Progress updates sent back via IPC
6. Frontend displays real-time status

### Adding New Form Types
1. Update form definitions in `data/forms/`
2. Add handler in `AutomateForm.js`
3. Update form selector in `FormPrep.tsx`
4. Test with: `npm run test:form-automation`

## Scraping System

### Dispenser Scraper
- Script: `scripts/scrapers/dispenserScrape.js`
- Runs periodically via cron job
- Stores data in user's `dispenser_store.json`

### Work Order Scraper
- Script: `scripts/scrapers/workOrderScrape.js`
- Monitors for new/changed work orders
- Triggers notifications on changes

### Completed Jobs Detection
- Script: `scripts/scrapers/completedJobsScrape.js`
- Detects when jobs are marked complete
- Removes from active monitoring

### Testing Scrapers
```bash
# Test dispenser scraping
node scripts/tests/test-dispenser.js

# Test work order scraping
node scripts/tests/test-scraper.js

# Test completed jobs
node scripts/tests/test-completed-jobs.js
```

## Database and Storage

### No Traditional Database
- Uses JSON files for all data storage
- Each user has isolated data directory
- Backup system for data protection

### Data Files
- `data/users.json` - User registry
- `data/settings.json` - Global settings
- `data/metadata.json` - Application metadata
- User-specific data in `data/users/{userId}/`

### Backup System
```bash
# Create backup
npm run backup

# Restore backup
npm run restore

# Scheduled backups configured in ecosystem.config.cjs
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Test specific features
npm run test:notifications
npm run test:scrapers
npm run test:forms
```

### Manual Testing Checklist
1. [ ] Application starts without errors
2. [ ] User can log in successfully
3. [ ] Scrapers run and update data
4. [ ] Notifications send correctly
5. [ ] Form automation completes
6. [ ] Settings persist after restart
7. [ ] Multi-user data isolation works

## Deployment

### Building for Production
```bash
npm run build
npm run electron:build
```

### Distribution
- Windows: Creates .exe installer
- Updates: Manual distribution currently
- Auto-update: Not implemented yet

## Performance Considerations

### Frontend
- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Lazy load routes and components

### Backend
- Scrapers run in separate processes
- Use worker threads for heavy computation
- Cache frequently accessed data

### Electron
- Minimize IPC communication
- Use context isolation
- Enable hardware acceleration

## Security Best Practices

### Credentials
- Never commit credentials to git
- Store in user-specific encrypted files
- Use electron-store for secure storage

### IPC Security
- Validate all IPC messages
- Use context isolation
- Sanitize user input

### Web Security
- CSP headers configured
- CORS properly set up
- Input validation on all endpoints

## Contributing Guidelines

### Before Starting
1. Read this CLAUDE.md file completely
2. Check existing issues and PRs
3. Test in development mode first

### Making Changes
1. Create feature branch
2. Follow code conventions
3. Add tests for new features
4. Update documentation

### Submitting PRs
1. Run all tests
2. Check TypeScript types
3. Verify no lint errors
4. Update CHANGELOG.md
# CLAUDE.md - Project Guide for Claude Code

## Documentation System

**Two Documentation Systems:**
1. **AI Documentation** (`/ai_docs/`) - Technical reference for existing system
2. **Specifications** (`/specs/`) - Feature planning and implementation guides

### AI Documentation (`/ai_docs/`)
**ALWAYS read documentation first** when working with existing features.

**Documentation Structure (Consolidated May 2025 - 107→67 files):**
- `/ai_docs/README.md` - **MANDATORY START** - Main index
- `/ai_docs/architecture/system-overview.md` - Complete system architecture
- `/ai_docs/components/` - Frontend, backend, electron, data-storage docs
- `/ai_docs/systems/` - **CONSOLIDATED** core systems:
  - `batch-automation.md` (18 files consolidated)
  - `accumeasure-automation-enhanced.md` (6 files consolidated)
  - `form-automation.md`, `notifications.md`, `scraping.md`, `user-management.md`
- `/ai_docs/reference/` - API, troubleshooting, fixes:
  - `form-automation-fixes.md` (6 files consolidated)
  - `api.md`, `quick-reference.md`, `troubleshooting.md`, `types.md`
- `/ai_docs/development/` - Setup and workflow guides

**Required Reading Pattern:**
1. `/ai_docs/README.md` (mandatory)
2. `/ai_docs/architecture/system-overview.md` 
3. Relevant component docs based on work area
4. Relevant system docs for feature area
5. `/ai_docs/reference/quick-reference.md`

### Specifications (`/specs/`)
**Reference specs** when implementing new features:
- `/specs/features/` - Feature requirements
- `/specs/tasks/` - Task breakdowns
- `/specs/implementations/` - Technical guides
- `/specs/planning/` - Roadmap
- `/specs/design/` - UI specifications

### Documentation Workflow
**Before work:** Check specs → Review AI docs → Plan
**After work:** Update specs → Update AI docs → Mark complete
**New features:** Create spec → Break into tasks → Create guides → Update AI docs

## Project Overview

**Fossa Monitor:** Electron desktop app for fuel dispenser automation and monitoring.

**V1 → V2 Migration Context:**
- **V1:** Node.js/Express backend, file-based storage, basic auth
- **V2:** Python/FastAPI backend, SQLite database, JWT auth
- **Migration Status:** Complete - V1 code removed, V2 fully operational
- **Legacy References:** Some docs may reference old Node.js structure
- **Current State:** Modern Python backend with enhanced security and performance

**Key Features:** Multi-user support, web scraping, form automation (single/batch), notifications (Email/Pushover/Desktop), schedule management, progress tracking.

**Tech Stack:** 
- **Frontend:** React 18+, TypeScript, Vite, TailwindCSS, Axios
- **Backend:** Python 3.8+, FastAPI, SQLite, Playwright, APScheduler
- **Desktop:** Electron 35+
- **Storage:** JSON files (settings/credentials) + SQLite database (work orders)
- **Authentication:** JWT tokens with secure storage

## Essential Commands

**Development:**
- `npm run electron:dev:start` - Primary dev command (starts frontend + electron)
- `npm run dev` - Frontend development server (Vite)
- **Backend:** `cd backend && uvicorn app.main:app --reload --port 8000`
- **Full Stack:** Run frontend and backend in separate terminals
- `npm run fix-vite-cache` / `npm run fix-vite-full` - Fix Vite issues

**Platform-Specific Development:**
- **Windows:** `npm run dev:win` (frontend with Windows env vars)
- **macOS/Linux:** `npm run dev` (standard development)
- **Cross-Platform:** Uses `cross-env` for environment variables

**Building:** `npm run build`, `npm run electron:build`

**Testing:** 
- Frontend: `npm test` (when tests exist)
- Backend: `cd backend && pytest` (requires test organization first)
- **Note:** Most test files currently in backend root need organization

**Maintenance:** `npm run lint`, `npm run cleanup-ports`, `npm run backup`, `npm run fix-*`

**Platform Tools:**
- **Windows:** See `/tools/windows/` for batch scripts (.bat files)
- **macOS/Linux:** See `/tools/unix/` for shell scripts (.sh files)
- **Python Scripts:** Cross-platform, located in `/scripts/` subdirectories

## API Endpoint Patterns

**RESTful Conventions:**
```
GET    /api/v1/resources          # List all
GET    /api/v1/resources/{id}     # Get one
POST   /api/v1/resources          # Create
PUT    /api/v1/resources/{id}     # Update
DELETE /api/v1/resources/{id}     # Delete
```

**Current API Structure:**
- `/api/auth/*` - Authentication endpoints
- `/api/work-orders/*` - Work order management
- `/api/dispensers/*` - Dispenser data and scraping
- `/api/automation/*` - Form automation tasks
- `/api/settings/*` - User preferences and config
- `/api/notifications/*` - Notification management

**Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2025-01-13T10:00:00Z"
}
```

**Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid credentials",
    "details": { ... }
  }
}
```

## Core Systems

**Batch Automation:** Sequential work order processing with progress tracking, pause/resume, error recovery.
- Frontend: `frontend/src/components/BatchProcessor.tsx`
- Backend: `backend/app/services/form_automation.py`
- API: `backend/app/routes/form_automation.py`

**Form Automation:** Playwright-based form filling with job code support:
- 2861, 3002: All Dispensers (AccuMeasure)
- 2862: Specific Dispensers (AccuMeasure, filtered)
- 3146: Open Neck Prover

**Notifications:** Multi-channel system (Email, Pushover, Desktop) with centralized formatting.

**Web Scraping:** Automated data collection with change detection and notification triggering.

**WorkFossa Integration:**
- Login URL: `https://app.workfossa.com` (NOT `/login`)
- After login, redirects to `/app/` dashboard
- Customer locations: `/app/customers/locations/{id}/`
- Work orders are accessed through visits

**Work Order Scraping Data Fields:**
- **Job ID:** Work order identifier (W-xxxxxx format, extracts number part)
- **Store Number:** Store identifier (#xxxx format)
- **Customer Name:** Business/company name (e.g., "7-Eleven Stores, Inc")
- **Address:** Full street address (combined for compatibility)
- **Street:** Street address component (e.g., "802 East Martin Luther King Boulevard")
- **City/State:** City, State ZIP component (e.g., "Tampa FL 33603")
- **County:** County location (e.g., "Hillsborough County")
- **Service Code:** Service type code (2861, 2862, 3002, 3146)
- **Service Name:** Service description (e.g., "AccuMeasure")
- **Service Items:** List of services (e.g., "6 x All Dispensers")
- **Created Date:** When work order was created
- **Created By:** User who created the work order
- **Scheduled Date:** When work order is scheduled
- **Visit URL:** Direct link to work order details (`/visits/{id}`)
- **Customer URL:** Link to customer location (`/customers/locations/{id}/`) for dispenser scraping
- **Instructions:** Special instructions or notes

**WorkFossa Table Structure:**
- **Cell 0:** Checkbox for selection
- **Cell 1:** Work Order ID (W-xxxxx format)
- **Cell 2:** Customer info (company name, store #xxxx, address)
- **Cell 3:** Items/Services (service codes and descriptions)
- **Cell 4:** Visits (dates and visit links)

**Work Order Scraping Process:**
1. Navigate to `https://app.workfossa.com/app/work/list`
2. Change page size to 100 via custom dropdown: `div.ks-select-selection:has-text('Show 25')`
3. Find work orders using selector: `tbody tr` (primary) or fallback selectors
4. Extract data from table cells using structured approach
5. Parse customer URLs from store number links in cell 2
6. Extract visit URLs from cell 4 links containing `/visits/`
7. Customer URLs enable subsequent dispenser scraping

**Data Extraction Patterns:**
- **Work Order ID:** Regex `W-(\d+)` extracts number part
- **Store Number:** Regex `#(\d+)` or `Store\s+(\d+)`
- **Customer Names:** Company patterns (Inc, LLC, Corp, Wawa, 7-Eleven, etc.)
- **Service Codes:** Extracted from items/services cell
- **Visit URLs:** Links containing `/visits/` in visits cell

**Interactive Testing:**
- Script: `backend/scripts/interactive_work_orders_test.py`
- Tests single work order extraction with step-by-step pauses
- Shows actual vs expected data structure for debugging

**Authentication Architecture:**
- **External:** WorkFossa credentials validated against their API
- **Internal:** JWT tokens issued after successful WorkFossa validation
- **Storage:** Tokens stored in frontend localStorage, credentials in backend JSON
- **Flow:** Login → Validate with WorkFossa → Issue JWT → Use JWT for API calls
- **Note:** No local user accounts - all auth depends on WorkFossa credentials

## Python Environment Setup

**Backend Requirements:**
- Python 3.8 or higher required
- SQLite (included with Python)
- Virtual environment setup:
  ```bash
  cd backend
  python -m venv venv
  # Activate on Unix/macOS:
  source venv/bin/activate
  # Activate on Windows:
  venv\Scripts\activate
  # Install dependencies:
  pip install -r requirements.txt
  ```

**Database Setup:**
- SQLite database auto-created at `backend/fossawork_v2.db`
- No manual setup required - tables created on first run via SQLAlchemy
- Database stores: work orders, dispenser data, authentication tokens
- For production: Configure PostgreSQL via DATABASE_URL environment variable

**Environment Variables:**
- Create `.env` file in backend directory (see `.env.example`)
- Required: `SECRET_KEY` for JWT tokens
- Optional: API keys for external services

## Development Workflow

**Full Stack Development Setup:**
1. **Terminal 1 - Backend:**
   ```bash
   cd backend
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   uvicorn app.main:app --reload --port 8000
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   npm run dev  # Runs on port 5173
   ```

3. **Terminal 3 - Electron (Optional):**
   ```bash
   npm run electron:dev  # For desktop app testing
   ```

**API Documentation:**
- FastAPI auto-generates interactive API docs
- Access at: `http://localhost:8000/docs` (Swagger UI)
- Alternative: `http://localhost:8000/redoc` (ReDoc)
- Test endpoints directly from the documentation interface

**Debugging Setup:**
- **VS Code:** Use included `.vscode/launch.json` configurations
- **Backend:** Set breakpoints in Python files, use debugger with FastAPI
- **Frontend:** Use Chrome DevTools with React Developer Tools extension
- **Network:** Monitor API calls in browser Network tab

## Environment & Troubleshooting

**Environment:** Cross-platform development (Windows, macOS, Linux). Originally developed for Windows, now supports all platforms.

**Platform-Specific Considerations:**
- **Windows:** Native support, batch scripts in `/tools/windows/`, handles console encoding
- **macOS:** Full support, Unix paths, shell scripts in `/tools/unix/`
- **Linux/WSL:** Requires `--no-sandbox --disable-dev-shm-usage` for browser automation
- **Path Handling:** Use `pathlib` (Python) or `path.join()` (JS) for cross-platform paths

**Common Issues:**
- **Vite Cache:** Symptoms: `ERR_ABORTED 504`, module load failures. Auto-recovery via `ViteCacheErrorBoundary`. Manual: `npm run fix-vite-cache`
- **Multi-user isolation:** User data in `data/users/{userId}/`, credentials per-user, not global
- **Browser automation:** WSL/Linux requires `--no-sandbox --disable-dev-shm-usage` args
- **Console Encoding (Windows):** Handled by `SafeConsoleFormatter` for emoji compatibility
- **File Locking (Windows):** Log clearing disabled on Windows due to file lock issues

## Performance Considerations

**Backend Optimization:**
- **Database:** Use indexed columns for work order queries
- **Pagination:** Limit dispenser results to 50-100 per page
- **Caching:** Consider Redis for frequently accessed data
- **Async Operations:** Use FastAPI's async capabilities for I/O operations
- **Connection Pooling:** SQLAlchemy connection pool configured

**Frontend Optimization:**
- **Code Splitting:** Vite automatically splits chunks
- **Lazy Loading:** Use React.lazy() for large components
- **Memoization:** Use React.memo() and useMemo() for expensive operations
- **Virtual Scrolling:** For large lists (dispensers, work orders)
- **Image Optimization:** Compress screenshots, use WebP format

**Scraping Performance:**
- **Concurrent Limits:** Max 3 browser instances to avoid memory issues
- **Page Timeouts:** 30s default, increase for slow sites
- **Selective Loading:** Block images/fonts when not needed
- **Reuse Sessions:** Keep browser context alive between scrapes

## Critical Memory

### ⚠️ CRITICAL SECURITY WARNINGS ⚠️

**HIGH PRIORITY SECURITY ISSUES:**
1. **Credentials Storage:** Currently stores WorkFossa credentials in plain text JSON files
2. **API Security:** Backend API endpoints lack proper authentication (JWT exists but not fully implemented)
3. **Input Validation:** Insufficient validation on user inputs across the application
4. **CORS:** Overly permissive CORS configuration in production
5. **Secret Management:** SECRET_KEY and other sensitive data in .env files without encryption

**Immediate Actions Required:**
- Implement credential encryption before production deployment
- Add API endpoint authentication middleware
- Validate and sanitize all user inputs
- Configure strict CORS policies
- Use proper secret management service

See `/ai_docs/reference/comprehensive-codebase-analysis-2025.md` for full security audit.

**Data Architecture:** JSON file-based storage. Global: `data/`, User-specific: `data/users/{userId}/`. Multi-user isolation enforced.

**Code Quality:** A- (88/100). Excellent: modern stack, modular design. Needs: security fixes, component decomposition.

**Testing:** Unit/Integration/Performance/Cross-platform tests in `/tests/` subdirectories (never root).

**Recent Work:** Documentation consolidated (107→67 files, 37% reduction). Batch/AccuMeasure/Form automation unified.

## Data Backup & Recovery

**What to Backup:**
1. **Database:** `backend/fossawork_v2.db` (critical)
2. **User Data:** `backend/data/users/` directory
3. **Credentials:** `backend/data/credentials/` (encrypted in production)
4. **Settings:** `.env` files and configuration
5. **Logs:** `backend/logs/` for audit trail

**Backup Commands:**
```bash
# Quick backup script
cd backend
python -c "
import shutil
import datetime
backup_dir = f'backups/{datetime.datetime.now().strftime(\"%Y%m%d_%H%M%S\")}'
shutil.copytree('data', f'{backup_dir}/data')
shutil.copy2('fossawork_v2.db', f'{backup_dir}/fossawork_v2.db')
print(f'Backup created: {backup_dir}')
"
```

**Recovery Process:**
1. Stop all services
2. Backup current (corrupted) data
3. Restore from backup:
   ```bash
   cp backups/[timestamp]/fossawork_v2.db ./fossawork_v2.db
   cp -r backups/[timestamp]/data/* ./data/
   ```
4. Restart services
5. Verify data integrity

**Automated Backup:**
- Use cron (Linux/macOS) or Task Scheduler (Windows)
- Recommended: Daily backups, keep 7 days
- Consider cloud backup for production (S3, Google Drive)

## Memory References

**Comprehensive Memory:** See `/ai_docs/reference/ai-assistant-memory.md` for detailed AI assistant patterns, code examples, and troubleshooting.

**Workflow Guide:** See `/ai_docs/development/workflow-memory.md` for complete development workflow, git practices, and organization guidelines.

**Quick Reference:**
- File paths: User data in `data/users/{userId}/`, tests in `/tests/` subdirs
- Git: Checkpoint commits, WIP every 30-60min, descriptive messages
- Documentation: Always update with code changes, commit together
- Testing: NEVER in root, always with README, proper naming conventions
- Security: Never log credentials, validate inputs, user isolation

## Development Principles

**Core Rules:** Read entire files, commit early/often, documentation is code, verify library syntax with Context7, never skip libraries due to "not working", run linting after changes

**Quality Standards:** Organize code properly, optimize for readability, never dummy implementations, get task clarity, no large refactors without instruction

**Process:** Understand architecture → Plan → Get approval → Code → Test → Document

**Problem Solving:** Find root causes, don't throw random solutions, break down large/vague tasks

**UI/UX:** Focus on aesthetics, usability, best practices, smooth interactions

## Testing Approach

**Dual Testing Strategy:** When creating automation tests, ALWAYS create two versions:

1. **Interactive Version (for Bruce)**: 
   - Filename pattern: `interactive_[feature]_test.py`
   - Location: `/scripts/testing/interactive/`
   - Features:
     - Pauses at each major step with `Press Enter to continue...`
     - Clear step descriptions before each action
     - Visible browser mode (`headless=False`)
     - Detailed console output explaining what's happening
     - User can control progression through the test
   - Example structure:
     ```python
     async def wait_for_user():
         print("\n⏸️  Press Enter to continue...")
         await asyncio.get_event_loop().run_in_executor(None, input)
     
     print("\n🔍 Step 1: Launching browser...")
     await wait_for_user()
     # ... perform action
     
     print("\n🔍 Step 2: Navigating to page...")
     await wait_for_user()
     # ... perform action
     ```

2. **Non-Interactive Version (for Claude Code)**:
   - Filename pattern: `test_[feature].py`
   - Location: `/tests/[appropriate_subdirectory]/`
   - Features:
     - Runs completely automated without pauses
     - Headless browser mode (`headless=True`)
     - Programmatic assertions and error handling
     - Suitable for CI/CD pipelines
     - Returns clear pass/fail status

**Benefits:**
- Bruce can visually verify test behavior and troubleshoot issues
- Claude Code can run automated tests efficiently
- Same test logic maintained in both versions
- Easy debugging with interactive stepping

**Example:** See `/scripts/interactive_dispenser_test.py` (interactive) and `/tests/backend/test_dispenser_extraction.py` (automated)

## Error Handling & Logging

**Error Handling Patterns:**
```python
# Backend (FastAPI)
from fastapi import HTTPException
from app.core.logging import logger

try:
    result = await risky_operation()
except WorkFossaAuthError as e:
    logger.error(f"Auth failed: {e}")
    raise HTTPException(status_code=401, detail="Authentication failed")
except Exception as e:
    logger.exception("Unexpected error")
    raise HTTPException(status_code=500, detail="Internal server error")
```

```typescript
// Frontend (React)
try {
  const data = await api.fetchData();
} catch (error) {
  console.error('API Error:', error);
  toast.error('Failed to load data');
}
```

**Logging Guidelines:**
- **Backend:** Use Python's `logging` module with structured logs
- **Frontend:** Console for dev, error reporting service for production
- **Never Log:** Passwords, tokens, sensitive user data
- **Always Log:** API errors, authentication failures, critical operations
- **Log Levels:** DEBUG (dev only), INFO (general), WARNING (issues), ERROR (failures)

## 📁 COMPREHENSIVE FILE ORGANIZATION ENFORCEMENT (PRIORITY 1)

### MANDATORY FILE ORGANIZATION RULES

**⚠️ CRITICAL ENFORCEMENT**: ALL files MUST be organized in proper directories. NEVER leave loose files in root, backend, frontend, or scripts directories.

```
IMMEDIATE ORGANIZATION RULES:

1. BEFORE creating any files:
   - CHECK if proper directory exists
   - CREATE directory if needed following naming conventions
   - PLACE file in correct location from start

2. FILE PLACEMENT RULES BY TYPE:

   DOCUMENTATION:
   - /docs/guides/ - User guides, setup guides, startup guides
   - /docs/implementation-complete/ - Completion status documents
   - /docs/reports/ - Audit reports, summaries, analysis documents
   - /docs/planning/ - Strategy documents, planning materials
   - /docs/api/ - API documentation
   - /docs/archive/ - Historical/outdated documents
   - /ai_docs/ - Technical reference documentation
   - /specs/ - Feature planning and specifications

   TEST FILES:
   - /tests/automation/ - Form automation and batch processing tests
   - /tests/backend/ - Backend API and service tests
   - /tests/frontend/ - Frontend component and integration tests
   - /tests/integration/ - Cross-system integration tests
   - /tests/performance/ - Performance and load tests
   - /tests/manual/ - Manual testing scripts and procedures

   SCRIPTS AND UTILITIES:
   - /scripts/setup/ - Installation and environment setup
   - /scripts/maintenance/ - Cleanup and maintenance utilities
   - /scripts/deployment/ - Build and deployment scripts
   - /scripts/data/ - Data processing and migration scripts
   - /scripts/testing/ - Test runners and test utilities

   TOOLS AND AUTOMATION:
   - /tools/windows/ - Windows batch files and Windows-specific tools
   - /tools/unix/ - Unix shell scripts and macOS/Linux tools
   - /tools/development/ - Development environment tools
   - /tools/debugging/ - Debug utilities and diagnostic tools

   CONFIGURATION:
   - /config/ - All configuration files (except package.json, tsconfig.json in project roots)

   BUILD ARTIFACTS:
   - /public/ - Static assets served by web server
   - /dist/ or /build/ - Built/compiled output
   - /screenshots/ - Test screenshots and debugging images
   - /logs/ - Application logs and debugging output

3. FILE NAMING CONVENTIONS:
   - Use kebab-case for all files except when framework conventions require otherwise
   - Use descriptive names that indicate content and purpose
   - Add category prefix when helpful (e.g., test-form-automation.js, debug-login-flow.js)
   - NO CAPS unless it's an acronym (e.g., API, REST) or required by framework

4. PROHIBITED LOCATIONS (Files that should NEVER be in these directories):
   - ROOT: Only package.json, README.md, CLAUDE.md, and other essential project files
   - /backend/: Only essential backend application code, no tests, docs, or utilities
   - /frontend/: Only essential frontend application code, no tests, docs, or utilities
   - /src/: Only source code, no tests, docs, configuration, or utilities

5. SESSION START ENFORCEMENT:
   - SCAN for ALL misplaced files at session start (not just documentation)
   - MOVE misplaced files immediately when found
   - UPDATE references and links after moving files
   - LOG movement in development_log.md

IMMEDIATE ACTION CHECKLIST:
□ Scan root directory for test files (test-*.js, *-test.js, debug-*.js)
□ Scan root directory for script files (*.js, *.py, *.bat, *.sh not in proper locations)
□ Scan root directory for documentation files (*.md except README.md, CLAUDE.md)
□ Scan root directory for configuration files (*.json, *.config.*, *.mjs not essential)
□ Scan backend/ directory for any non-application files
□ Scan frontend/ directory for any non-application files
□ Scan tools/ directory for loose scripts not in subdirectories
□ MOVE any found files to appropriate organized subdirectories
□ UPDATE any broken imports/references caused by moves
□ DOCUMENT the cleanup in development_log.md
```

### CURRENT ORGANIZATION STATUS:

```
✅ COMPLETED COMPREHENSIVE ORGANIZATION:
- Organized 50+ documentation files into /docs/ subdirectories
- Moved all backend test files to /tests/backend/
- Organized tools directory:
  - Windows batch files → /tools/windows/
  - Python debugging scripts → /tools/debugging/
  - Backup scripts → /tools/backup-removed-scripts/
- Moved setup scripts to /scripts/setup/
- Removed backup files (.backup, .bak)
- Enforced comprehensive file organization rules

✅ CLEAN DIRECTORIES:
- Root: Only essential project files (package.json, README.md, CLAUDE.md, ecosystem.config.js)
- Backend: Only essential backend application code
- Frontend: Only essential frontend application code  
- Tools: Properly organized into subdirectories

✅ ORGANIZATION ENFORCEMENT:
- CLAUDE.md now enforces comprehensive file organization at session start
- All file types covered: documentation, tests, scripts, tools, configuration
- Clear placement rules for each file type
- Immediate action checklist for future sessions

⚠️ AREAS NOT TOUCHED (Per Instructions):
- archive/ directory (left untouched as requested)

⚠️ CURRENT STATE WARNING:
- Backend directory contains 50+ test/script files violating these rules
- These files need to be organized according to the rules above
- Run the organization checklist at session start to fix this

### 🚨 IMMEDIATE ORGANIZATION NEEDS:

**Backend Directory Violations (As of January 2025):**
```
backend/
├── 50+ test_*.py files → Should be in /tests/backend/
├── 30+ debug_*.py files → Should be in /scripts/debugging/
├── 15+ check_*.py files → Should be in /scripts/testing/
├── Various .html test files → Should be in /tests/manual/
└── Multiple script subdirs → Need consolidation
```

**Why This Matters:**
1. Makes finding code difficult
2. Violates project structure standards
3. Complicates testing strategies
4. Hinders new developer onboarding
5. Creates import/path issues

**Recommended Action:**
Run file organization checklist immediately at session start before any development work.
```

## Cross-Platform Development

**Platform Detection:**
```python
# Python
import platform
is_windows = platform.system() == "Windows"
is_macos = platform.system() == "Darwin"
is_linux = platform.system() == "Linux"

# JavaScript/TypeScript
const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
```

**Virtual Environment Paths:**
- **Windows:** `venv\Scripts\python.exe`, `venv\Scripts\activate.bat`
- **macOS/Linux:** `venv/bin/python`, `venv/bin/activate`

**Browser Paths (Playwright):**
- Playwright handles browser paths automatically across platforms
- For manual browser launching, use platform-specific paths or system PATH

**File System Operations:**
- Always use `path.join()` (Node.js) or `pathlib.Path` (Python)
- Never hardcode path separators (`/` or `\`)
- Handle case sensitivity (macOS/Linux are case-sensitive, Windows isn't)

**Process Management:**
- **Windows:** `taskkill /F /PID`, `netstat -ano | findstr`
- **macOS/Linux:** `kill -9`, `lsof -i :port`
- Use cross-platform npm packages when possible (`cross-env`, `rimraf`)

**Shell Scripts:**
- **Windows:** Batch files (`.bat`) in `/tools/windows/`
- **macOS/Linux:** Shell scripts (`.sh`) in `/tools/unix/`
- **Cross-Platform:** Python scripts in `/scripts/` subdirectories

**Console/Terminal:**
- Windows console encoding handled by `SafeConsoleFormatter`
- macOS/Linux typically support UTF-8 and emojis natively
- Use `platform.system()` to detect and adjust output formatting

## Claude Code Tools

### MCP Servers Integration

**Model Context Protocol (MCP) Servers** extend Claude Code's capabilities with additional tools and automation. See `/docs/development/mcp-servers-usage.md` for complete documentation.

**Available MCP Servers:**
- **Taskmaster AI:** Advanced task management and multi-LLM workflow automation
- **Context7 MCP:** Enhanced context management and code analysis
- **Clear Thought:** Structured thinking and problem-solving assistance
- **Sequential Thinking:** Complex problem-solving through sequential analysis
- **Puppeteer MCP:** Browser automation and web scraping
- **Playwright MCP:** Advanced browser automation and testing
- **Notion MCP:** Notion API integration for documentation and knowledge management

**Quick Usage:**
- MCP servers complement existing project automation (form automation, web scraping, batch processing)
- Choose servers based on specific task requirements (analysis, automation, problem-solving)
- Monitor resource usage; MCP servers consume additional system resources
- Ensure API keys are properly configured for full functionality

**Configuration Location:** `~/.claude/claude_desktop_config.json` (global MCP configuration)

### Notion Documentation Integration

**FossaWork V2 Documentation** is maintained in Notion for comprehensive user and developer reference. The documentation page provides a centralized knowledge base for the project.

**Notion Page:** FossaWork V2 Documentation (ID: 210735ed-6a8f-8102-a92e-c5dd8fedee1b)
**Parent Page:** Fossa Monitor

### Documentation Maintenance Instructions

**When to Update Notion Documentation:**
1. **Major Feature Additions** - New functionality that changes user workflow
2. **API Changes** - New endpoints, modified parameters, or deprecated routes
3. **Architecture Updates** - Significant changes to system design or tech stack
4. **Security Improvements** - Authentication changes, encryption updates
5. **User Workflow Changes** - Modified UI/UX patterns or navigation

**Update Process:**
1. Access the Notion documentation using the mcp__notion tools
2. Navigate to the appropriate section:
   - Application Overview - for general changes
   - Architecture & Tech Stack - for technical updates
   - Developer Guide - for setup/development changes
   - User Guide - for feature/workflow updates
   - API Reference - for endpoint documentation
   - Core Systems - for major system changes
3. Update content using `mcp__notion__API-patch-block-children` for existing sections
4. Add new blocks using `mcp__notion__API-patch-block-children` with the `after` parameter
5. Always update the "Last Updated" timestamp in the Documentation Maintenance section

**Content Guidelines:**
- Keep descriptions concise and technical
- Include code examples for API changes
- Update screenshots when UI changes significantly
- Maintain consistent formatting with existing content
- Link to relevant ai_docs/ files for detailed technical information

**Synchronization with Codebase:**
- Notion documentation should reflect the current state of the main branch
- Update documentation AFTER features are merged, not during development
- Reference commit hashes or version numbers for major changes
- Keep API examples synchronized with actual endpoint behavior

**Tools for Documentation Updates:**
```bash
# List all Notion pages to find documentation
mcp__notion__API-post-search with query "FossaWork V2"

# Retrieve current documentation structure
mcp__notion__API-get-block-children with block_id "210735ed-6a8f-8102-a92e-c5dd8fedee1b"

# Update specific sections
mcp__notion__API-patch-block-children with appropriate block_id and content

# Add new sections
mcp__notion__API-patch-block-children with after parameter for positioning
```

**Documentation Sections to Maintain:**
1. **Application Overview** - High-level features and purpose
2. **Architecture** - System design, components, data flow
3. **Developer Guide** - Setup, development workflow, testing
4. **User Guide** - Features, workflows, troubleshooting
5. **API Reference** - Endpoints, parameters, responses
6. **Security** - Authentication, data protection, best practices
7. **Roadmap** - Planned features, known issues, future vision

## Git Worktrees for Parallel Development

**Git Worktrees** enable multiple Claude Code sessions to work on different features simultaneously without conflicts. Each worktree is an isolated copy of the repository with its own branch and working directory.

### When to Use Worktrees
- Working on multiple features/bugs in parallel
- Running separate Claude Code sessions for different tasks
- Testing changes in isolation without affecting main development
- Maintaining clean separation between experimental and stable code

### Worktree Setup Commands

**Create New Worktrees:**
```bash
# Create worktree with new branch
git worktree add ../FossaWorkV2-feature-name -b feature-name

# Create worktree from existing branch
git worktree add ../FossaWorkV2-bugfix existing-branch
```

**Common Worktree Locations:**
- `../FossaWorkV2-feature-auth` - Authentication features
- `../FossaWorkV2-bugfix` - Bug fixes
- `../FossaWorkV2-experimental` - Experimental changes
- `../FossaWorkV2-refactor` - Major refactoring

**Manage Worktrees:**
```bash
# List all worktrees
git worktree list

# Remove worktree when done
git worktree remove ../FossaWorkV2-feature-name

# Clean up deleted worktrees
git worktree prune
```

### Worktree Environment Setup

**Each worktree needs its own environment:**
1. Navigate to worktree: `cd ../FossaWorkV2-feature-name`
2. Install dependencies: `npm install`
3. Frontend deps: `cd frontend && npm install && cd ..`
4. Backend deps: `cd backend && npm install && cd ..`
5. Python venv (if needed): `cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`

**Setup Script Available:** `setup-worktree.sh` in project root automates environment setup

### Parallel Claude Sessions

**Running Multiple Sessions:**
```bash
# Terminal 1 - Feature development
cd ../FossaWorkV2-feature-auth
claude

# Terminal 2 - Bug fixes
cd ../FossaWorkV2-bugfix
claude

# Terminal 3 - Main development
cd ~/Documents/GitHub/FossaWorkV2
claude
```

**Benefits:**
- Complete isolation between tasks
- No merge conflicts during development
- Easy context switching
- Simplified testing of different approaches
- Clean git history per feature

**Best Practices:**
- Use descriptive worktree names matching branch purpose
- Clean up worktrees after merging branches
- Keep main worktree for coordination/integration
- Document active worktrees in team communication
- Run tests in each worktree before merging

## Production Deployment Considerations

**Pre-Production Checklist:**
1. ⛔ Implement credential encryption (CRITICAL - currently plain text)
2. ⛔ Enable API authentication on all endpoints
3. ⛔ Configure production CORS settings
4. ⛔ Move from SQLite to PostgreSQL
5. ⛔ Set up proper secret management (AWS Secrets Manager, etc.)
6. ⛔ Configure HTTPS/SSL certificates
7. ⛔ Set up monitoring and logging
8. ⛔ Implement rate limiting
9. ⛔ Add input validation and sanitization
10. ⛔ Configure automated backups

**Deployment Options:**
- **Desktop App:** Electron Builder for Windows/macOS/Linux
- **Web App:** Docker containers with nginx reverse proxy
- **Backend API:** Gunicorn + Uvicorn workers behind nginx
- **Database:** Managed PostgreSQL (AWS RDS, etc.)

**Environment Configuration:**
```bash
# Production .env example
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=<generated-secure-key>
ENVIRONMENT=production
CORS_ORIGINS=https://yourdomain.com
```

## Known Issues & Workarounds

### Critical Issues

1. **Dispenser Scraping Failures**
   - **Issue:** Page size dropdown not always detected
   - **Workaround:** Manual retry or check `backend/scripts/check_dispenser_data.py`
   - **Fix:** Enhanced selector logic in `dispenser_scraper.py`

2. **Authentication Token Expiry**
   - **Issue:** JWT tokens expire but frontend doesn't refresh
   - **Workaround:** Manual logout/login
   - **Fix Needed:** Implement token refresh mechanism

3. **Large Work Order Lists**
   - **Issue:** UI freezes with 1000+ work orders
   - **Workaround:** Use pagination, limit to 100 per page
   - **Fix Needed:** Virtual scrolling implementation

### Development Issues

4. **Backend Test Files Scattered**
   - **Issue:** 50+ test files in backend root directory
   - **Workaround:** Use grep/find to locate tests
   - **Fix:** Run file organization checklist

5. **Vite HMR Breaking**
   - **Issue:** Hot reload stops working randomly
   - **Workaround:** `npm run fix-vite-cache` or restart dev server
   - **Fix:** Update Vite to latest version

6. **Playwright Browser Leaks**
   - **Issue:** Chromium processes not cleaning up
   - **Workaround:** `pkill -f chromium` or use cleanup scripts
   - **Fix:** Ensure proper browser.close() in all paths

### Platform-Specific Issues

7. **Windows Path Issues**
   - **Issue:** Backslashes in paths cause failures
   - **Workaround:** Use pathlib.Path or forward slashes
   - **Fix:** Consistent path handling throughout

8. **macOS Gatekeeper**
   - **Issue:** Electron app blocked on first run
   - **Workaround:** Right-click → Open to bypass
   - **Fix:** Code sign the application

9. **Linux Sandbox Errors**
   - **Issue:** Chromium fails to start
   - **Workaround:** Add `--no-sandbox` flag
   - **Fix:** Proper sandbox configuration

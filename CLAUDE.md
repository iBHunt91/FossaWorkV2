# CLAUDE.md - Project Guide for Claude Code


.. _conversation-guidelines:

Conversation Guidelines
======================

**Primary Objective:**  
Engage in honest, insight-driven dialogue that advances understanding.

Core Principles
---------------

- **Intellectual honesty:**  
  Share genuine insights without unnecessary flattery or dismissiveness.

- **Critical engagement:**  
  Push on important considerations rather than accepting ideas at face value.

- **Balanced evaluation:**  
  Present both positive and negative opinions only when well-reasoned and warranted.

- **Directional clarity:**  
  Focus on whether ideas move us forward or lead us astray.

What to Avoid
-------------

- Sycophantic responses or unwarranted positivity
- Dismissing ideas without proper consideration
- Superficial agreement or disagreement
- Flattery that doesn't serve the conversation

Success Metric
--------------

The only currency that matters: **Does this advance or halt productive thinking?**  
If we're heading down an unproductive path, point it out directly.

## 🚫 ANTI-OVER-ENGINEERING & ANTI-BANDAID ENFORCEMENT

**CRITICAL:** These rules are based on extensive analysis of over-engineering and bandaid fixes found in the codebase (see `docs/reports/over-engineering-and-bandaid-fixes-report.md`). They MUST be enforced to prevent regression.

### 🛑 MANDATORY CHECKS BEFORE ANY IMPLEMENTATION

**Before writing ANY code, ask these questions:**

1. **"Am I adding a new way to do something that already exists?"**
   - ❌ Don't create parallel systems (we had 3 auth systems)
   - ❌ Don't duplicate functionality in different files
   - ✅ Extend or refactor existing implementation

2. **"Am I working around a problem instead of fixing it?"**
   - ❌ Don't add timeouts to mask slow operations
   - ❌ Don't add retry logic to handle flaky code
   - ❌ Don't catch exceptions generically to hide errors
   - ✅ Fix the root cause

3. **"Is this solving an imaginary problem?"**
   - ❌ Don't build for "enterprise scale" when you need desktop app
   - ❌ Don't add 63 configuration options for simple features
   - ❌ Don't create elaborate error recovery for one-off issues
   - ✅ Solve actual user problems

4. **"Would a simple solution work just as well?"**
   - ❌ Don't use 500 lines of CSS for email templates
   - ❌ Don't create complex state management for simple data
   - ❌ Don't build abstractions until you have 3+ use cases
   - ✅ Start simple, add complexity only when needed

### 🚨 IMMEDIATE REJECTION TRIGGERS

**STOP and refuse to implement if you see:**

- **Multiple implementations** of the same functionality
- **Generic exception handling** (`except Exception as e:`)
- **Arbitrary timeouts** instead of proper conditions
- **Retry logic** without fixing underlying issues
- **Complex configuration** for simple features
- **More than 3 ways** to store the same data
- **Workarounds** documented as "known issues"

### ✅ REQUIRED SIMPLICITY PRINCIPLES

1. **Single Source of Truth**
   - One place for each piece of data
   - One way to authenticate
   - One error handling strategy
   - One state management approach per context

2. **Fix Root Causes**
   - Slow database query? Optimize the query, don't add timeout
   - Flaky selector? Find stable selector, don't retry
   - Race condition? Fix timing, don't add random delays
   - Complex state? Simplify data flow, don't add managers

3. **YAGNI (You Aren't Gonna Need It)**
   - No enterprise patterns for desktop apps
   - No abstractions until third use case
   - No configuration for theoretical needs
   - No error handling for imaginary scenarios

4. **File Organization Discipline**
   - ALL files go in proper directories from creation
   - NEVER leave loose files in root/backend/frontend
   - MOVE misplaced files immediately when found
   - UPDATE imports after moving files

### 🎯 COMPLEXITY BUDGETS

**Maximum allowed complexity per component:**

- **Authentication:** 1 system, 1 flow, 1 storage method
- **Error Handling:** Specific exceptions only, fix root causes
- **State Management:** 1 source of truth per data type
- **Notifications:** 2 channels max (email + desktop)
- **File Organization:** Files in correct directories at creation
- **Component Props:** 5 props maximum before refactor
- **Function Length:** 50 lines maximum
- **File Length:** 300 lines maximum for components

### 📋 MANDATORY CODE REVIEW CHECKLIST

Before submitting ANY code:

- [ ] **Single Implementation:** No duplicate functionality
- [ ] **Root Cause Fixed:** No workarounds or bandaids
- [ ] **Specific Exceptions:** No generic `except Exception`
- [ ] **Proper Waits:** No arbitrary timeouts
- [ ] **Simple Configuration:** No complex option matrices
- [ ] **File Placement:** All files in correct directories
- [ ] **Import Validation:** All imports work after changes
- [ ] **Documentation Updated:** Changes reflected in docs

### 🚫 ANTI-PATTERNS TO NEVER REPEAT

Based on actual problems found in codebase:

1. **Authentication Over-Engineering**
   - ❌ Multiple credential storage systems
   - ❌ Parallel authentication flows
   - ❌ Redundant encryption implementations
   - ✅ Single auth system with clear flow

2. **Error Handling Bandaids**
   - ❌ 862-line generic error recovery systems
   - ❌ Timeout workarounds for slow operations
   - ❌ Generic exception catching
   - ✅ Specific error handling that fixes problems

3. **Frontend State Chaos**
   - ❌ Data stored in 4+ places simultaneously
   - ❌ Multiple context providers for simple state
   - ❌ Complex state synchronization
   - ✅ Single source of truth per data type

4. **File Organization Neglect**
   - ❌ 509 files in wrong directories as "known issue"
   - ❌ Test files scattered throughout codebase
   - ❌ Documentation spread across multiple locations
   - ✅ Files in proper directories from creation

## Sub-Agent Delegation & Oversight System

**MANDATORY: Claude Code as Overseer/Manager**

### Core Principle
Claude Code operates as the primary overseer and quality control manager, delegating specialized tasks to sub-agents while maintaining oversight of all work. Never work in isolation - always use appropriate sub-agents for complex tasks.

### Delegation Strategy

**When to Use Sub-Agents (via Task tool):**
1. **Code Search & Analysis** (>3 files or complex patterns)
   - Finding implementations across codebase
   - Analyzing dependencies and relationships
   - Locating specific patterns or anti-patterns
   
2. **Large-Scale Changes** (>100 lines or multiple files)
   - Refactoring operations
   - Architecture updates
   - Cross-cutting concerns

3. **Research & Documentation**
   - Library usage patterns
   - Best practices investigation
   - Documentation creation/updates

4. **Complex Problem Solving**
   - Multi-step debugging
   - Performance optimization
   - Security analysis

### Sub-Agent Management Protocol

**1. Task Definition:**
```yaml
Before Delegation:
  - Define clear objectives and success criteria
  - Specify boundaries and constraints
  - List expected deliverables
  - Set quality standards

Task Structure:
  description: "Brief 3-5 word task title"
  prompt: |
    Context: [Current situation]
    Objective: [What needs to be done]
    Constraints: [What to avoid]
    Deliverables: [Expected outputs]
    Success Criteria: [How to measure completion]
```

**2. Quality Control Checklist:**
After receiving sub-agent results, ALWAYS:
- [ ] Verify code syntax and imports
- [ ] Check for security vulnerabilities
- [ ] Validate against project patterns
- [ ] Ensure proper error handling
- [ ] Confirm test coverage
- [ ] Review documentation updates

**3. Integration Protocol:**
```yaml
Sub-Agent Results:
  1. Review completeness
  2. Validate accuracy
  3. Check consistency with existing code
  4. Test integration points
  5. Verify no regressions

If Issues Found:
  - Document specific problems
  - Create corrective sub-agent task
  - Re-validate after corrections
```

### Delegation Examples

**Example 1: Feature Implementation**
```yaml
Main Task: "Add user preference system"
Sub-Agent Tasks:
  1. "Research existing settings structure"
  2. "Design preference schema"
  3. "Implement backend API"
  4. "Create frontend components"
  5. "Add tests and documentation"
```

**Example 2: Bug Investigation**
```yaml
Main Task: "Fix authentication timeout issues"
Sub-Agent Tasks:
  1. "Analyze current auth flow"
  2. "Find timeout configurations"
  3. "Research JWT best practices"
  4. "Implement token refresh"
  5. "Test edge cases"
```

### Parallel vs Sequential Delegation

**Parallel Tasks (when independent):**
- Multiple file searches
- Independent component updates
- Separate documentation sections
- Non-overlapping tests

**Sequential Tasks (when dependent):**
- Design → Implementation → Testing
- Research → Planning → Execution
- Analysis → Refactoring → Validation

### Sub-Agent Communication

**Information Sharing:**
- Pass relevant context between sub-agents
- Share discovered patterns and issues
- Maintain consistency in approach
- Document decisions and rationale

**Result Aggregation:**
- Compile findings into coherent summary
- Resolve conflicts between sub-agent outputs
- Prioritize recommendations
- Create unified implementation plan

### Quality Metrics

**Sub-Agent Performance:**
- Task completion rate
- Code quality score
- Time efficiency
- Error/revision frequency

**Oversight Effectiveness:**
- Issues caught in review
- Integration success rate
- User satisfaction
- System stability

### Anti-Patterns to Avoid

**DON'T:**
- Work on complex tasks without sub-agents
- Accept sub-agent output without review
- Delegate without clear instructions
- Skip integration testing
- Ignore inconsistencies

**DO:**
- Always verify sub-agent work
- Provide detailed context
- Set clear boundaries
- Test thoroughly
- Document decisions

### Emergency Override

When sub-agents produce problematic results:
1. Stop integration immediately
2. Document the issues found
3. Create corrective tasks
4. Implement fixes directly if urgent
5. Update delegation criteria


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

**Key Features:** Multi-user support, web scraping, form automation (single/batch), notifications (Email/Pushover/Desktop), schedule management, progress tracking, filter management with automatic updates.

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
- **Backend:** `cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend && python3 -m uvicorn app.main:app --reload --port 8000`
- **Full Stack:** Run frontend and backend in separate terminals
- `npm run fix-vite-cache` / `npm run fix-vite-full` - Fix Vite issues

**Platform-Specific Development:**
- **Windows:** `npm run dev:win` (frontend with Windows env vars)
- **macOS/Linux:** `npm run dev` (standard development)
- **Cross-Platform:** Uses `cross-env` for environment variables

**Building:** `npm run build`, `npm run electron:build`

**Testing:** 
- **Testing Dashboard:** Navigate to `http://localhost:5173/testing` (comprehensive system tests)
- Frontend: `npm test` (when tests exist)
- Backend: `cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend && pytest` (requires test organization first)
- **Note:** Most test files currently in backend root need organization
- **IMPORTANT:** Always provide full absolute paths when giving test commands

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
- `/api/v1/logs/*` - Logging endpoints (write, stats, download)
- `/api/filters/*` - Filter calculation and management

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

**Filter Management:** Intelligent filter calculation system with automatic updates:
- Calculates filter requirements based on dispensers and service codes
- Automatic update detection with visual indicators
- Real-time filter quantity editing capabilities
- Warning system for missing data or configuration issues
- Export functionality for filter summaries

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
  python3 -m venv venv  # Use python3 on macOS/Linux
  # Activate on Unix/macOS:
  source venv/bin/activate
  # Activate on Windows:
  venv\Scripts\activate
  # Install dependencies:
  pip install -r requirements.txt
  ```

**IMPORTANT Python Command Usage:**
- **macOS/Linux:** Always use `python3` command (not `python`)
- **Windows:** Use `python` command
- **After venv activation:** `python` works on all platforms
- **For backend scripts:** Always activate venv first to ensure dependencies are available

**Running Backend Scripts (Correct Workflow):**
  ```bash
  # Navigate to backend directory
  cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
  
  # Activate virtual environment (REQUIRED for scripts with dependencies)
  source venv/bin/activate  # macOS/Linux
  # OR: venv\Scripts\activate  # Windows
  
  # Now run scripts with python (not python3)
  python scripts/simple_schedule_test.py
  
  # Deactivate when done
  deactivate
  ```

**Without venv (limited functionality):**
  ```bash
  # Only for scripts with no external dependencies
  python3 /path/to/script.py  # macOS/Linux
  python /path/to/script.py   # Windows
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
   cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   python -m uvicorn app.main:app --reload --port 8000  # python works after venv activation
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
   npm run dev  # Runs on port 5173
   ```

3. **Terminal 3 - Electron (Optional):**
   ```bash
   cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
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

**Recent Work:** Documentation consolidated (107→67 files, 37% reduction). Batch/AccuMeasure/Form automation unified. Testing Dashboard implemented with 24 comprehensive system tests.

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

**UI/UX:** Focus on aesthetics, usability, best practices, smooth interactions. **NEVER use browser native `confirm()`, `alert()`, or `prompt()` dialogs** - always use custom React components to maintain consistent UI and avoid "localhost says" browser dialogs.

**IMPORTANT: Command Guidelines:**
- **ALWAYS provide full absolute paths** when giving file paths or test commands
- **NEVER use relative paths** in commands (avoid `cd backend && python scripts/...`)
- **ALWAYS use `python3` on macOS/Linux** (not `python` which may not exist)
- **Example (macOS/Linux):** `python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend/scripts/test_dispenser_batch_quick.py`
- **Example (Windows):** `python C:\Users\ibhunt\Documents\GitHub\FossaWorkV2\backend\scripts\test_dispenser_batch_quick.py`
- **Not:** `cd backend && python scripts/test_dispenser_batch_quick.py`

## Code Organization & Refactoring Best Practices

### Avoid Over-Engineering

**Principles:**
- **KISS (Keep It Simple):** Start with the simplest solution that works
- **YAGNI (You Aren't Gonna Need It):** Don't add features or complexity until actually needed
- **Iterative Improvement:** Build working basics first, then enhance as requirements emerge
- **Pragmatic Solutions:** Choose practical over perfect when it delivers value faster

**When NOT to Over-Engineer:**
- Building for imaginary future requirements
- Creating abstractions with only one implementation
- Adding layers of indirection without clear benefit
- Optimizing before measuring actual performance needs
- Building generic systems when specific solutions work fine

### When to Refactor

**Refactor When:**
- **Files exceed 300-500 lines** and have multiple responsibilities
- **Functions exceed 50 lines** or have complex nested logic
- **Components have 5+ props** or manage multiple unrelated states
- **Code duplication** appears in 3+ places
- **Adding features becomes difficult** due to current structure
- **Tests are hard to write** because of tight coupling
- **Performance issues** are measured and traced to architecture

**DON'T Refactor When:**
- Code works fine and isn't actively being modified
- Deadlines are tight and changes are risky
- You don't fully understand the existing code
- Just because you prefer a different style
- Without tests to verify behavior preservation

### When to Create New Files

**Create New Files When:**
- **Single Responsibility:** A class/module handles one clear concern
- **File Length:** Existing file exceeds 500 lines of actual code
- **Logical Grouping:** Related functions/components form a cohesive unit
- **Reusability:** Code will be used in multiple places
- **Testing:** Separate files make unit testing easier
- **Team Collaboration:** Reduces merge conflicts on large files

**File Organization Guidelines:**
```typescript
// ❌ BAD: Everything in one file
// components/Dashboard.tsx (1000+ lines)
export const Dashboard = () => {
  // User management logic
  // Analytics logic  
  // Settings logic
  // Notification logic
}

// ✅ GOOD: Separated by concern
// components/Dashboard/index.tsx
// components/Dashboard/UserManagement.tsx
// components/Dashboard/Analytics.tsx
// components/Dashboard/Settings.tsx
// components/Dashboard/Notifications.tsx
```

### Best Practices for Our Tech Stack

**React/TypeScript Frontend:**
- **Component Size:** Keep components under 150 lines
- **Custom Hooks:** Extract complex logic into reusable hooks
- **Type Safety:** Define interfaces for all props and state
- **Lazy Loading:** Use React.lazy() for route-based code splitting
- **State Management:** Keep state as local as possible, lift only when needed

**Python/FastAPI Backend:**
- **Service Layer:** Separate business logic from route handlers
- **Dependency Injection:** Use FastAPI's dependency system for shared resources
- **Async First:** Use async/await for all I/O operations
- **Type Hints:** Always use type hints for better IDE support and validation
- **Error Handling:** Create custom exception classes for different error types

**Database/SQLAlchemy:**
- **Repository Pattern:** Isolate database queries in repository classes
- **Migrations:** Always use Alembic for schema changes
- **Query Optimization:** Use eager loading to prevent N+1 queries
- **Connection Management:** Let SQLAlchemy handle connection pooling

**General Patterns:**
- **Configuration:** Centralize config in environment-specific files
- **Logging:** Use structured logging with appropriate levels
- **Testing:** Aim for 80% coverage on critical paths
- **Documentation:** Document WHY, not WHAT (code shows what)
- **Comments:** Update or remove outdated comments immediately

## Testing Approach

### Testing Dashboard

**Comprehensive System Testing:** The Testing Dashboard provides centralized access to all system tests with real-time execution and result tracking.

**Access:** Navigate to `http://localhost:5173/testing` when running the development server.

**Available Test Categories:**
1. **Authentication (4 tests)**
   - Login validation with WorkFossa
   - JWT token generation and validation
   - User session management
   - Logout functionality

2. **Database (3 tests)**
   - Connection verification
   - Table existence checks
   - Basic CRUD operations

3. **Web Scraping (3 tests)**
   - WorkFossa authentication
   - Work order data extraction
   - Dispenser data retrieval

4. **Form Automation (3 tests)**
   - Playwright browser initialization
   - Page navigation capabilities
   - Form interaction testing

5. **Notifications (3 tests)**
   - Email configuration validation
   - Pushover service testing
   - Desktop notification system

6. **API Endpoints (4 tests)**
   - Health check endpoint
   - Protected route authentication
   - Work order API functionality
   - Settings API operations

7. **Filter System (2 tests)**
   - Filter calculation logic
   - Update detection mechanisms

8. **User Management (2 tests)**
   - User creation and validation
   - Multi-user data isolation

**Features:**
- **Real-time Execution:** Watch tests run with live status updates
- **Detailed Results:** View success/failure messages for each test
- **Copy Results:** One-click copying of all test results for sharing
- **Category Filtering:** Run specific test categories independently
- **Visual Indicators:** Clear pass/fail status with color coding

### Testing Guidelines

**When to Write Tests:**
1. **New Features:** Create tests before implementing functionality (TDD approach)
2. **Bug Fixes:** Add regression tests to prevent reoccurrence
3. **Refactoring:** Ensure behavior preservation with comprehensive tests
4. **API Changes:** Update endpoint tests with new parameters/responses
5. **Critical Paths:** Always test authentication, data operations, automation flows

**Test-First Development:**
```yaml
Workflow:
  1. Write failing test for new functionality
  2. Implement minimal code to pass test
  3. Refactor and optimize implementation
  4. Verify all tests still pass
  5. Use Testing Dashboard for final validation
```

**Using the Testing Dashboard:**
1. Start both frontend and backend servers
2. Navigate to `/testing` route
3. Click "Run All Tests" or select specific categories
4. Monitor real-time execution progress
5. Review detailed results for any failures
6. Use "Copy Results" to share test outcomes

### Test Implementation Patterns

**Backend Test Endpoint Structure:**
```python
@router.get("/test/feature")
async def test_feature():
    """Test endpoint following standard pattern"""
    try:
        # Perform test operations
        result = await perform_test()
        
        return {
            "success": True,
            "message": "Feature test passed",
            "details": result
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Feature test failed: {str(e)}",
            "error": str(e)
        }
```

**Frontend Test Integration:**
```typescript
// Testing service integration
const runTest = async (endpoint: string) => {
  try {
    const response = await api.get(`/api/test/${endpoint}`);
    return {
      passed: response.data.success,
      message: response.data.message,
      details: response.data.details
    };
  } catch (error) {
    return {
      passed: false,
      message: error.message,
      error: true
    };
  }
};
```

**Common Test Patterns:**
1. **Authentication Tests:** Validate credentials, check token generation
2. **Database Tests:** Verify connections, test CRUD operations
3. **Scraping Tests:** Mock browser interactions, validate data extraction
4. **API Tests:** Check endpoints, verify response formats
5. **Integration Tests:** Test full workflows across systems

### Testing with Sub-Agent Delegation

**Complex Test Debugging:**
When tests fail or need investigation, use sub-agent delegation:

```yaml
Main Task: "Fix failing authentication tests"
Sub-Agent Tasks:
  1. "Analyze test failure logs"
  2. "Trace authentication flow"
  3. "Identify root cause"
  4. "Implement fix"
  5. "Verify all tests pass"
```

**Test Creation Delegation:**
```yaml
Main Task: "Add comprehensive filter system tests"
Sub-Agent Tasks:
  1. "Research existing filter logic"
  2. "Design test scenarios"
  3. "Implement test endpoints"
  4. "Add frontend integration"
  5. "Document test coverage"
```

### Troubleshooting Test Failures

**Common Authentication Test Issues:**
- **Invalid Credentials:** Check WorkFossa test account status
- **Token Expiry:** Verify JWT configuration and expiry settings
- **Session Issues:** Clear browser storage and retry

**Database Test Failures:**
- **Connection Errors:** Verify database file exists and permissions
- **Schema Issues:** Run migrations or check table definitions
- **Lock Conflicts:** Ensure no other processes accessing database

**API Test Problems:**
- **CORS Errors:** Check backend CORS configuration
- **Port Conflicts:** Verify services running on correct ports
- **Timeout Issues:** Increase test timeout values

**Scraping Test Failures:**
- **Selector Changes:** Update selectors if WorkFossa UI changed
- **Browser Issues:** Clear browser data or restart Playwright
- **Network Problems:** Check internet connectivity and proxies

### Testing Commands

**Run Testing Dashboard:**
```bash
# Terminal 1: Start backend
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
npm run dev

# Access dashboard at: http://localhost:5173/testing
```

**Backend Test Commands:**
```bash
# Run all backend tests (when organized)
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
pytest tests/

# Run specific test category
pytest tests/test_authentication.py -v

# Run with coverage
pytest --cov=app tests/
```

**Frontend Test Commands:**
```bash
# Run frontend tests (when implemented)
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
npm test

# Run with watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

**Integration Test Pattern:**
```bash
# Start services in test mode
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Test Result Sharing

**Using Copy Results Feature:**
1. Run tests in Testing Dashboard
2. Click "Copy Results" button
3. Share formatted results in documentation or issues
4. Example format:
   ```
   Test Results - 2025-01-26 10:00 AM
   =====================================
   
   Authentication Tests: 4/4 passed ✅
   - Login Test: PASSED
   - Token Validation: PASSED
   - User Session: PASSED
   - Logout Test: PASSED
   
   Database Tests: 3/3 passed ✅
   ...
   ```

### Testing Best Practices

**DO:**
- Write tests before implementing features
- Use Testing Dashboard for validation
- Keep tests focused and independent
- Mock external dependencies
- Test edge cases and error conditions
- Document test purposes clearly

**DON'T:**
- Skip tests for "simple" features
- Hardcode test data that might change
- Create interdependent tests
- Ignore failing tests
- Test implementation details
- Leave console.log in test code

### Dual Testing Strategy

**When creating automation tests, ALWAYS create two versions:**

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

## Workflow Automation Patterns

### Quick Start Commands

**Morning Startup Routine:**
```yaml
/fossa:startup:
  1. Check git status and pull latest
  2. Verify environment setup
  3. Start backend and frontend
  4. Run quick health check
  5. Display pending tasks
  6. Show recent notifications
```

**End of Day Routine:**
```yaml
/fossa:shutdown:
  1. Commit any uncommitted changes
  2. Push to remote
  3. Generate daily summary
  4. Backup critical data
  5. Clean temporary files
  6. Stop all services
```

### Context Priming Patterns

**Before Major Work:**
```yaml
Pattern: Load → Analyze → Plan → Execute
Commands:
  /fossa:context [area]     # Load domain knowledge
  /fossa:analyze [target]   # Understand current state
  TodoWrite                 # Plan tasks
  /fossa:feature [name]     # Execute implementation
```

**Debugging Session:**
```yaml
Pattern: Reproduce → Isolate → Fix → Verify
Commands:
  /fossa:debug [component]  # Interactive debugging
  /fossa:monitor [metric]   # Collect data
  /fossa:fix [issue]       # Apply solution
  /fossa:test [category]   # Verify fix
```

### Error Recovery Patterns

**Scraping Failure Recovery:**
```yaml
On Failure:
  1. /fossa:debug scraper
  2. Check selectors against current UI
  3. Update selectors if changed
  4. Test with single work order
  5. Run full scrape if successful
```

**Authentication Timeout Recovery:**
```yaml
On Timeout:
  1. /fossa:debug auth
  2. Check token expiry settings
  3. Implement refresh mechanism
  4. Test with extended session
  5. Update authentication flow
```

## Enhanced Development Workflows

### Performance Optimization Workflow
```yaml
Identify: /fossa:monitor performance
Analyze: /fossa:analyze performance
Plan: TodoWrite optimization tasks
Execute: Implement optimizations
Verify: /fossa:test performance
Document: Update performance guidelines
```

### Security Hardening Workflow
```yaml
Audit: /fossa:analyze security
Prioritize: Review CRITICAL issues
Fix: Implement security patches
Test: /fossa:test auth
Deploy: /fossa:deploy-check
Monitor: /fossa:monitor errors
```

### Feature Development Workflow
```yaml
Design: /fossa:context [area]
Scaffold: /fossa:feature [name]
Implement: Code with sub-agents
Test: /fossa:test all
Review: /fossa:analyze architecture
Ship: /fossa:pr main
```

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

**Comprehensive Logging System:**

The application includes a sophisticated logging system that captures ALL browser console output and server logs to organized files in `/logs/`.

**Logging Architecture:**
- **Backend Service:** `backend/app/services/logging_service.py` - Centralized logging configuration
- **Frontend Service:** `frontend/src/services/fileLoggingService.ts` - Browser console interception
- **API Endpoint:** `/api/v1/logs/write` - Receives frontend logs and writes to files
- **File Format:** JSONL (JSON Lines) with date-based rotation

**Log Directory Structure:**
```
/logs/
├── automation/          # Automation task logs
├── backend/             # Backend server logs
│   ├── backend-general-{date}.jsonl
│   ├── backend-api-{date}.jsonl
│   └── backend-errors-{date}.jsonl
├── errors/              # All error logs (frontend + backend)
├── frontend/            # Frontend browser logs
│   ├── frontend-general-{date}.jsonl    # ALL console output
│   ├── frontend-api-{date}.jsonl        # API calls
│   ├── frontend-components-{date}.jsonl # React component logs
│   └── frontend-errors-{date}.jsonl     # JavaScript errors
├── performance/         # Performance metrics
└── sessions/           # Individual user session logs
    └── frontend-{timestamp}-{sessionId}.jsonl
```

**Frontend Console Capture:**
- Automatically intercepts: `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug`
- Captures unhandled errors and promise rejections
- Buffers logs and sends to backend every 5 seconds
- Falls back to localStorage if backend unavailable
- Each session gets unique ID for tracking

**Backend Logging Configuration:**
- Structured JSON logging with timestamps
- Automatic categorization by log content
- Request ID tracking for correlation
- API request/response logging with timing
- Database query monitoring

**Accessing Logs:**
- **View Logs:** Check `/logs/` directory for all captured output
- **Download:** API endpoints available for log retrieval
- **Stats:** `/api/v1/logs/stats` provides log file statistics
- **Real-time:** Logs written within seconds of generation

**Logging Guidelines:**
- **Backend:** Use Python's `logging` module with structured logs
- **Frontend:** All console output automatically captured to files
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

### Claude Code SDK for Python

**The Claude Code SDK** enables programmatic interaction with Claude Code from Python applications. This allows integration of Claude's capabilities directly into scripts and automation workflows.

**Quick Start:**
```python
import anyio
from claude_code_sdk import query

async def main():
    async for message in query(prompt="What is 2 + 2?"):
        print(message)

anyio.run(main)
```

**Key Features:**
- Async API for querying Claude
- Tool usage support (Read, Write, Edit, Bash, etc.)
- Configurable options for behavior control
- Error handling with specific exception types
- Session management for continued conversations

**Documentation:** See `/docs/guides/claude-code-sdk-usage.md` for comprehensive usage guide, examples, and best practices.

**Installation:** `pip install claude-code-sdk` (requires Python 3.10+)

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
- **BrowserMCP:** Human-like browser interaction with permission-based controls

**Quick Usage:**
- MCP servers complement existing project automation (form automation, web scraping, batch processing)
- Choose servers based on specific task requirements (analysis, automation, problem-solving)
- Monitor resource usage; MCP servers consume additional system resources
- Ensure API keys are properly configured for full functionality

**Configuration Location:** `~/.claude/claude_desktop_config.json` (global MCP configuration)

### BrowserMCP Integration

**BrowserMCP** provides human-like browser automation with permission-based controls, designed for safe and controlled web interactions.

**When to Use BrowserMCP:**
- **User Research Tasks:** When you need to browse websites and gather information interactively
- **Form Testing:** For testing web forms with real user-like interactions
- **UI Verification:** To verify UI elements work correctly from a user perspective
- **Web Navigation:** For tasks requiring navigation through multi-page workflows
- **Screenshot Capture:** To document current page states or UI issues

**Key Features:**
- **Permission-Based:** Requires user approval before interacting with page elements
- **Accessibility-Focused:** Uses accessibility tree for reliable element identification
- **Human-Readable:** Provides clear descriptions of actions being performed
- **Safe by Design:** Cannot perform actions without explicit user consent

**Usage Pattern:**
```yaml
1. Navigate: Use browser_navigate to go to target URL
2. Snapshot: Use browser_snapshot to get accessibility tree
3. Interact: Use browser_click/type/select with element refs
4. Verify: Use browser_screenshot to capture results
```

**Available Tools:**
- `mcp__browsermcp__browser_navigate` - Navigate to URLs
- `mcp__browsermcp__browser_snapshot` - Get page accessibility tree
- `mcp__browsermcp__browser_click` - Click elements (with permission)
- `mcp__browsermcp__browser_type` - Type text into inputs (with permission)
- `mcp__browsermcp__browser_select_option` - Select dropdown options
- `mcp__browsermcp__browser_hover` - Hover over elements
- `mcp__browsermcp__browser_press_key` - Press keyboard keys
- `mcp__browsermcp__browser_wait` - Wait for specified time
- `mcp__browsermcp__browser_screenshot` - Capture page screenshots
- `mcp__browsermcp__browser_go_back/forward` - Browser navigation
- `mcp__browsermcp__browser_get_console_logs` - Retrieve console output

**Best Practices:**
1. **Always snapshot first** to understand page structure before interactions
2. **Use descriptive element names** when requesting permissions
3. **Verify actions** with screenshots after important operations
4. **Handle errors gracefully** - pages may change or elements may not exist
5. **Respect rate limits** - avoid rapid automated actions

**Example Workflow:**
```python
# 1. Navigate to page
browser_navigate(url="https://example.com/form")

# 2. Get page structure
browser_snapshot()  # Returns accessibility tree

# 3. Fill form (requires permission)
browser_type(
    element="Email input field", 
    ref="[4] textbox 'Email'",
    text="user@example.com",
    submit=False
)

# 4. Submit form (requires permission)
browser_click(
    element="Submit button",
    ref="[8] button 'Submit'"
)

# 5. Verify result
browser_screenshot()
```

**When NOT to Use BrowserMCP:**
- **Automated Scraping:** Use Playwright/Puppeteer MCP for programmatic scraping
- **Batch Operations:** Not suitable for processing multiple items automatically
- **Background Tasks:** Requires interactive approval, not for unattended automation
- **Performance Testing:** Use dedicated performance testing tools instead

**Integration with FossaWork:**
BrowserMCP can complement existing automation by:
- Manually testing form automation workflows before batch processing
- Verifying WorkFossa UI changes that might affect scraping
- Debugging failed automation scenarios interactively
- Documenting UI workflows with screenshots for training

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

**Automated Creation (Recommended):**
```bash
# Create worktree AND automatically set up environment
./scripts/setup/git-worktree-create.sh <worktree-name> <branch-name>

# Examples:
./scripts/setup/git-worktree-create.sh form-prep feature/form-prep
./scripts/setup/git-worktree-create.sh bugfix-auth bugfix/auth-token
```

**Manual Creation:**
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

**Automatic Setup (using the creation script):**
When you use the `git-worktree-create.sh` script, all environment setup is handled automatically:
- Creates the worktree with specified branch
- Installs all npm dependencies (root, frontend, backend)
- Sets up Python virtual environment
- Installs Python requirements
- Provides ready-to-use development commands

**Manual Setup (if created without the script):**
1. Navigate to worktree: `cd ../FossaWorkV2-feature-name`
2. Install dependencies: `npm install`
3. Frontend deps: `cd frontend && npm install && cd ..`
4. Backend deps: `cd backend && npm install && cd ..`
5. Python venv (if needed): `cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`

**Alternative Setup Scripts:**
- `scripts/setup/setup-worktree.sh` - Run from within a worktree to set up environment
- `scripts/setup/setup-worktree-with-mcp.sh` - Includes MCP server setup

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

## Continuous Improvement Patterns

### Code Quality Evolution

**Regular Quality Audits:**
```yaml
Weekly:
  /fossa:analyze architecture  # Check for technical debt
  /fossa:analyze dependencies  # Update outdated packages
  /fossa:test all            # Ensure all tests pass

Monthly:
  /fossa:analyze security     # Full security audit
  /fossa:analyze performance  # Performance profiling
  Generate improvement roadmap
```

**Refactoring Cycles:**
```yaml
Identify: Use /fossa:analyze to find problem areas
Prioritize: Focus on high-impact, low-risk improvements
Implement: Refactor in small, testable chunks
Verify: Run comprehensive tests after each change
Document: Update architecture docs with changes
```

### Knowledge Management

**Documentation Evolution:**
```yaml
After Each Feature:
  1. Update technical docs in /ai_docs/
  2. Update user guides in /docs/guides/
  3. Update API documentation
  4. Add to quick reference
  5. Update Notion documentation

Weekly Review:
  1. Check for outdated information
  2. Consolidate duplicate content
  3. Fill documentation gaps
  4. Update troubleshooting guides
```

**Learning from Issues:**
```yaml
Pattern: Issue → Fix → Prevention
Process:
  1. Document issue in Known Issues
  2. Create automated test
  3. Add to /fossa:fix command
  4. Update monitoring
  5. Share knowledge in CLAUDE.md
```

### Automation Evolution

**Command Enhancement:**
```yaml
Track Usage:
  - Monitor which commands used most
  - Identify repetitive patterns
  - Create new automation

Improve Commands:
  - Add parameters for flexibility
  - Combine related commands
  - Optimize execution speed
  - Add error recovery
```

**Workflow Optimization:**
```yaml
Monthly Review:
  1. Analyze development patterns
  2. Identify bottlenecks
  3. Create new workflows
  4. Test and refine
  5. Document best practices
```

### Project Metrics & Insights

**Development Velocity:**
```yaml
Track:
  - Feature completion time
  - Bug resolution speed
  - Test coverage trends
  - Code quality metrics
  - User satisfaction

Improve:
  - Automate repetitive tasks
  - Enhance tooling
  - Optimize workflows
  - Remove blockers
```

**System Health Monitoring:**
```yaml
Daily: /fossa:monitor performance
Weekly: /fossa:analyze architecture  
Monthly: Full system audit
Quarterly: Strategic planning

Key Metrics:
  - API response times
  - Scraping success rates
  - Automation reliability
  - Error frequencies
  - Resource usage
```

### Future-Proofing Strategies

**Technology Evolution:**
```yaml
Stay Current:
  - Monitor framework updates
  - Evaluate new tools
  - Test in isolated environments
  - Plan migration strategies
  - Document decisions

Adopt Carefully:
  - Proof of concept first
  - Measure impact
  - Train team
  - Update documentation
  - Monitor stability
```

**Scalability Planning:**
```yaml
Growth Considerations:
  - User load projections
  - Data volume estimates
  - Performance benchmarks
  - Infrastructure needs
  - Cost optimization

Implementation:
  - Design for horizontal scaling
  - Optimize database queries
  - Implement caching strategies
  - Use queue systems
  - Monitor resource usage
```

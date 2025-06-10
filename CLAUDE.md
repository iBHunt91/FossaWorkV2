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

**Key Features:** Multi-user support, web scraping, form automation (single/batch), notifications (Email/Pushover/Desktop), schedule management, progress tracking.

**Tech Stack:** React 18+/TypeScript/Vite/TailwindCSS, Express.js, Electron 35+, Playwright, JSON storage, Node-cron.

## Essential Commands

**Development:**
- `npm run electron:dev:start` - Primary dev command (all services)
- `npm start` / `npm run dev` / `npm run server` - Individual services
- `npm run fix-vite-cache` / `npm run fix-vite-full` - Fix Vite issues

**Building:** `npm run build`, `npm run electron:build`

**Testing:** `npm test`, `npm run test:*` (notifications, automation, batch, etc.)

**Maintenance:** `npm run lint`, `npm run cleanup-ports`, `npm run backup`, `npm run fix-*`

## Core Systems

**Batch Automation:** Sequential work order processing with progress tracking, pause/resume, error recovery.
- Frontend: `src/components/BatchVisitAutomation.tsx`
- Backend: `server/form-automation/AutomateForm.js`
- API: `server/routes/formAutomation.js`

**Form Automation:** Playwright-based form filling with job code support:
- 2861, 3002: All Dispensers (AccuMeasure)
- 2862: Specific Dispensers (AccuMeasure, filtered)
- 3146: Open Neck Prover

**Notifications:** Multi-channel system (Email, Pushover, Desktop) with centralized formatting.

**Web Scraping:** Automated data collection with change detection and notification triggering.

## Environment & Troubleshooting

**Environment:** WSL2 development, Windows target platform. Use cross-platform commands, Unix-style paths in app, Windows browser paths.

**Common Issues:**
- **Vite Cache:** Symptoms: `ERR_ABORTED 504`, module load failures. Auto-recovery via `ViteCacheErrorBoundary`. Manual: `npm run fix-vite-cache`
- **Multi-user isolation:** User data in `data/users/{userId}/`, credentials per-user, not global
- **Browser automation:** WSL requires `--no-sandbox --disable-dev-shm-usage` args

## Critical Memory

**Security Issues (HIGH PRIORITY):** Plain text credentials, no API auth, insufficient validation. See `/ai_docs/reference/comprehensive-codebase-analysis-2025.md`

**Data Architecture:** JSON file-based storage. Global: `data/`, User-specific: `data/users/{userId}/`. Multi-user isolation enforced.

**Code Quality:** A- (88/100). Excellent: modern stack, modular design. Needs: security fixes, component decomposition.

**Testing:** Unit/Integration/Performance/Cross-platform tests in `/tests/` subdirectories (never root).

**Recent Work:** Documentation consolidated (107→67 files, 37% reduction). Batch/AccuMeasure/Form automation unified.

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
   - /tools/unix/ - Unix shell scripts and cross-platform tools
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
- V1-Archive-2025-01-07/ directory (left untouched as requested)
```

## Claude Code Tools

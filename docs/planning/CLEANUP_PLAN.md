# Immediate Cleanup Plan - Feature/Hourly-Scrape Branch

## Overview
This plan addresses the critical issues identified in the code audit to prepare the branch for safe merging.

## Phase 1: File Organization (Priority: CRITICAL)

### 1.1 Backend Scripts Organization
```bash
# Create proper directory structure
backend/tests/
├── unit/
├── integration/
├── fixtures/
└── scripts/

backend/scripts/
├── debug/
├── maintenance/
├── migration/
├── monitoring/
└── utilities/
```

**Actions:**
- Move all test_*.py files to backend/tests/
- Move debug_*.py to backend/scripts/debug/
- Move check_*.py to backend/scripts/monitoring/
- Move fix_*.py to backend/scripts/maintenance/
- Keep only essential scripts in backend/scripts/

### 1.2 Documentation Consolidation
```bash
docs/
├── features/
│   ├── hourly-scraping.md
│   ├── weekend-mode.md
│   └── scraping-schedules.md
├── implementation/
│   ├── completed/
│   └── in-progress/
├── maintenance/
│   └── fixes/
└── archive/
```

**Actions:**
- Move all root *.md files to appropriate docs/ subdirectories
- Keep only README.md and CLAUDE.md in root
- Archive old implementation notes

### 1.3 Root Directory Cleanup
**Remove/Relocate:**
- Claudia launcher scripts → tools/launchers/
- Shell scripts → tools/scripts/
- Implementation summaries → docs/implementation/completed/

## Phase 2: Test Coverage (Priority: HIGH)

### 2.1 Test Structure Setup
```python
# backend/tests/conftest.py
# backend/tests/unit/test_scraping_schedules.py
# backend/tests/unit/test_scheduler_service.py
# backend/tests/integration/test_hourly_scraping.py
# frontend/tests/components/test_weekend_mode.ts
# frontend/tests/components/test_scraping_status.ts
```

### 2.2 Critical Tests to Add
1. Scheduler service functionality
2. Hourly scraping job execution
3. Weekend mode detection logic
4. Scraping status updates
5. Work order cleanup process

## Phase 3: Code Consolidation (Priority: HIGH)

### 3.1 Script Deduplication
- Identify duplicate functionality in debug scripts
- Consolidate into reusable utilities
- Remove one-off debug scripts

### 3.2 Create Utility Modules
```python
# backend/app/utils/debugging.py
# backend/app/utils/testing.py
# backend/app/utils/monitoring.py
```

## Phase 4: Branch Splitting Strategy (Priority: MEDIUM)

### 4.1 Proposed PR Breakdown
1. **PR1: Backend Infrastructure** - Scheduler service, models
2. **PR2: API Endpoints** - Scraping schedules routes
3. **PR3: Frontend Components** - ScrapingStatus, ScrapingSchedule
4. **PR4: Weekend Mode** - Complete feature
5. **PR5: UI Improvements** - Settings, Navigation updates
6. **PR6: Bug Fixes** - All fixes as separate PR

### 4.2 Git Strategy
```bash
# Create feature branches from current branch
git checkout -b feature/hourly-scrape-backend
git checkout -b feature/hourly-scrape-frontend
git checkout -b feature/weekend-mode
git checkout -b fix/react-hooks-errors
```

## Execution Timeline

### Day 1 (Today)
- [ ] File organization cleanup
- [ ] Documentation consolidation
- [ ] Remove duplicate scripts

### Day 2
- [ ] Setup test structure
- [ ] Write critical path tests
- [ ] Consolidate utilities

### Day 3
- [ ] Split branch into PRs
- [ ] Create clean commits
- [ ] Prepare for review

## Success Criteria
- ✅ All files properly organized per CLAUDE.md
- ✅ Test coverage >50% for new features
- ✅ No duplicate/redundant scripts
- ✅ Documentation properly structured
- ✅ Branch split into <6 reviewable PRs
- ✅ Each PR <500 lines of changes

## Risk Mitigation
- Create backup branch before reorganization
- Test all moved files still work
- Verify imports after moving files
- Document all changes made

---
Let's begin execution!
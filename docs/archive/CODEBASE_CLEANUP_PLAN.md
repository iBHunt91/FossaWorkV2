# 🧹 FossaWork V2 Codebase Cleanup Plan

## 🎯 Cleanup Objectives

1. **Security**: Remove exposed credentials and implement proper security practices
2. **Organization**: Create logical, maintainable directory structure
3. **Size Reduction**: Remove ~2.5GB of unnecessary files (from 2.8GB to ~300MB)
4. **Maintainability**: Establish clear patterns and conventions
5. **Future-Proofing**: Set up systems to prevent future decay

## 🚨 Phase 1: Critical Security & Size Issues (IMMEDIATE)

### 1.1 Security Cleanup
```bash
# Remove exposed credentials
rm -rf "V1-Archive-2025-01-07"  # Contains exposed .env file
# Note: All credentials must be rotated after this cleanup
```

### 1.2 Size Reduction
```bash
# Remove large unnecessary directories
rm -rf node_modules/           # 1.2GB - will be regenerated
rm -rf backend/venv/           # Virtual environment - will be recreated
rm -rf frontend/node_modules/  # 125MB - will be regenerated
rm -rf .history/               # History artifacts

# Remove duplicate database files
rm fossawork_dev.db           # Keep backend/ versions only
rm fossawork_v2.db           # Keep backend/ versions only
```

### 1.3 Create Proper .gitignore
```gitignore
# Dependencies
node_modules/
backend/venv/
backend/.venv/
__pycache__/
*.pyc

# Database files
*.db
*.sqlite
*.sqlite3

# Environment files
.env
.env.local
.env.production

# Build outputs
dist/
build/
.vite/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Backup files
*.bak
*.backup
*~

# Logs
*.log
logs/

# Screenshots and exports
screenshots/
exports/
*.png
*.jpg
*.json.export

# Development artifacts
.history/
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
```

## 📁 Phase 2: Directory Reorganization (SHORT-TERM)

### 2.1 Backend Reorganization
```
backend/
├── app/                    # Main application (already good)
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
├── scripts/                # NEW: Data management scripts
│   ├── data_summary.py
│   ├── export_data.py
│   ├── formatted_viewer.py
│   ├── view_data_formatted.py
│   └── show_*.py
├── tests/                  # Test files (already exists)
├── data/                   # NEW: Generated data
│   ├── exports/
│   ├── screenshots/
│   └── logs/
├── alembic/               # Database migrations (already good)
├── requirements.txt       # Dependencies
└── README.md             # Backend-specific documentation
```

### 2.2 Frontend Reorganization
```
frontend/
├── src/                   # Already well organized
├── public/               # Static assets
├── tests/                # Frontend tests
├── package.json          # Dependencies
├── vite.config.ts        # Build configuration
└── README.md            # Frontend-specific documentation
```

### 2.3 Root Level Organization
```
/
├── backend/              # Backend application
├── frontend/             # Frontend application
├── docs/                 # NEW: All documentation
│   ├── planning/         # Project planning documents
│   ├── guides/           # User and development guides
│   ├── api/              # API documentation
│   └── archive/          # Historical documents
├── scripts/              # NEW: Project-level scripts
│   ├── setup/            # Setup and installation
│   ├── deployment/       # Deployment scripts
│   └── maintenance/      # Maintenance utilities
├── tools/                # NEW: Development tools
│   ├── windows/          # Windows batch files
│   └── unix/             # Unix shell scripts
├── config/               # Project configuration
├── tests/                # Integration tests
├── .gitignore           # Proper gitignore
├── README.md            # Main project documentation
├── CLAUDE.md            # Claude instructions (improved)
└── package.json         # Root package.json for monorepo
```

## 🔧 Phase 3: File Migration & Cleanup (MEDIUM-TERM)

### 3.1 Move Documentation
```bash
mkdir -p docs/{planning,guides,api,archive}

# Move planning documents
mv REBUILD_PLAN_*.md docs/planning/
mv PHASE_*.md docs/planning/
mv *_PLAN_*.md docs/planning/

# Move guides
mv STARTUP_TROUBLESHOOTING.md docs/guides/
mv README.md docs/guides/MAIN_README.md
mv DATA_VIEWING_GUIDE.md docs/guides/

# Archive analysis documents
mv CODEBASE_*.md docs/archive/
mv COMPREHENSIVE_*.md docs/archive/
```

### 3.2 Move Scripts
```bash
mkdir -p scripts/{setup,deployment,maintenance}

# Move backend data scripts
mkdir -p backend/scripts
mv backend/data_summary.py backend/scripts/
mv backend/export_data.py backend/scripts/
mv backend/formatted_viewer.py backend/scripts/
mv backend/view_data_formatted.py backend/scripts/
mv backend/show_*.py backend/scripts/

# Move setup scripts
mv verify_foundation.py scripts/setup/

# Move Windows tools
mkdir -p tools/windows
mv *.bat tools/windows/
```

### 3.3 Clean Up Test Files
```bash
# Remove scattered test files
rm test-*.py
rm test-*.js
rm debug-*.js

# Organize remaining tests
mkdir -p tests/integration
# Move relevant test files to proper test directories
```

### 3.4 Remove Backup Files
```bash
# Remove all backup files
find . -name "*.bak" -delete
find . -name "*.backup" -delete
find . -name "*~" -delete

# Remove backup directories
rm -rf backup/
rm -rf old-backups/
```

## 📋 Phase 4: Standardization (LONG-TERM)

### 4.1 Naming Convention Standards

**Python Files**: `snake_case.py`
- ✅ `workfossa_automation.py`
- ✅ `data_summary.py`

**JavaScript/TypeScript**: `camelCase.js/.ts`
- ✅ `formAutomation.js`
- ✅ `apiService.ts`

**React Components**: `PascalCase.tsx`
- ✅ `WorkOrderCard.tsx`
- ✅ `DataSummary.tsx`

**Directories**: `kebab-case` or `snake_case`
- ✅ `work-orders/`
- ✅ `user_management/`

### 4.2 File Organization Patterns

**Configuration Files**: `/config/`
**Documentation**: `/docs/`
**Scripts**: `/{component}/scripts/`
**Tests**: `/{component}/tests/`
**Generated Data**: `/{component}/data/`

## 🎯 Phase 5: Maintenance & Prevention

### 5.1 Create Maintenance Scripts
```bash
#!/bin/bash
# cleanup.sh - Regular maintenance script

echo "🧹 Running FossaWork V2 maintenance..."

# Remove temporary files
find . -name "*.tmp" -delete
find . -name "*.temp" -delete

# Clean up log files older than 30 days
find . -name "*.log" -mtime +30 -delete

# Remove empty directories
find . -type d -empty -delete

echo "✅ Maintenance complete"
```

### 5.2 Pre-commit Hooks
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for accidentally committed secrets
if grep -r "password\|secret\|token" --include="*.py" --include="*.js" --include="*.ts" .; then
    echo "🚨 Potential secrets detected!"
    exit 1
fi

# Check for backup files
if find . -name "*.bak" -o -name "*.backup" | grep -q .; then
    echo "🚨 Backup files detected!"
    exit 1
fi
```

## 📊 Cleanup Impact

### Before Cleanup:
- **Total Size**: 2.8GB
- **V1 Archive**: 1.3GB (46%)
- **node_modules**: 1.2GB (43%)
- **Actual Code**: ~300MB (11%)
- **Organization**: Poor (scattered files)

### After Cleanup:
- **Total Size**: ~300MB (89% reduction)
- **Code**: ~300MB (100% of repository)
- **Organization**: Excellent (logical structure)
- **Security**: Secure (no exposed credentials)
- **Maintainability**: High

## ✅ Success Criteria

1. **Repository size** reduced from 2.8GB to ~300MB
2. **Zero security vulnerabilities** (no exposed credentials)
3. **Clear directory structure** with logical organization
4. **Consistent naming conventions** throughout
5. **Proper .gitignore** preventing future bloat
6. **Documentation** properly organized in `/docs/`
7. **Development tools** organized in `/tools/`
8. **No backup files** in version control

## 🚀 Implementation Order

1. ✅ **CRITICAL**: Remove security vulnerabilities (V1-Archive)
2. ✅ **HIGH**: Create .gitignore and remove large files
3. ✅ **HIGH**: Reorganize directory structure
4. ✅ **MEDIUM**: Move and organize files
5. ✅ **MEDIUM**: Standardize naming conventions
6. ✅ **LOW**: Create maintenance procedures
7. ✅ **LOW**: Set up automation/hooks

---

*This cleanup plan will transform FossaWork V2 from a 2.8GB cluttered codebase to a clean, secure, 300MB professional project ready for long-term maintenance and development.*
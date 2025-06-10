# Codebase Cleanup

Clean and organize the codebase following best practices.

## Execution Steps

1. Scan for cleanup targets:
   - Backup files (.bak, .backup, ~)
   - Temporary files (.tmp, .temp)
   - Editor files (.swp, .swo)
   - Log files in wrong locations
   - Duplicate files
2. Check dependency health:
   - Unused dependencies in package.json
   - Duplicate packages
   - Security vulnerabilities
   - Version conflicts
   - Lock file integrity
3. Organize file structure:
   - Move files to proper directories
   - Fix naming conventions
   - Consolidate similar files
   - Remove empty directories
   - Update import paths
4. Clean build artifacts:
   - Clear dist/ directories
   - Remove old bundles
   - Clean node_modules
   - Clear cache directories
   - Remove compiled files
5. Update .gitignore:
   - Add missing patterns
   - Remove obsolete entries
   - Check effectiveness
   - Add comments
6. Fix code issues:
   - Remove console.logs
   - Delete commented code
   - Fix linting errors
   - Remove unused imports
   - Clean up TODOs
7. Optimize assets:
   - Compress images
   - Remove unused assets
   - Organize asset folders
   - Update references
8. Generate cleanup report:
   - Files removed/moved
   - Space saved
   - Issues fixed
   - Remaining tasks

## Parameters
- `--dry-run`: Preview changes without applying
- `--interactive`: Confirm each action
- `--aggressive`: Include more file types
- `--preserve-logs`: Keep log files
- `--backup`: Create backup before cleanup

## Example Usage

```
/codebase-cleanup --dry-run
```

```
/codebase-cleanup --interactive --backup
```

## Cleanup Rules

### File Types to Remove
- `*.bak`, `*.backup`, `*.old`
- `*.tmp`, `*.temp`, `*.cache`
- `.DS_Store`, `Thumbs.db`
- `*.log` (except in /logs)
- `~*` (editor backups)

### Directory Organization
```
/src              → Source code only
/tests            → Test files
/docs             → Documentation
/scripts          → Utility scripts
/tools            → Development tools
/logs             → Log files only
/dist, /build     → Build output
```

### Naming Conventions
- React: PascalCase.tsx
- Services: camelCase.ts
- Utils: camelCase.js
- Tests: *.test.ts
- Styles: kebab-case.css

## Safety Measures
- Always backup first
- Test after cleanup
- Verify git status
- Check application runs
- Update documentation
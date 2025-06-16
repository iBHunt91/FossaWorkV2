# migrate-tests

Automated tool to organize and migrate test files to the proper directory structure according to FossaWork V2 standards.

## Usage
```
/migrate-tests [options]
```

## Options
- `--dry-run` - Preview changes without moving files
- `--fix-imports` - Update import paths after migration
- `--create-structure` - Create missing test directories
- `--interactive` - Confirm each file move

## Test Organization Structure

```
/tests/
├── backend/
│   ├── api/          # API endpoint tests
│   ├── auth/         # Authentication tests
│   ├── services/     # Service layer tests
│   ├── models/       # Model and database tests
│   ├── scraping/     # Web scraping tests
│   ├── integration/  # Integration tests
│   └── unit/         # Unit tests
├── frontend/
│   ├── components/   # React component tests
│   ├── pages/        # Page component tests
│   ├── hooks/        # Custom hook tests
│   ├── utils/        # Utility function tests
│   └── integration/  # Frontend integration tests
└── e2e/              # End-to-end tests
```

## Migration Process

1. **Scan for misplaced tests**
   - Files matching `test_*.py`, `*_test.py`
   - Files matching `*.test.{js,jsx,ts,tsx}`
   - Files matching `*.spec.{js,jsx,ts,tsx}`

2. **Categorize by content**
   - Analyze imports and test descriptions
   - Determine appropriate category
   - Suggest target directory

3. **Update imports**
   - Fix relative imports
   - Update test configuration paths
   - Maintain functionality

4. **Create test indexes**
   - Generate `__init__.py` files
   - Create test suite runners
   - Update test documentation

## Example Output

```
🔍 Scanning for test files...

Found 73 test files to migrate:

Backend Tests (52 files):
  ✓ backend/test_auth.py → tests/backend/auth/test_auth.py
  ✓ backend/test_scraper.py → tests/backend/scraping/test_scraper.py
  ✓ backend/test_work_orders.py → tests/backend/api/test_work_orders.py
  ... 49 more files

Frontend Tests (21 files):
  ✓ frontend/src/Login.test.tsx → tests/frontend/components/test_login.tsx
  ✓ frontend/src/utils.test.js → tests/frontend/utils/test_utils.js
  ... 19 more files

Import Updates:
  ✓ Updated 34 import statements
  ✓ Fixed 12 configuration paths

Summary:
  ✓ 73 files migrated successfully
  ✓ 0 errors
  ✓ Test suite remains functional
```

## Benefits

1. **Organized Structure**: Tests grouped by functionality
2. **Easier Discovery**: Find related tests quickly
3. **Better CI/CD**: Run specific test suites
4. **Maintainability**: Clear separation of concerns
5. **Standards Compliance**: Follows project guidelines

## Post-Migration

After migration:
1. Run full test suite to verify
2. Update CI/CD test commands
3. Update test documentation
4. Configure IDE test runners
5. Update .gitignore if needed
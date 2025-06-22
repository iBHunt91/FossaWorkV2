# Task Completion Checklist

When completing any development task in FossaWork V2, follow this checklist:

## 1. Code Quality Checks

### Python (Backend)
```bash
# Format code with Black
black backend/

# Sort imports with isort
isort backend/

# Run linting
flake8 backend/ --max-line-length=88 --extend-ignore=E203,W503

# Run type checking (if mypy is configured)
mypy backend/
```

### TypeScript/React (Frontend)
```bash
# Run ESLint
npm run lint

# Format with Prettier (if not auto-formatted)
npx prettier --write "frontend/src/**/*.{ts,tsx,js,jsx}"
```

## 2. Run Tests

### Backend Tests
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
pytest -v                    # Run all tests verbose
pytest -m "not slow"         # Skip slow tests
pytest --cov=app            # With coverage
```

### Frontend Tests
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
npm test                    # Run all tests
npm run test:watch          # Watch mode for development
```

## 3. Pre-commit Hooks

Run all pre-commit hooks before committing:
```bash
pre-commit run --all-files
```

This will run:
- Black (Python formatting)
- isort (Import sorting)
- Flake8 (Python linting)
- Prettier (JS/TS formatting)
- Security checks (detect-secrets, bandit)
- File organization checks
- Custom FossaWork checks

## 4. Manual Testing

### Start Development Servers
```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

### Test Key Workflows
- [ ] User authentication (login/logout)
- [ ] Work order scraping
- [ ] Form automation (if changed)
- [ ] API endpoints affected by changes
- [ ] UI components and interactions
- [ ] Error handling scenarios

## 5. Documentation Updates

### Update if Changed:
- [ ] API documentation (docstrings, OpenAPI)
- [ ] Component documentation (props, usage)
- [ ] README files if functionality changed
- [ ] CLAUDE.md if project structure changed
- [ ] Migration guides if breaking changes

### AI Documentation System:
- [ ] Update `/ai_docs/` for existing features
- [ ] Update `/specs/` for new features
- [ ] Mark completed tasks in spec files

## 6. Security Checks

- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all user inputs
- [ ] API endpoints have proper authentication
- [ ] No sensitive data in logs
- [ ] CORS settings appropriate

## 7. Performance Checks

- [ ] No N+1 database queries
- [ ] Proper pagination for large datasets
- [ ] Efficient React re-renders (memo where needed)
- [ ] Browser automation has timeouts
- [ ] Memory usage is reasonable

## 8. Cross-platform Compatibility

- [ ] Path operations use pathlib (Python) or path.join (JS)
- [ ] Line endings handled correctly
- [ ] Browser automation flags for different platforms
- [ ] Console encoding handled (Windows)

## 9. Git Commit

### Before Committing:
```bash
# Check what's changed
git status
git diff

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat(component): add new feature

- Detailed description of changes
- Any breaking changes noted
- Related issue numbers"
```

### Commit Message Format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

## 10. Final Verification

- [ ] All tests passing
- [ ] Linting/formatting clean
- [ ] Documentation updated
- [ ] No console.log or debug statements
- [ ] Error handling in place
- [ ] Changes work on all target platforms

## Common Issues to Check

- **Vite Cache Issues:** Run `npm run fix-vite-cache` if HMR breaks
- **Port Conflicts:** Run `npm run cleanup-ports` if ports are stuck
- **Database Migrations:** Run `alembic upgrade head` after schema changes
- **Type Errors:** Ensure all TypeScript types are properly defined
- **API Changes:** Update both backend routes and frontend API client

## Remember

- Always provide full absolute paths in commands
- Test with both development and production builds
- Consider multi-user scenarios in testing
- Verify changes work with existing data
- Check for any deprecation warnings
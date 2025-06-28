# Commit Command

**What it does:** Creates a properly formatted git commit with automatic checks and descriptive messages.

**When to use it:**
- After completing a feature
- When fixing a bug
- After making documentation changes
- To save work progress

**How to use it:**
- `/commit feat` - For new features
- `/commit fix` - For bug fixes  
- `/commit docs` - For documentation

**Example scenario:** You just fixed the authentication timeout issue. Type `/commit fix` and Claude will run tests, format the code, create a descriptive commit message like "fix: resolve JWT token expiry in auth flow", and commit your changes.

**Commit Types:**
- `feat` - New feature added
- `fix` - Bug fix
- `refactor` - Code improvement without changing functionality
- `docs` - Documentation only
- `test` - Adding or fixing tests
- `chore` - Maintenance tasks
- `style` - Code formatting
- `perf` - Performance improvements

---

## Arguments

- `type` (required): The type of commit

## Content

I'll create a {{type}} commit for you.

<task>
1. Run pre-commit checks (linting with ESLint/Black)
2. Format code if needed
3. Run relevant tests for {{type}} changes
4. Analyze changes to generate commit message
5. Create descriptive commit following conventions
6. Show commit summary
7. Optionally push to remote
</task>
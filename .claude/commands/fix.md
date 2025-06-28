# Fix Command

**What it does:** Automatically fixes common problems that occur in the system.

**When to use it:**
- When you encounter a known issue
- After error messages appear
- When things aren't working as expected

**How to use it:**
- `/fix auth-timeout` - Fixes login timeout issues
- `/fix scrape-failure` - Fixes scraping problems
- `/fix vite-cache` - Fixes frontend not loading
- `/fix browser-leak` - Cleans up stuck browser processes

**Example scenario:** The frontend won't load and shows a 504 error. Type `/fix vite-cache` and Claude will clear the cache and restart the development server automatically.

**Available Fixes:**
- `auth-timeout` - JWT token expiry issues
- `scrape-failure` - Scraping selector problems
- `vite-cache` - Frontend build cache issues
- `browser-leak` - Chromium processes not closing
- `test-files` - Scattered test file organization
- `imports` - Broken import paths

---

## Arguments

- `issue` (required): The known issue to fix

## Content

I'll fix the {{issue}} issue for you.

<task>
1. Diagnose the {{issue}} problem
2. Apply the known fix pattern
3. Test the resolution
4. Document what was fixed
5. Update troubleshooting guide
6. Verify the issue is resolved
</task>
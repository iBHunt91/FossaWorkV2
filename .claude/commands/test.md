# Test Command

**What it does:** Runs automated tests to make sure everything in the system is working correctly.

**When to use it:**
- After making changes to the code
- When something seems broken
- Before deploying updates
- As part of regular maintenance

**How to use it:**
- `/test` - Runs ALL tests (takes a few minutes)
- `/test auth` - Only tests login/authentication
- `/test scraping` - Only tests web scraping
- `/test dashboard` - Opens the visual Testing Dashboard in your browser

**Example scenario:** Users are reporting login issues. Type `/test auth` to quickly check if the authentication system is working properly. Claude will run the tests and tell you exactly what's wrong.

**Test Categories:**
- `auth` - Login and authentication
- `db` - Database connections
- `scraping` - Web scraping functionality
- `automation` - Form filling automation
- `api` - Backend API endpoints
- `filters` - Filter calculations
- `dashboard` - Opens visual test interface

---

## Arguments

- `category` (optional): Test category to run (default: "all")

## Content

I'll run the {{category}} tests for you.

<task>
1. Start required services (backend/frontend if needed)
2. Execute the {{category}} test suite
3. Show real-time test progress
4. Generate a formatted test report
5. Highlight any failures with details
6. Suggest specific fixes for identified issues
7. Offer to automatically fix simple problems
</task>
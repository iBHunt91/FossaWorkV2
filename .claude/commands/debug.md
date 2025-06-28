# Debug Command

**What it does:** Starts a detailed debugging session to help find and fix problems in specific parts of the system.

**When to use it:**
- When something isn't working right
- To understand why errors are happening
- When you need to see exactly what the code is doing

**How to use it:**
- `/debug scraper` - Debug web scraping issues
- `/debug auth` - Debug login problems
- `/debug batch` - Debug batch processing

**Example scenario:** Work orders aren't being scraped correctly. Type `/debug scraper` and Claude will run the scraper with detailed logging, show you exactly what it sees on each page, and help identify why it's failing.

**Available Components:**
- `scraper` - Web scraping issues
- `auth` - Login and authentication
- `batch` - Batch form processing
- `filters` - Filter calculations
- `notifications` - Email/Pushover issues
- `api` - Backend API problems
- `frontend` - React component issues

---

## Arguments

- `component` (required): Component to debug

## Content

I'll start an interactive debugging session for {{component}}.

<task>
1. Enable verbose logging for {{component}}
2. Set up appropriate breakpoints if in code
3. Launch with visible browser if web-based
4. Show detailed step-by-step execution
5. Monitor data flow and transformations
6. Capture and analyze any errors
7. Generate debug report with findings and fixes
</task>
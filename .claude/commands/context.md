# Context Command

**What it does:** Quickly loads all the important information about a specific part of the system so Claude understands what you're working on.

**When to use it:**
- Before starting work on a feature
- When debugging a specific area
- To refresh Claude's memory about how something works

**How to use it:**
- `/context scraping` - Loads scraping patterns and selectors
- `/context auth` - Loads authentication flow details
- `/context filters` - Loads filter calculation logic

**Example scenario:** You need to modify how work orders are scraped. Type `/context scraping` and Claude will load all the selectors, field mappings, and common issues so it can help you effectively.

**Available Areas:**
- `scraping` - Web scraping selectors and patterns
- `automation` - Form filling logic and job codes
- `auth` - Login and JWT token handling
- `filters` - Filter calculation rules
- `notifications` - Email/Pushover setup
- `api` - Backend endpoints
- `frontend` - React components
- `backend` - FastAPI routes

---

## Arguments

- `area` (required): Project area to load context for

## Content

Loading {{area}} context from the FossaWork V2 project...

<task>
1. Read relevant documentation from /ai_docs/
2. Load recent code changes in the {{area}} area
3. Identify common issues and patterns
4. Load current configuration and settings
5. Provide a quick reference guide
6. Show recent bugs or improvements in this area
</task>
# Scrape Command

**What it does:** Automatically logs into WorkFossa and downloads the latest work orders and/or dispenser information.

**When to use it:** 
- Every morning to get fresh work orders
- After adding new customers
- When you need updated dispenser counts

**How to use it:**
- `/scrape` - Downloads everything (work orders + dispensers)
- `/scrape work-orders` - Only downloads work orders
- `/scrape dispensers` - Only downloads dispenser info

**Example scenario:** It's Monday morning and you need to see what new work orders came in over the weekend. Just type `/scrape work-orders` and Claude will handle the login, navigation, and data extraction automatically.

---

## Arguments

- `type` (optional): What to scrape - "work-orders", "dispensers", or "all" (default: "all")

## Content

I'll help you scrape {{type}} data from WorkFossa.

First, let me check the authentication status and then launch the appropriate scraper.

<task>
1. Verify WorkFossa credentials are configured
2. Launch the {{type}} scraper with Playwright
3. Monitor scraping progress and handle any errors
4. Save data to the database
5. Generate a summary report showing what was found
6. Trigger notifications if new work orders are detected
</task>
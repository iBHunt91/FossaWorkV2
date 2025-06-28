# Batch Command

**What it does:** Automatically fills out AccuMeasure forms for multiple work orders at once, saving hours of manual data entry.

**When to use it:**
- After downloading new work orders with `/scrape`
- When you have a backlog of forms to complete
- To process specific types of work (like only "All Dispensers" jobs)

**How to use it:**
- `/batch` - Processes ALL pending work orders
- `/batch 2861` - Only processes "All Dispensers" jobs
- `/batch 2862,3146` - Processes multiple specific job types

**Example scenario:** You have 50 AccuMeasure forms to fill out. Instead of doing them one by one, type `/batch 2861` and Claude will automatically fill them all out while you take a coffee break. You can pause/resume anytime.

**Job Codes:**
- 2861: AccuMeasure All Dispensers
- 2862: AccuMeasure Specific Dispensers
- 3002: AccuMeasure All Dispensers (alternate)
- 3146: Open Neck Prover

---

## Arguments

- `codes` (optional): Job codes to process, comma-separated or "all" (default: "all")

## Content

I'll process work orders with job codes: {{codes}}

<task>
1. Load pending work orders from the database
2. Filter by job codes: {{codes}}
3. Initialize the batch processor with progress tracking
4. Start automated form filling with Playwright
5. Monitor progress with pause/resume capability
6. Handle any errors gracefully
7. Generate a completion report showing successes/failures
</task>
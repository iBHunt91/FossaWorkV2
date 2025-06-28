# Cleanup Command

**What it does:** Cleans up temporary files, old logs, and stuck processes to keep the system running smoothly.

**When to use it:**
- When the system feels sluggish
- After error messages about disk space
- Weekly maintenance
- After heavy batch processing

**How to use it:**
- `/cleanup` - Runs full cleanup

**Example scenario:** You've been running batch processes all week and notice things are slowing down. Type `/cleanup` and Claude will remove old logs, clear caches, clean up stuck browser processes, and optimize the database.

**What gets cleaned:**
- 🗑️ Logs older than 30 days
- 🌐 Orphaned browser processes
- 📸 Old test screenshots
- 💾 Database optimization (VACUUM)
- 🗄️ Cache files
- 📁 Temporary directories

---

## Content

I'll perform system cleanup and maintenance.

<task>
1. Clear logs older than 30 days from /logs/
2. Find and remove orphaned Chromium processes
3. Clean test artifacts and old screenshots
4. Optimize SQLite database with VACUUM
5. Clear Vite cache files
6. Remove temporary files
7. Report total space freed
</task>
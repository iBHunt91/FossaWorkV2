# Shutdown Command

**What it does:** Safely shuts down the system and saves your work at the end of the day.

**When to use it:**
- End of your workday
- Before system maintenance
- When leaving for extended time

**How to use it:**
- `/shutdown` - Runs complete shutdown routine

**Example scenario:** It's 5 PM and time to go home. Type `/shutdown` and Claude will commit any unsaved changes, push to GitHub, create a work summary, backup important data, and cleanly stop all services.

**What happens:**
1. 💾 Checks for uncommitted changes
2. 📝 Creates WIP commit if needed
3. 📤 Pushes all changes to GitHub
4. 📊 Generates daily work summary
5. 🔐 Backs up critical data
6. 🛑 Stops all services gracefully
7. 🧹 Cleans temporary files

---

## Content

I'll run the shutdown routine to wrap up your work.

<task>
1. Check for uncommitted changes with git status
2. Create WIP commit if there are changes
3. Push all commits to remote repository
4. Generate daily work summary from git log
5. Create quick backup of database
6. Stop frontend server (port 5173)
7. Stop backend server (port 8000)
8. Clean temporary files and caches
9. Show summary of what was accomplished today
</task>
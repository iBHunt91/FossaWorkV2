# Startup Command

**What it does:** Runs your complete morning routine to get the system ready for the day's work.

**When to use it:**
- First thing when you start work
- After your computer restarts
- When returning from vacation

**How to use it:**
- `/startup` - Runs the complete startup sequence

**Example scenario:** It's 8 AM and you just sat down at your desk. Type `/startup` and Claude will pull the latest code, start all services, check for new work orders, and show you what needs to be done today - all automatically.

**What happens:**
1. 🔄 Pulls latest code updates
2. ✅ Verifies your development environment
3. 🚀 Starts backend and frontend servers
4. 🏥 Runs health checks
5. 📋 Shows your pending tasks
6. 🔔 Displays recent notifications

---

## Content

Good morning! Let me run the startup routine for you.

<task>
1. Check git status and pull latest changes
2. Verify environment setup (Python venv, npm packages)
3. Start backend server (FastAPI on port 8000)
4. Start frontend server (Vite on port 5173)
5. Run quick health check on all services
6. Display pending tasks from TodoRead
7. Show recent notifications and alerts
8. Open the dashboard in your browser
</task>
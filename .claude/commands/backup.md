# Backup Command

**What it does:** Creates a safe copy of your important data so you don't lose anything.

**When to use it:**
- Before making major changes
- End of each week
- Before system updates
- After importing lots of new data

**How to use it:**
- `/backup` - Backs up everything
- `/backup db` - Only backs up the database
- `/backup config` - Only backs up settings

**Example scenario:** You're about to update the system to a new version. Type `/backup full` to create a complete backup first. If something goes wrong, you can restore from this backup.

**Backup Types:**
- `full` - Everything (database, configs, user data)
- `db` - Just the SQLite database
- `config` - Settings and credentials
- `users` - User-specific data
- `logs` - System logs

**Where backups go:** `backend/backups/YYYY-MM-DD_HHMMSS/`

---

## Arguments

- `type` (optional): What to backup (default: "full")

## Content

I'll create a {{type}} backup of the system.

<task>
1. Create backup directory with timestamp
2. Stop write operations if needed
3. Copy {{type}} data to backup location
4. Verify backup integrity
5. Compress backup if large
6. Log backup completion with size
7. Clean up old backups (keep last 7)
</task>
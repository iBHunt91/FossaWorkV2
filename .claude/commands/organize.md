# Organize Command

**What it does:** Automatically organizes all project files into their proper folders according to the project standards.

**When to use it:**
- When you see test files scattered in the wrong places
- After cloning the repository
- When imports start breaking
- For general housekeeping

**How to use it:**
- `/organize` - Organizes all files

**Example scenario:** You notice there are 50+ test files in the backend folder that should be in /tests/. Type `/organize` and Claude will move all files to their correct locations and fix any broken imports.

**What gets organized:**
- 🧪 Test files → `/tests/` subdirectories
- 📜 Scripts → `/scripts/` subdirectories  
- 📚 Documentation → `/docs/` subdirectories
- 🛠️ Tools → `/tools/` subdirectories
- 🗑️ Removes backup files (.bak, .backup)

**Rules followed:**
- Test files go in `/tests/backend/`, `/tests/frontend/`, etc.
- Scripts go in `/scripts/testing/`, `/scripts/setup/`, etc.
- Docs go in `/docs/guides/`, `/docs/reports/`, etc.
- Updates all imports after moving files

---

## Content

I'll organize the project files according to the comprehensive file organization rules.

<task>
1. Scan for misplaced test files in root/backend/frontend
2. Move test files to appropriate /tests/ subdirectories
3. Organize scripts into /scripts/ subdirectories
4. Clean up documentation in /docs/ subdirectories
5. Update any broken imports after moving files
6. Remove backup files (.bak, .backup, .old)
7. Document all changes made in a summary
</task>
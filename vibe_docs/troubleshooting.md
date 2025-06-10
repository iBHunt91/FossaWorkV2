# Troubleshooting Guide

## Error Log Format
For each error, document:

### [Error Title/Type]
**Date:** [YYYY-MM-DD]
**Error Message:**
```
[Exact error message]
```

**Context:** [What were you trying to do?]
**Root Cause:** [Why did this happen?]
**Solution:**
1. [Step-by-step solution]
2. [Include exact commands used]

**Prevention:** [How to avoid this in the future]
**Related Files:** [Which files were modified to fix this]

---

### LightningCSS Windows Native Module Error
**Date:** 2025-01-08
**Error Message:**
```
[Failed to load PostCSS config: Failed to load PostCSS config (searchPath: C:/Users/Bruce/Desktop/FossaWork/frontend): [Error] Loading PostCSS Plugin failed: Cannot find module '../lightningcss.win32-x64-msvc.node'
```

**Context:** Frontend failing to start on Windows with TailwindCSS v4.1.8
**Root Cause:** TailwindCSS v4 uses new PostCSS plugin architecture that depends on LightningCSS native binaries. The Windows x64 MSVC binary was missing or corrupted during installation.
**Solution:**
1. Downgrade to TailwindCSS v3.4.16 (stable version)
2. Remove problematic dependencies:
   ```bash
   npm uninstall @tailwindcss/postcss lightningcss
   ```
3. Update package.json to use TailwindCSS v3:
   ```json
   "tailwindcss": "^3.4.16"
   ```
4. Update postcss.config.js:
   ```javascript
   export default {
     plugins: {
       tailwindcss: {},
       autoprefixer: {},
     },
   }
   ```
5. Ensure tailwind.config.js is compatible with v3
6. Install dependencies: `npm install`

**Prevention:** Use TailwindCSS v3 for Windows environments until v4 native module support is more stable
**Related Files:** 
- frontend/package.json
- frontend/postcss.config.js
- frontend/tailwind.config.js

---

### Windows Console Unicode Encoding Errors
**Date:** 2025-01-08
**Error Message:**
```
UnicodeEncodeError: 'charmap' codec can't encode character '🚀' in position X: character maps to <undefined>
```

**Context:** Backend failing to start on Windows due to emoji characters in logging statements
**Root Cause:** Windows console (cp1252 encoding) cannot display Unicode emoji characters used throughout Python logging
**Solution:**
1. Run emoji replacement script:
   ```bash
   cd backend
   python3 fix_emojis.py
   ```
2. Script replaces all emojis with Windows-compatible text:
   - 🚀 → [START]
   - ✅ → [OK]
   - ❌ → [ERROR]
   - 🔄 → [SYNC]
   - ⚠️ → [WARNING]
   - And many more...

**Prevention:** Avoid emoji characters in logging statements when supporting Windows environments
**Related Files:** 
- All Python files in backend/app/
- backend/fix_emojis.py (solution script)

---

### Import Path Errors in FastAPI Routes
**Date:** 2025-01-08
**Error Message:**
```
ModuleNotFoundError: No module named 'services.workfossa_automation'
ImportError: No module named 'database'
```

**Context:** FastAPI routes failing to import relative modules
**Root Cause:** Incorrect import paths using absolute imports instead of relative imports
**Solution:**
1. Change absolute imports to relative imports:
   ```python
   # Wrong:
   from services.workfossa_automation import workfossa_automation
   from database import get_db
   
   # Correct:
   from ..services.workfossa_automation import workfossa_automation
   from ..database import get_db
   ```
2. Update model field references:
   ```python
   # Wrong:
   credentials.username
   
   # Correct:
   simple_decrypt(credentials.encrypted_username)
   ```

**Prevention:** Always use relative imports in FastAPI route modules
**Related Files:**
- backend/app/routes/credentials.py
- backend/app/models.py

---

### TailwindCSS v4 PostCSS Import Errors  
**Date:** 2025-01-08
**Error Message:**
```
[postcss] postcss-import: Unknown word
/* Tailwind CSS v4 import */
@import "tailwindcss";
```

**Context:** Frontend failing after fixing LightningCSS issue, CSS file still using v4 syntax
**Root Cause:** Even after downgrading TailwindCSS packages to v3, the CSS files still contained v4-specific syntax (@import "tailwindcss", @theme, @custom-variant)
**Solution:**
1. Replace v4 CSS imports with v3 imports in src/index.css:
   ```css
   /* OLD v4 syntax: */
   @import "tailwindcss";
   @theme { ... }
   @custom-variant dark (&:is(.dark *));
   
   /* NEW v3 syntax: */
   @import 'tailwindcss/base';
   @import 'tailwindcss/components'; 
   @import 'tailwindcss/utilities';
   ```
2. Remove @theme and @custom-variant blocks (v4 only)
3. Clean install dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

**Prevention:** When downgrading TailwindCSS versions, also update all CSS files to match the syntax
**Related Files:**
- frontend/src/index.css
- frontend/package.json
- frontend/postcss.config.js

---

### Context7-MCP Server Failed - ENOENT Error
**Date:** 2025-06-08
**Error Message:**
```
Connection failed: Error: spawn npx -y @smithery/cli@latest run @context7/mcp-server --key 42b1a0d8-bc6b-4340-b082-e92bdc0cd62b ENOENT
```

**Context:** Claude Code MCP server management showing context7-mcp as failed
**Root Cause:** The MCP server spawning process cannot find the `npx` command in its execution environment, even though npx is available in the main shell PATH. This commonly occurs in WSL environments where the spawned process doesn't inherit the correct PATH.
**Solution:**
1. Verify npx is available: `which npx` and `npx --version`
2. Test the command manually:
   ```bash
   npx -y @smithery/cli@latest run @context7/mcp-server --help
   ```
3. If manual command works but MCP server still fails, the issue is PATH inheritance
4. Try restarting Claude Code CLI to refresh environment:
   ```bash
   # Exit current session and restart
   claude
   ```
5. Alternative: Check if using absolute path works:
   ```bash
   /usr/bin/npx -y @smithery/cli@latest run @context7/mcp-server --help
   ```

**Prevention:** Ensure Node.js and npm are properly installed system-wide, not just user-specific. Consider using system package manager instead of version managers in server environments.
**Related Files:**
- ~/.cache/claude-cli-nodejs/-mnt-c-Users-Bruce-Desktop-FossaWork/mcp-logs-context7-mcp/*.txt
- .claude/settings.local.json

---
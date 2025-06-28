# Browser Visibility for Dispenser Scraping

## Overview
The dispenser scraping has been configured to run with a visible browser window so you can see what's happening during the scraping process.

## How to Use

### Method 1: Environment Variable (Recommended)
Set the `BROWSER_VISIBLE` environment variable before running the backend:

```bash
# On macOS/Linux:
export BROWSER_VISIBLE=true
cd backend
uvicorn app.main:app --reload --port 8000

# On Windows:
set BROWSER_VISIBLE=true
cd backend
uvicorn app.main:app --reload --port 8000
```

### Method 2: Already Configured (Current)
The code has been updated to use visible browser by default in these locations:
- Work order scraping endpoint
- Batch dispenser scraping endpoint
- Global automation service instance

### Method 3: Test Scripts
Run the test script to verify visible browser is working:
```bash
cd backend
python scripts/test_visible_browser.py
```

## What You'll See

When dispenser scraping runs with visible browser:

1. **Browser Launch**: A Chrome/Chromium window will open
2. **Login Process**: You'll see the WorkFossa login page and credentials being entered
3. **Navigation**: The browser will navigate to work orders and customer locations
4. **Equipment Tab**: You'll see it click on the Equipment tab
5. **Dispenser Section**: Watch it expand the dispenser section
6. **Data Extraction**: The script will extract dispenser information from the visible elements

## Debugging Tips

1. **Slow Motion**: The browser runs at normal speed. If it's too fast, you can add delays in the code.

2. **Screenshots**: If something fails, check the `backend/screenshots` directory for captured images.

3. **Console Logs**: Keep an eye on the terminal output for detailed logging of what's happening.

4. **Pause Points**: You can add breakpoints or `input()` calls in the Python code to pause execution.

## Reverting to Headless Mode

To run in headless mode again (no visible browser):

1. **Remove environment variable**:
   ```bash
   unset BROWSER_VISIBLE  # macOS/Linux
   set BROWSER_VISIBLE=   # Windows
   ```

2. **Or modify the code** to change `headless=False` back to `headless=True` in:
   - `/backend/app/routes/work_orders.py` (lines 553 and 1164)
   - `/backend/app/services/workfossa_automation.py` (line 1259)

## Troubleshooting

- **Browser doesn't appear**: Make sure you're running on a system with a display (not SSH without X11 forwarding)
- **Browser closes immediately**: Check for login failures or navigation errors in the console
- **Can't see what's happening**: The browser might be minimized or on another desktop/monitor
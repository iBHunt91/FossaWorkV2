# 🚀 Hourly Scraping Quick Start Guide

## What's New?
Automated hourly work order scraping is now implemented! Your work orders will stay synchronized automatically in the background.

## How to Start Using It

### 1. Start the Backend Server
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 2. Start the Frontend
```bash
cd frontend
npm run dev
```

### 3. Login to FossaWork
Navigate to http://localhost:5173 and login with your WorkFossa credentials.

### 4. Check the Scraping Status
Look at the sidebar - you'll see a new **"Work Order Sync"** section showing:
- Current status (Active/Paused/Running)
- Next scrape time
- Last scrape results

### 5. Configure Settings (Optional)
Go to **Settings > Scraping** to:
- Enable/disable hourly scraping
- Change the interval (default: 1 hour)
- Set active hours (e.g., only scrape 8 AM - 6 PM)
- View scraping history
- Trigger manual scrapes

## Visual Indicators

The sidebar status shows different states:
- 🟢 **Green** - Active and healthy
- 🔵 **Blue (pulsing)** - Currently scraping
- 🔴 **Red** - Last scrape failed
- ⚪ **Gray** - Paused/disabled

## That's It!
Your work orders will now automatically sync every hour. No more manual scraping needed!

## Need Help?
- Check the full documentation: `/docs/implementation-complete/HOURLY_SCRAPING_IMPLEMENTATION.md`
- Run the test script: `python3 backend/scripts/test_scraping_endpoints_simple.py`
- Check backend logs for any errors
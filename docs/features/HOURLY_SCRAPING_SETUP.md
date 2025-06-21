# Hourly Work Order Scraping - Quick Setup Guide

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Start the Backend**
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

3. **Start the Frontend**
   ```bash
   npm run dev
   ```

4. **Configure Schedule**
   - Navigate to Settings → Scraping tab
   - Click "Create Schedule"
   - Set interval (default: 1 hour)
   - Configure active hours (optional)

## 📋 Features Added

### Backend
- ✅ APScheduler integration for background tasks
- ✅ Database models for schedules and history
- ✅ Scheduler service with job management
- ✅ API endpoints for schedule CRUD operations
- ✅ Automatic scraping execution
- ✅ Error handling and retry logic

### Frontend
- ✅ Schedule configuration UI
- ✅ Real-time status display
- ✅ Scraping history table
- ✅ Manual trigger button
- ✅ Pause/resume controls

## 🧪 Testing

Run the test script to verify functionality:
```bash
cd backend
python scripts/test_hourly_scraping.py
```

This will:
- Create a test schedule (runs every 1.2 minutes)
- Wait for automatic executions
- Display scraping history
- Clean up when done

## 📊 Database Changes

New tables added:
- `scraping_schedules` - Stores schedule configurations
- `scraping_history` - Tracks all scraping runs
- `scraping_statistics` - Aggregated performance data

## 🔧 Configuration Options

- **Interval**: 0.25 to 24 hours
- **Active Hours**: Restrict to specific times (e.g., 6 AM - 10 PM)
- **Enable/Disable**: Pause without deleting schedule
- **Manual Trigger**: Run immediately regardless of schedule

## 📝 API Usage

```python
# Create a schedule
POST /api/scraping-schedules/
{
  "schedule_type": "work_orders",
  "interval_hours": 1.0,
  "active_hours": {"start": 6, "end": 22},
  "enabled": true
}

# Trigger manual scrape
POST /api/scraping-schedules/trigger
{
  "schedule_type": "work_orders",
  "ignore_schedule": true
}

# Get scraping history
GET /api/scraping-schedules/history/work_orders?limit=50
```

## 🚨 Important Notes

1. **First Run**: The scheduler will restore schedules from the database on startup
2. **Persistence**: Schedules survive application restarts
3. **Multi-User**: Each user has independent schedules
4. **Resource Usage**: Scraping uses Playwright browser automation

## 🐛 Troubleshooting

If schedules don't run:
1. Check backend logs for scheduler initialization
2. Verify database tables were created
3. Ensure APScheduler is installed (`pip install apscheduler`)
4. Check that WorkFossa credentials are valid

## 📈 Next Steps

- Monitor scraping history for patterns
- Adjust intervals based on usage
- Set up notifications for new work orders
- Configure email alerts for failures
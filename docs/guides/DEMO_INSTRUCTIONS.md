# FossaWork V2 Demo Instructions

## Quick Start (Windows)

1. **Double-click `start-demo.bat`** - This will automatically:
   - Install Python dependencies (FastAPI, uvicorn, etc.)
   - Start the backend server on http://localhost:8000
   - Install Node.js dependencies 
   - Start the React frontend on http://localhost:3000
   - Open your browser to the app

2. **Manual Start (if batch file doesn't work):**

   **Backend:**
   ```cmd
   cd backend
   python -m pip install fastapi uvicorn sqlalchemy pydantic
   python app/main_simple.py
   ```

   **Frontend:**
   ```cmd
   cd frontend
   npm install
   npm run dev
   ```

## What You'll See

### Backend API (http://localhost:8000)
- **Root endpoint**: Shows API info and available endpoints
- **Health check**: `/health` - Service status
- **Work Orders**: `/api/v1/work-orders` - Mock work order data
- **API Documentation**: `/docs` - Interactive Swagger UI

### Frontend App (http://localhost:3000)
- **Dashboard**: Overview of work orders and automation status
- **Work Order List**: Shows pending and completed jobs
- **Dispenser Details**: Fuel grade configurations and progress
- **Real-time Updates**: WebSocket connections (when full backend is running)

## Demo Features

✅ **Modern UI**: React 18 + TypeScript + Tailwind CSS  
✅ **Clean API**: FastAPI with automatic documentation  
✅ **Mock Data**: Realistic work orders with dispenser details  
✅ **Multi-user Ready**: User isolation and preferences  
✅ **Browser Automation**: Playwright integration (with fallback)  
✅ **Real-time Updates**: WebSocket support for live progress  

## Sample Data

The demo includes:
- 2 work orders (Shell and BP stations)
- 3 dispensers with different fuel configurations
- Progress tracking and automation status
- User authentication endpoints

## Next Steps

After reviewing the demo:
1. Install Playwright for real browser automation: `pip install playwright`
2. Install browser drivers: `playwright install`
3. Begin V1 data migration
4. Configure real WorkFossa credentials
5. Test with live data

## Troubleshooting

**Python not found**: Make sure Python is in your Windows PATH  
**Node.js not found**: Install from https://nodejs.org  
**Port conflicts**: Change ports in the config files if 8000/3000 are taken  
**Permission errors**: Run Command Prompt as Administrator if needed  
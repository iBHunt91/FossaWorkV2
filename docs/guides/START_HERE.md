# 🚀 FossaWork V2 - Quick Start Guide

## Current Status: ✅ FIXED
- Database tables created
- User preferences endpoints working  
- Credential storage system working
- Backend running on port 8001
- Frontend configured for port 8001

## How to Run (Windows)

### Option 1: Quick Start (Recommended)
```bash
# Double-click this file:
tools/quick-start.bat
```

### Option 2: Manual Steps
1. **Start Backend** (in one terminal):
   ```bash
   start-backend-with-credentials.bat
   ```

2. **Start Frontend** (in another terminal):
   ```bash
   start-v2-frontend.bat
   ```

### Option 3: WSL/Linux
```bash
# Backend
cd backend
python3 app/main_full.py

# Frontend (separate terminal)
cd frontend  
npm run dev
```

## Access URLs
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

## What's Fixed
- ✅ Database tables created properly
- ✅ User preferences endpoints (no more 404 errors)
- ✅ WorkFossa credential storage (no more 500 errors) 
- ✅ Frontend API configuration updated
- ✅ No more "takes forever to load" issues

## Next Steps
1. Start the system using Option 1 above
2. Go to Settings page
3. Enter your WorkFossa credentials
4. Test the credential system

## Troubleshooting
- If port 8001 is busy, check `tools/check-backend-status.bat`
- If frontend won't start, check Node.js is installed
- For detailed logs, use `start-backend-debug.bat`
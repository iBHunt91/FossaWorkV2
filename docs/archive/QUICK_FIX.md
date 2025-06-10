# 🚀 Quick Fix for Port 8001 Issue

## Problem: Port 8001 is already in use

The server is working perfectly, but port 8001 is occupied by another process.

## Solutions:

### Option 1: Use the Clean Starter (Recommended)
```bash
start-backend-clean.bat
```
This will:
- Kill any processes using port 8001
- Clean up conflicting Python processes  
- Start the server fresh
- If port 8001 still fails, automatically try port 8002

### Option 2: Manual Port Kill
1. Open Command Prompt as Administrator
2. Run: `netstat -ano | findstr :8001`
3. Note the Process ID (PID) in the last column
4. Run: `taskkill /F /PID [PID_NUMBER]`
5. Run: `start-backend-with-credentials.bat`

### Option 3: Use Different Port
The server is configured for port 8001, but we can change it:
1. Edit `backend/app/main_full.py`
2. Change line: `uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)`
3. To: `uvicorn.run(app, host="0.0.0.0", port=8002, reload=False)`
4. Update frontend `src/services/api.ts` to use port 8002

### Option 4: Check What's Using Port 8001
```bash
netstat -ano | findstr :8001
```

## After Starting Backend Successfully:
1. Note which port it's running on (8001 or 8002)
2. Update frontend if needed:
   - If using port 8002, edit `frontend/src/services/api.ts`
   - Change `http://localhost:8001` to `http://localhost:8002`
3. Start frontend: `start-v2-frontend.bat`

The credential system fixes are all in place - we just need to get the server running on an available port!
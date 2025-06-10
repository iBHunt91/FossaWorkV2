# 🚀 Backend Setup Guide - FossaWork V2

## Quick Setup

The logging system is designed to work with or without the backend. The frontend will operate in standalone mode if the backend isn't available.

### Option 1: With Docker (Recommended)

```bash
# Create a simple Docker setup
cd backend

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
EOF

# Build and run
docker build -t fossawork-backend .
docker run -p 8000:8000 fossawork-backend
```

### Option 2: With Python Virtual Environment

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Option 3: Manual Dependency Installation

```bash
# Install core dependencies individually
pip install fastapi uvicorn sqlalchemy websockets python-multipart

# Optional dependencies
pip install playwright aiofiles psutil

# Start server
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Testing the Setup

1. **Backend Health Check**:
   ```bash
   curl http://localhost:8000/health
   ```

2. **API Documentation**:
   Visit: http://localhost:8000/docs

3. **WebSocket Logs**:
   Visit frontend at: http://localhost:5173/logs

## Frontend-Only Mode

**The logging system works perfectly without the backend!**

- ✅ All frontend logging features work
- ✅ Console capture and error handling
- ✅ User action tracking
- ✅ API call logging
- ✅ Component lifecycle logging
- ✅ Export functionality
- ✅ Real-time filtering and search

The frontend will automatically:
- Show "Operating in frontend-only mode"
- Stop attempting to connect after a few tries
- Continue capturing all frontend events
- Provide full logging dashboard functionality

## When Backend is Available

When the backend starts:
- ✅ WebSocket automatically connects
- ✅ Backend logs stream in real-time
- ✅ Full system visibility (frontend + backend)
- ✅ Enhanced debugging capabilities

## Troubleshooting

### Backend Won't Start
- Check Python version: `python3 --version` (3.8+ required)
- Install pip: `python3 -m ensurepip --upgrade`
- Try Docker approach instead

### WebSocket Connection Issues
- Verify backend is on port 8000: `curl http://localhost:8000/health`
- Check firewall settings
- Frontend will automatically retry connection

### No Logs Showing
- Frontend logs work without backend
- Visit `/logs` page in frontend
- Try the demo buttons to generate test logs

## System Architecture

```
Frontend (Port 5173)
├── Real-time logging service ✅
├── Console capture ✅
├── Error handling ✅
└── WebSocket client (connects to backend when available)

Backend (Port 8000) - Optional
├── FastAPI server
├── WebSocket streaming
├── Multi-file logging
└── API request logging
```

The logging system is designed to be resilient and provide value even when components are unavailable!
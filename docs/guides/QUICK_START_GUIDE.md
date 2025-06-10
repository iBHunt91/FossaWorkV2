# 🚀 FossaWork V2 - Quick Start Guide

## Prerequisites

- Python 3.8 or higher installed
- Git (for cloning the repository)
- Windows, macOS, or Linux

## 🎯 Quick Start (Windows)

### Option 1: Using Batch Files (Easiest)

1. **First Time Setup:**
   ```cmd
   cd tools
   start-backend-dev.bat
   ```
   This will:
   - Create virtual environment
   - Install all dependencies
   - Start the server

2. **Subsequent Runs:**
   ```cmd
   cd tools
   start-backend-quick.bat
   ```

### Option 2: Using PowerShell

1. **Open PowerShell and run:**
   ```powershell
   cd tools
   .\Start-Backend.ps1
   ```

   If you get an execution policy error:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Option 3: Manual Setup

1. **Open Command Prompt/Terminal:**
   ```cmd
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   python run_server.py
   ```

## 🧪 Test the Authentication System

### 1. Reset to Zero Users (Optional)
```cmd
tools\reset-database.bat
```

### 2. Check Server Status
Open browser to: http://localhost:8000

You should see:
```json
{
  "message": "FossaWork V2 API is running",
  "version": "2.0.0"
}
```

### 3. Check Setup Status
Visit: http://localhost:8000/api/setup/status

If no users exist:
```json
{
  "setup_required": true,
  "user_count": 0,
  "message": "Please complete initial setup"
}
```

### 4. Access API Documentation
Visit: http://localhost:8000/docs

This interactive documentation lets you:
- Test all endpoints
- See request/response formats
- Execute API calls directly

## 🔐 First Time Setup

### Using the API Docs (Easiest):

1. Go to http://localhost:8000/docs
2. Find `/api/setup/initialize`
3. Click "Try it out"
4. Enter your WorkFossa credentials
5. Click "Execute"
6. Copy the `access_token` from response

### Using cURL:
```bash
curl -X POST http://localhost:8000/api/setup/initialize \
  -H "Content-Type: application/json" \
  -d '{"username": "your@email.com", "password": "your_password"}'
```

## 📋 Common Issues & Solutions

### Issue: "uvicorn not recognized"
**Solution:** Use the provided batch files or install dependencies:
```cmd
pip install -r requirements.txt
```

### Issue: "Python not found"
**Solution:** Install Python from python.org and add to PATH

### Issue: "Port 8000 already in use"
**Solution:** Kill the process or use a different port:
```cmd
python -m uvicorn app.main:app --port 8001
```

### Issue: "Module not found"
**Solution:** Make sure you're in the backend directory and virtual environment is activated

## 🎯 What's Next?

Once the server is running:

1. **No Users Yet?**
   - Use `/api/setup/initialize` with WorkFossa credentials
   - System creates your profile automatically

2. **Users Exist?**
   - Use `/api/auth/login` with WorkFossa credentials
   - Get JWT token for API access

3. **Test Protected Endpoints:**
   - Include token in Authorization header
   - `Authorization: Bearer YOUR_TOKEN`

## 📁 Project Structure

```
FossaWork/
├── backend/           # Backend API (you are here)
│   ├── app/          # Application code
│   ├── venv/         # Virtual environment (created)
│   └── run_server.py # Direct server runner
├── frontend/         # Frontend application
├── tools/           # Utility scripts
│   ├── start-backend-dev.bat     # Full setup & start
│   ├── start-backend-quick.bat   # Quick start
│   ├── reset-database.bat        # Reset to zero users
│   └── Start-Backend.ps1         # PowerShell version
└── docs/            # Documentation
```

## 🔧 Environment Variables

Create `.env` file in backend directory (optional):
```env
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./fossawork.db
WORKFOSSA_BASE_URL=https://app.workfossa.com
```

## 💡 Tips

- Use `tools\start-backend-dev.bat` for first-time setup
- API docs at `/docs` are your best friend
- All routes except auth/setup require JWT token
- Tokens expire after 24 hours
- WorkFossa credentials are verified on each login

## 🚨 Troubleshooting

If nothing works, try this sequence:
```cmd
cd backend
python --version           # Should show Python 3.8+
python -m pip install -r requirements.txt
python run_server.py
```

Still having issues? The problem is likely:
1. Python not installed or not in PATH
2. Missing dependencies
3. Port 8000 already in use
4. In wrong directory

## 🎉 Success!

When everything is working, you'll see:
- Server running on http://localhost:8000
- API docs at http://localhost:8000/docs
- Setup status at http://localhost:8000/api/setup/status

The system is now ready for use with zero default users and WorkFossa authentication!

## 🧪 Testing the Authentication System

### Quick Test
From the backend directory:
```cmd
python test_zero_users.py
```

### Comprehensive Test
```cmd
python test_auth_flow.py
```

### Manual Testing with WorkFossa Credentials
1. Reset to zero users: `tools\reset-database.bat`
2. Start server: `tools\start-backend-dev.bat`
3. Open API docs: http://localhost:8000/docs
4. Use `/api/setup/initialize` with your real WorkFossa credentials
5. Copy the returned JWT token for API access

## 🔑 Authentication Flow

### Zero Users (First Run)
```
1. GET /api/setup/status → Shows setup_required: true
2. POST /api/setup/initialize → Create first user with WorkFossa
3. Returns JWT token → Use for all API requests
```

### Existing Users
```
1. POST /api/auth/login → Verify with WorkFossa
2. Returns JWT token → Use for all API requests
3. GET /api/auth/check → Verify token is valid
```

### Using the Token
Include in headers for all protected routes:
```
Authorization: Bearer YOUR_JWT_TOKEN
```
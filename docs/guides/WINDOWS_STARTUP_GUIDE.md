# Windows Startup Guide - FossaWork V2

## ✅ All Windows Issues Fixed!

The following Windows-specific issues have been resolved:

1. **Unicode/Emoji Encoding Errors** ✅ FIXED
2. **LightningCSS Native Module Errors** ✅ FIXED  
3. **TailwindCSS v4 PostCSS Import Errors** ✅ FIXED
4. **FastAPI Import Path Errors** ✅ FIXED

## 🚀 Quick Start (Windows)

### Option 1: Use the Main Startup Script
```batch
tools\start-system.bat
```

### Option 2: Manual Startup

**Backend:**
```batch
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app/main.py
```

**Frontend (separate terminal):**
```batch
cd frontend
npm install
npm run dev
```

## 🛠️ If You Still See Errors

### LightningCSS/PostCSS Errors
Run the automatic fix:
```batch
cd frontend
..\tools\fix-lightningcss.bat
```

### Unicode Errors in Backend
Run the emoji fix:
```batch
cd backend
python fix_emojis.py
```

## 📋 System Requirements

- **Windows 10/11**
- **Python 3.8+** (with pip and venv)
- **Node.js 16+** (with npm)
- **Git** (recommended)

## 🔧 Manual Fixes (If Needed)

### Fix 1: TailwindCSS v4 → v3 Downgrade
```batch
cd frontend
npm uninstall @tailwindcss/postcss lightningcss
npm install tailwindcss@^3.4.16
```

### Fix 2: Update CSS Imports
Edit `frontend/src/index.css`:
```css
/* Replace this: */
@import "tailwindcss";

/* With this: */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';
```

### Fix 3: Update PostCSS Config
Edit `frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## 🌐 Access URLs

Once started successfully:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## 📚 Need Help?

Check the troubleshooting guide:
- `vibe_docs/troubleshooting.md` - Complete error solutions
- `tools/` directory - Automated fix scripts
- GitHub Issues - Report problems

## ✨ Features Ready

- ✅ Browser automation for WorkFossa
- ✅ Real-time logging and monitoring
- ✅ Work order management
- ✅ Secure credential storage
- ✅ Progress tracking
- ✅ Modern React UI with TailwindCSS

**The application is now fully Windows-compatible!** 🎉
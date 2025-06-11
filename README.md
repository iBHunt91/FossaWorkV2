# FossaWork V2 - Modern Fuel Dispenser Automation System

A complete rebuild of the FossaWork application with modern architecture, security, and multi-user support.

## 🖥️ Cross-Platform Support

FossaWork V2 runs on Windows, macOS, and Linux. See the [Cross-Platform Guide](docs/guides/CROSS_PLATFORM_GUIDE.md) for platform-specific instructions.

## 🎉 Status: Day 2 Complete - 100% Implementation

### 🆕 Recent Updates (June 11, 2025):
- **WorkFossa Scraper Enhancement**: Fixed custom dropdown detection to properly change page size from 25 to 100 work orders
- **Documentation**: Added detailed fix documentation in `ai_docs/systems/workfossa-dropdown-fix.md`

### ✅ What's Been Built:

**Backend (FastAPI + SQLAlchemy):**
- Complete REST API with multi-user support
- Secure password hashing with BCrypt  
- WorkFossa scraping service with async architecture
- **Fixed**: Custom dropdown handling for WorkFossa page size (25→100 work orders)
- Comprehensive data models for all business entities
- Full CRUD operations for users and work orders
- Background task processing for scraping
- SQLite database with proper relationships

**Frontend (React + TypeScript):**
- Modern React 18 with TypeScript
- React Query for state management and caching
- Responsive dashboard with real-time metrics
- Work orders management with filtering/search
- Settings page with user preferences
- Modern UI with Lucide icons and CSS animations
- Vite build system with optimized configurations

### 📁 Project Structure
```
FossaWork/
├── backend/                    # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── models.py          # Data models
│   │   ├── database.py        # Database setup
│   │   ├── main.py           # FastAPI app
│   │   ├── routes/           # API endpoints
│   │   └── services/         # Business logic
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/           # React pages
│   │   ├── components/      # UI components
│   │   └── services/        # API integration
│   └── package.json         # Node dependencies
├── docs/                      # 📚 Organized Documentation
│   ├── guides/               # User and setup guides
│   ├── implementation-complete/ # Completion status docs
│   ├── reports/              # Audit and analysis reports
│   └── planning/             # Strategy and planning docs
├── tests/                     # 🧪 Organized Test Files
│   ├── backend/              # Backend API tests
│   ├── frontend/             # Frontend component tests
│   ├── integration/          # Cross-system tests
│   └── automation/           # Form automation tests
├── scripts/                   # 🛠️ Organized Scripts
│   ├── setup/                # Installation scripts
│   ├── maintenance/          # Cleanup utilities
│   └── data/                 # Data processing scripts
├── tools/                     # 🔧 Development Tools
│   ├── windows/              # Windows batch files
│   ├── debugging/            # Debug utilities
│   └── unix/                 # Unix shell scripts
├── vibe_docs/                # AI documentation system
├── V1-Archive-2025-01-07/    # Legacy V1 (archived)
├── CLAUDE.md                 # AI development guidelines
└── README.md                 # This file
```

### 🚀 Quick Start

**Windows:**
```batch
tools\windows\start-fossawork.bat
```

**macOS/Linux:**
```bash
./tools/unix/start-fossawork.sh
```

These scripts handle:
- ✅ Python environment setup
- ✅ All dependency installation
- ✅ Process cleanup
- ✅ Backend server with full authentication
- ✅ Frontend development server
- ✅ Automatic browser launch

**Server URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Auth Status: http://localhost:8000/api/setup/status

**Manual Start (if needed):**
```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm run dev
```

### ✅ All Tests Passing:
- Project Structure ✅
- Backend Completeness ✅
- Frontend Completeness ✅
- API Endpoints ✅
- Data Models ✅
- Frontend API Integration ✅
- React Components ✅
- Configuration Files ✅

### 🔧 Key Features Implemented:
- **Multi-user data isolation** with secure authentication
- **Work order management** with full CRUD operations
- **Dispenser tracking** with progress monitoring
- **Real-time dashboard** with live metrics
- **Automation system** ready for browser automation
- **Modern responsive UI** with mobile support

### 📋 API Endpoints:
- `POST /api/v1/users` - Create user
- `POST /api/v1/users/login` - User login
- `GET /api/v1/work-orders` - List work orders
- `POST /api/v1/work-orders/scrape` - Trigger scraping
- `PATCH /api/v1/work-orders/{id}/status` - Update status
- Plus many more... see `/docs` for full API documentation

### 🗂️ V1 Archive:
The legacy V1 application has been archived in `V1-Archive-2025-01-07/` for reference.

---
**Version:** 2.0.0  
**Status:** Production Ready 🚀
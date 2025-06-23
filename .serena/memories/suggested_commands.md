# FossaWork V2 Development Commands

## Development Commands

### Starting Development Servers

**Full Stack Development (Recommended):**
```bash
# Terminal 1 - Backend
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
source venv/bin/activate  # Unix/macOS
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
npm run dev

# Terminal 3 - Electron (Optional)
npm run electron:dev
```

**Quick Start Scripts:**
- Windows: `tools\windows\start-fossawork.bat`
- macOS/Linux: `./tools/unix/start-fossawork.sh`

### Testing Commands

**Frontend Testing:**
```bash
npm test                # Run tests
npm run test:watch      # Watch mode
```

**Backend Testing:**
```bash
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
pytest                  # Run all tests
pytest -v              # Verbose output
pytest -k "test_name"  # Run specific test
pytest -m unit         # Run unit tests only
```

### Linting & Formatting

**Frontend:**
```bash
npm run lint           # ESLint check
npm run format         # Prettier format
```

**Backend (Python):**
```bash
# Black formatting
black backend/

# isort import sorting
isort backend/

# Flake8 linting
flake8 backend/ --max-line-length=88 --extend-ignore=E203,W503

# Run all pre-commit hooks
pre-commit run --all-files
```

### Building & Deployment

**Frontend Build:**
```bash
npm run build
npm run preview       # Preview production build
```

**Electron Build:**
```bash
npm run electron:build
```

**Docker Deployment:**
```bash
docker-compose up     # Start all services
docker-compose down   # Stop all services
```

### Database Commands

**Alembic Migrations:**
```bash
cd backend
alembic upgrade head        # Apply migrations
alembic revision -m "desc"  # Create new migration
alembic downgrade -1       # Rollback one migration
```

### Maintenance Commands

```bash
npm run cleanup-ports      # Clean up stuck ports
npm run fix-vite-cache    # Fix Vite cache issues
npm run fix-vite-full     # Full Vite fix
npm run backup            # Backup data
```

### Git Commands (Darwin/macOS specific)

```bash
git status               # Check status
git add .               # Stage all changes
git commit -m "message" # Commit changes
git push                # Push to remote
git pull                # Pull from remote
git log --oneline       # View commit history
```

### Process Management

**PM2 Commands:**
```bash
pm2 start ecosystem.config.js  # Start all services
pm2 status                     # Check status
pm2 logs                      # View logs
pm2 restart all               # Restart all
pm2 stop all                  # Stop all
```

### Security Setup (REQUIRED before first run)

```bash
cd backend
python scripts/generate_secure_keys.py
```

## API Documentation URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc
- Auth Status: http://localhost:8000/api/setup/status

## Environment Setup

**Python Virtual Environment:**
```bash
cd backend
python -m venv venv
source venv/bin/activate    # Unix/macOS
venv\Scripts\activate       # Windows
pip install -r requirements.txt
```

**Node Dependencies:**
```bash
cd frontend
npm install
```
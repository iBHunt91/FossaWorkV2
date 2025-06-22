# FossaWork V2 Codebase Structure

## Project Root Structure

```
FossaWorkV2/
├── backend/                    # Python FastAPI backend
├── frontend/                   # React TypeScript frontend
├── docs/                       # User documentation
├── ai_docs/                    # Technical AI documentation
├── specs/                      # Feature specifications
├── tests/                      # All test files (organized)
├── scripts/                    # Utility scripts
├── tools/                      # Platform-specific tools
├── docker/                     # Docker configuration
├── vibe_docs/                  # Development logs
├── demos/                      # Demo HTML files
└── Configuration files...
```

## Backend Structure (`/backend/`)

```
backend/
├── app/
│   ├── main.py                # FastAPI application entry
│   ├── database.py            # Database configuration
│   ├── core_models.py         # Legacy models
│   ├── auth/                  # Authentication system
│   │   ├── security.py        # JWT and password handling
│   │   └── dependencies.py    # Auth dependencies
│   ├── models/                # Data models
│   │   ├── user_models.py     # User-related models
│   │   ├── user_schemas.py    # Pydantic schemas
│   │   └── scraping_models.py # Scraping models
│   ├── routes/                # API endpoints
│   │   ├── auth.py            # Authentication endpoints
│   │   ├── users.py           # User management
│   │   ├── work_orders.py     # Work order operations
│   │   ├── automation.py      # Form automation
│   │   ├── notifications.py   # Notification system
│   │   └── ...                # Other route modules
│   ├── services/              # Business logic
│   │   ├── user_management.py # User service
│   │   ├── workfossa_scraper.py # Scraping service
│   │   ├── form_automation.py # Automation service
│   │   ├── notification_manager.py # Notifications
│   │   └── ...                # Other services
│   ├── middleware/            # Custom middleware
│   │   ├── auth_middleware.py # Authentication
│   │   └── request_id.py      # Request tracking
│   ├── utils/                 # Utility functions
│   └── data/                  # Static data files
├── alembic/                   # Database migrations
├── data/                      # Runtime data storage
│   ├── users/                 # User-specific data
│   ├── screenshots/           # Automation screenshots
│   └── job_queue/             # Job queue data
├── logs/                      # Application logs
├── scripts/                   # Backend scripts
├── tests/                     # Backend tests
├── requirements.txt           # Python dependencies
├── pytest.ini                 # Pytest configuration
└── .env.example              # Environment template
```

## Frontend Structure (`/frontend/`)

```
frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component
│   ├── components/           # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── Layout.tsx        # App layout
│   │   ├── WorkOrderList.tsx # Work order display
│   │   └── ...               # Other components
│   ├── pages/                # Page components
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── WorkOrders.tsx    # Work orders page
│   │   ├── Settings.tsx      # Settings page
│   │   └── Login.tsx         # Login page
│   ├── services/             # API integration
│   │   ├── api.ts           # Axios client
│   │   └── auth.ts          # Auth service
│   ├── hooks/                # Custom React hooks
│   ├── types/                # TypeScript types
│   ├── utils/                # Utility functions
│   └── styles/               # CSS files
├── public/                   # Static assets
├── dist/                     # Build output
├── package.json              # Node dependencies
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS config
└── tsconfig.json            # TypeScript config
```

## Key Configuration Files

### Root Level
- `.mcp.json` - MCP server configuration
- `.pre-commit-config.yaml` - Pre-commit hooks
- `CLAUDE.md` - AI assistant instructions
- `ecosystem.config.js` - PM2 configuration
- `components.json` - shadcn/ui configuration

### Backend
- `backend/.env` - Environment variables (not in git)
- `backend/pytest.ini` - Test configuration
- `backend/alembic.ini` - Migration configuration

### Frontend
- `frontend/vite.config.ts` - Build configuration
- `frontend/tailwind.config.js` - Styling configuration
- `frontend/.eslintrc.json` - Linting rules

## Data Storage Patterns

### Database (SQLite)
- Work orders
- Dispensers
- Users and authentication
- Scraping history
- Automation jobs

### JSON Files
- User preferences: `data/users/{userId}/preferences.json`
- Credentials: `data/credentials/{userId}.json` (encrypted)
- Settings: `data/settings/{category}.json`
- Schedule data: `data/schedules/`

## API Structure

### Authentication Required
- `/api/v1/users/*` - User management
- `/api/v1/work-orders/*` - Work order operations
- `/api/v1/automation/*` - Automation tasks
- `/api/v1/settings/*` - User settings

### Public Endpoints
- `/api/auth/login` - User login
- `/api/setup/status` - Setup status
- `/health` - Health check
- `/` - Root endpoint

## Testing Organization

```
tests/
├── backend/              # Backend tests
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test fixtures
├── frontend/            # Frontend tests
│   ├── components/      # Component tests
│   └── pages/          # Page tests
├── automation/          # Browser automation tests
└── e2e/                # End-to-end tests
```

## Important Patterns

### Service Layer Pattern
- Routes handle HTTP concerns
- Services contain business logic
- Models define data structures
- Clear separation of concerns

### Error Handling
- Custom exceptions in services
- HTTP exceptions in routes
- Consistent error response format
- Comprehensive logging

### Authentication Flow
1. User credentials → `/api/auth/login`
2. JWT token returned
3. Token included in Authorization header
4. Middleware validates on protected routes

### Multi-user Isolation
- User ID in JWT claims
- Data filtered by user ID
- Separate storage directories
- No cross-user data access
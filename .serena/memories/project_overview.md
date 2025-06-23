# FossaWork V2 Project Overview

## Project Purpose
FossaWork V2 is a modern fuel dispenser automation system designed for automating work orders, tracking dispensers, and managing fuel station maintenance tasks. It's a complete rebuild with modern architecture, security, and multi-user support.

## Tech Stack

### Frontend
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite
- **Styling:** TailwindCSS, shadcn/ui components
- **State Management:** @tanstack/react-query
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Routing:** React Router DOM

### Backend
- **Framework:** FastAPI (Python 3.8+)
- **Database:** SQLite (with SQLAlchemy ORM)
- **Database Migrations:** Alembic
- **Authentication:** JWT tokens with passlib[bcrypt]
- **Browser Automation:** Playwright
- **Task Scheduling:** APScheduler
- **Encryption:** Cryptography library
- **Async Operations:** aiofiles, aiohttp

### Desktop
- **Framework:** Electron 35+

### Deployment
- Docker support via docker-compose
- PM2 ecosystem for process management

## Key Features
- Multi-user data isolation with secure authentication
- Work order management with full CRUD operations
- Web scraping from WorkFossa platform
- Form automation (single/batch) using Playwright
- Multi-channel notifications (Email/Pushover/Desktop)
- Real-time dashboard with live metrics
- Schedule management and progress tracking
- Dispenser tracking with progress monitoring

## Architecture
- RESTful API design with standardized response formats
- User-specific data isolation (data stored in `data/users/{userId}/`)
- Hybrid storage: JSON files for settings/credentials + SQLite for work orders
- WebSocket support for real-time features
- Circuit breaker pattern for external service calls
- Comprehensive error recovery system
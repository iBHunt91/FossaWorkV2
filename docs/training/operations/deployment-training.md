# Deployment Training for FossaWork V2
*Operations & DevOps Team Training*

## Learning Objectives
By the end of this training, team members will:
- Execute safe and reliable deployment procedures for FossaWork V2
- Implement proper rollback strategies and disaster recovery
- Understand infrastructure requirements and scaling considerations
- Monitor deployments and identify issues quickly
- Follow security best practices during deployment processes

## Table of Contents
1. [Deployment Overview](#deployment-overview)
2. [Development Environment Setup](#development-environment-setup)
3. [Production Deployment Process](#production-deployment-process)
4. [Docker Containerization](#docker-containerization)
5. [Database Migration and Management](#database-migration-and-management)
6. [Security Hardening for Production](#security-hardening-for-production)
7. [Monitoring and Health Checks](#monitoring-and-health-checks)
8. [Rollback Procedures](#rollback-procedures)
9. [Scaling and Performance](#scaling-and-performance)
10. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Deployment Overview

### FossaWork V2 Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   React/Vite    │◄──►│   FastAPI       │◄──►│   SQLite/       │
│   Port 3000     │    │   Port 8000     │    │   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Files  │    │   API Services  │    │   Data Storage  │
│   Nginx/CDN     │    │   Gunicorn +    │    │   Backup &      │
│                 │    │   Uvicorn       │    │   Recovery      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Deployment Environments

#### Development Environment
- **Purpose**: Local development and testing
- **Components**: Hot reload, debug mode, SQLite database
- **Security**: Minimal (development only)
- **Monitoring**: Basic console logging

#### Staging Environment
- **Purpose**: Pre-production testing and validation
- **Components**: Production-like setup with test data
- **Security**: Production security with test certificates
- **Monitoring**: Full monitoring stack

#### Production Environment
- **Purpose**: Live application serving real users
- **Components**: Optimized, scalable, secure
- **Security**: Full security hardening
- **Monitoring**: Comprehensive monitoring and alerting

### Deployment Strategy Options

#### 1. Blue-Green Deployment
```yaml
Blue-Green Strategy:
  Current (Blue):
    - Live production environment
    - Serving all traffic
    - Known stable state
  
  New (Green):
    - Identical environment with new version
    - Zero traffic initially
    - Full testing before switch
  
  Switch Process:
    1. Deploy to Green environment
    2. Run comprehensive tests
    3. Switch traffic from Blue to Green
    4. Monitor for issues
    5. Keep Blue as instant rollback
```

#### 2. Rolling Deployment
```yaml
Rolling Strategy:
  Process:
    1. Deploy to subset of servers
    2. Test health of updated servers
    3. Gradually move traffic to updated servers
    4. Continue until all servers updated
  
  Benefits:
    - Zero downtime
    - Gradual risk exposure
    - Easy monitoring
  
  Considerations:
    - Requires load balancer
    - May have mixed versions temporarily
```

#### 3. Canary Deployment
```yaml
Canary Strategy:
  Process:
    1. Deploy new version to small subset (5-10%)
    2. Monitor metrics and user feedback
    3. Gradually increase traffic percentage
    4. Full deployment if metrics good
  
  Benefits:
    - Minimal risk exposure
    - Real user validation
    - Easy rollback
```

## Development Environment Setup

### Local Development Deployment
```bash
#!/bin/bash
# Local development setup script

echo "=== FossaWork V2 Development Setup ==="

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Node.js and npm
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js not installed"
        echo "Install from: https://nodejs.org/"
        exit 1
    fi
    
    # Python 3.8+
    python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if (( $(echo "$python_version < 3.8" | bc -l) )); then
        echo "Error: Python 3.8+ required (found $python_version)"
        exit 1
    fi
    
    # Git
    if ! command -v git &> /dev/null; then
        echo "Error: Git not installed"
        exit 1
    fi
    
    echo "✓ Prerequisites check passed"
}

# Setup frontend
setup_frontend() {
    echo "Setting up frontend..."
    
    cd frontend || exit 1
    
    # Install dependencies
    npm install
    
    # Create environment file
    cat > .env.local << EOF
VITE_API_URL=http://localhost:8000
VITE_APP_TITLE=FossaWork V2 (Development)
VITE_DEBUG=true
EOF
    
    echo "✓ Frontend setup complete"
    cd ..
}

# Setup backend
setup_backend() {
    echo "Setting up backend..."
    
    cd backend || exit 1
    
    # Create virtual environment
    python3 -m venv venv
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Create environment file
    cat > .env << EOF
# Development Configuration
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=sqlite:///./fossawork_v2.db

# Security
SECRET_KEY=$(openssl rand -hex 32)

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Logging
LOG_LEVEL=DEBUG

# External Services (Development)
WORKFOSSA_BASE_URL=https://app.workfossa.com
EOF
    
    # Initialize database
    python -c "
from app.database import engine, Base
Base.metadata.create_all(bind=engine)
print('Database initialized')
"
    
    echo "✓ Backend setup complete"
    cd ..
}

# Setup development tools
setup_dev_tools() {
    echo "Setting up development tools..."
    
    # Install pre-commit hooks
    pip install pre-commit
    pre-commit install
    
    # Setup VS Code configuration
    mkdir -p .vscode
    cat > .vscode/settings.json << EOF
{
    "python.defaultInterpreterPath": "./backend/venv/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": false,
    "python.linting.flake8Enabled": true,
    "typescript.preferences.importModuleSpecifier": "relative",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    }
}
EOF
    
    # Setup launch configuration
    cat > .vscode/launch.json << EOF
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: FastAPI",
            "type": "python",
            "request": "launch",
            "program": "\${workspaceFolder}/backend/venv/bin/uvicorn",
            "args": ["app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
            "console": "integratedTerminal",
            "cwd": "\${workspaceFolder}/backend"
        }
    ]
}
EOF
    
    echo "✓ Development tools setup complete"
}

# Run setup
main() {
    check_prerequisites
    setup_frontend
    setup_backend
    setup_dev_tools
    
    echo ""
    echo "=== Setup Complete ==="
    echo "To start development:"
    echo ""
    echo "Terminal 1 (Backend):"
    echo "  cd backend"
    echo "  source venv/bin/activate"
    echo "  uvicorn app.main:app --reload"
    echo ""
    echo "Terminal 2 (Frontend):"
    echo "  cd frontend"
    echo "  npm run dev"
    echo ""
    echo "Access application at: http://localhost:3000"
}

main
```

### Development Workflow
```bash
#!/bin/bash
# Daily development workflow script

# Start development servers
start_dev() {
    echo "Starting FossaWork V2 development environment..."
    
    # Start backend in background
    cd backend
    source venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    cd ..
    
    # Start frontend in background
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    echo "Backend PID: $BACKEND_PID"
    echo "Frontend PID: $FRONTEND_PID"
    echo "Development servers started!"
    echo "Frontend: http://localhost:3000"
    echo "Backend: http://localhost:8000"
    echo "API Docs: http://localhost:8000/docs"
    
    # Save PIDs for cleanup
    echo "$BACKEND_PID" > .dev_backend.pid
    echo "$FRONTEND_PID" > .dev_frontend.pid
}

# Stop development servers
stop_dev() {
    echo "Stopping development servers..."
    
    if [ -f .dev_backend.pid ]; then
        kill $(cat .dev_backend.pid) 2>/dev/null
        rm .dev_backend.pid
    fi
    
    if [ -f .dev_frontend.pid ]; then
        kill $(cat .dev_frontend.pid) 2>/dev/null
        rm .dev_frontend.pid
    fi
    
    echo "Development servers stopped"
}

# Clean and reset development environment
reset_dev() {
    echo "Resetting development environment..."
    
    stop_dev
    
    # Clean backend
    cd backend
    rm -rf __pycache__ .pytest_cache
    rm -f fossawork_v2.db
    source venv/bin/activate
    python -c "
from app.database import engine, Base
Base.metadata.create_all(bind=engine)
print('Database reset')
"
    cd ..
    
    # Clean frontend
    cd frontend
    rm -rf dist .vite
    npm run build
    cd ..
    
    echo "Development environment reset complete"
}

# Run tests
test_dev() {
    echo "Running development tests..."
    
    # Backend tests
    cd backend
    source venv/bin/activate
    pytest tests/ -v
    cd ..
    
    # Frontend tests (if available)
    cd frontend
    if [ -f "package.json" ] && grep -q "test" package.json; then
        npm test
    fi
    cd ..
}

case "$1" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    reset)
        reset_dev
        ;;
    test)
        test_dev
        ;;
    *)
        echo "Usage: $0 {start|stop|reset|test}"
        echo "  start - Start development servers"
        echo "  stop  - Stop development servers"
        echo "  reset - Reset development environment"
        echo "  test  - Run tests"
        exit 1
        ;;
esac
```

## Production Deployment Process

### Pre-Deployment Checklist
```yaml
Pre-Deployment Checklist:
  Code Quality:
    - [ ] All tests passing
    - [ ] Code review completed
    - [ ] Security scan passed
    - [ ] Performance tests passed
    - [ ] Documentation updated
  
  Infrastructure:
    - [ ] Production environment ready
    - [ ] Database backup completed
    - [ ] SSL certificates valid
    - [ ] DNS configuration verified
    - [ ] Load balancer configured
  
  Security:
    - [ ] Environment variables secured
    - [ ] Secrets properly managed
    - [ ] Security headers configured
    - [ ] CORS settings verified
    - [ ] Rate limiting enabled
  
  Monitoring:
    - [ ] Logging configured
    - [ ] Metrics collection enabled
    - [ ] Alerting rules set up
    - [ ] Health checks defined
    - [ ] Dashboard access verified
  
  Rollback Plan:
    - [ ] Rollback procedure documented
    - [ ] Database rollback strategy ready
    - [ ] Emergency contacts notified
    - [ ] Rollback testing completed
```

### Production Deployment Script
```bash
#!/bin/bash
# Production deployment script for FossaWork V2

set -e  # Exit on any error

# Configuration
DEPLOY_ENV="production"
APP_NAME="fossawork-v2"
DEPLOY_USER="fossawork"
DEPLOY_PATH="/opt/fossawork-v2"
BACKUP_PATH="/backup/fossawork-v2"
LOG_FILE="/var/log/fossawork-deploy.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if running as correct user
    if [ "$USER" != "$DEPLOY_USER" ]; then
        error_exit "Must run as $DEPLOY_USER user"
    fi
    
    # Check disk space
    DISK_USAGE=$(df /opt | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 85 ]; then
        error_exit "Insufficient disk space: ${DISK_USAGE}% used"
    fi
    
    # Check if services are running
    if ! systemctl is-active --quiet fossawork-backend; then
        log "WARNING: Backend service not running"
    fi
    
    if ! systemctl is-active --quiet nginx; then
        log "WARNING: Nginx not running"
    fi
    
    # Verify database connectivity
    cd "$DEPLOY_PATH/current/backend"
    source venv/bin/activate
    python -c "
from app.database import engine
try:
    with engine.connect() as conn:
        result = conn.execute('SELECT 1')
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
" || error_exit "Database connectivity check failed"
    
    log "Pre-deployment checks completed successfully"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$BACKUP_PATH/$BACKUP_TIMESTAMP"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current application
    if [ -d "$DEPLOY_PATH/current" ]; then
        cp -r "$DEPLOY_PATH/current" "$BACKUP_DIR/application"
    fi
    
    # Backup database
    if [ -f "$DEPLOY_PATH/current/backend/fossawork_v2.db" ]; then
        cp "$DEPLOY_PATH/current/backend/fossawork_v2.db" "$BACKUP_DIR/database.db"
    fi
    
    # Backup user data
    if [ -d "$DEPLOY_PATH/current/backend/data" ]; then
        cp -r "$DEPLOY_PATH/current/backend/data" "$BACKUP_DIR/data"
    fi
    
    # Backup configuration
    cp "$DEPLOY_PATH/current/backend/.env" "$BACKUP_DIR/env_backup" 2>/dev/null || true
    
    log "Backup created: $BACKUP_DIR"
    echo "$BACKUP_DIR" > "$DEPLOY_PATH/.last_backup"
}

# Deploy new version
deploy_application() {
    log "Deploying new application version..."
    
    # Create new release directory
    RELEASE_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    RELEASE_DIR="$DEPLOY_PATH/releases/$RELEASE_TIMESTAMP"
    
    mkdir -p "$RELEASE_DIR"
    
    # Clone/copy new code (adjust based on your deployment method)
    cd "$RELEASE_DIR"
    
    # Example: Git deployment
    if [ -n "$GIT_REPO" ] && [ -n "$GIT_BRANCH" ]; then
        git clone --branch "$GIT_BRANCH" "$GIT_REPO" .
    else
        # Copy from staging area
        cp -r /tmp/fossawork-deploy/* .
    fi
    
    # Setup backend
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    
    # Copy production configuration
    cp "$DEPLOY_PATH/config/production.env" .env
    
    # Setup frontend
    cd ../frontend
    npm ci --production
    npm run build
    
    # Create symbolic link to new release
    cd "$DEPLOY_PATH"
    rm -f current
    ln -sf "releases/$RELEASE_TIMESTAMP" current
    
    log "Application deployed to: $RELEASE_DIR"
}

# Database migration
run_database_migration() {
    log "Running database migrations..."
    
    cd "$DEPLOY_PATH/current/backend"
    source venv/bin/activate
    
    # Run Alembic migrations (if using Alembic)
    if [ -f "alembic.ini" ]; then
        alembic upgrade head
    else
        # Manual schema update
        python -c "
from app.database import engine, Base
Base.metadata.create_all(bind=engine)
print('Database schema updated')
"
    fi
    
    log "Database migrations completed"
}

# Update services
update_services() {
    log "Updating services..."
    
    # Reload systemd if service files changed
    if [ -f "$DEPLOY_PATH/current/deployment/fossawork-backend.service" ]; then
        sudo cp "$DEPLOY_PATH/current/deployment/fossawork-backend.service" /etc/systemd/system/
        sudo systemctl daemon-reload
    fi
    
    # Update nginx configuration
    if [ -f "$DEPLOY_PATH/current/deployment/nginx.conf" ]; then
        sudo cp "$DEPLOY_PATH/current/deployment/nginx.conf" /etc/nginx/sites-available/fossawork
        sudo nginx -t || error_exit "Nginx configuration test failed"
    fi
    
    log "Services updated"
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    # Restart backend service
    sudo systemctl restart fossawork-backend
    sleep 5
    
    if ! systemctl is-active --quiet fossawork-backend; then
        error_exit "Backend service failed to start"
    fi
    
    # Reload nginx
    sudo systemctl reload nginx
    
    if ! systemctl is-active --quiet nginx; then
        error_exit "Nginx failed to reload"
    fi
    
    log "Services restarted successfully"
}

# Health checks
run_health_checks() {
    log "Running health checks..."
    
    # Wait for application to be ready
    sleep 10
    
    # Check backend health
    BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
    if [ "$BACKEND_HEALTH" != "200" ]; then
        error_exit "Backend health check failed: HTTP $BACKEND_HEALTH"
    fi
    
    # Check frontend accessibility
    FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
    if [ "$FRONTEND_HEALTH" != "200" ]; then
        error_exit "Frontend health check failed: HTTP $FRONTEND_HEALTH"
    fi
    
    # Check database connectivity
    cd "$DEPLOY_PATH/current/backend"
    source venv/bin/activate
    python -c "
from app.database import engine
with engine.connect() as conn:
    result = conn.execute('SELECT COUNT(*) FROM work_orders')
    print(f'Database check passed: {result.fetchone()[0]} work orders')
" || error_exit "Database health check failed"
    
    log "Health checks passed"
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."
    
    # Clean up old releases (keep last 5)
    cd "$DEPLOY_PATH/releases"
    ls -t | tail -n +6 | xargs -r rm -rf
    
    # Clean up old backups (keep last 10)
    cd "$BACKUP_PATH"
    ls -t | tail -n +11 | xargs -r rm -rf
    
    # Update deployment status
    echo "$(date '+%Y-%m-%d %H:%M:%S'): Deployment successful" >> "$DEPLOY_PATH/deployment_history.log"
    
    log "Post-deployment tasks completed"
}

# Main deployment function
main() {
    log "Starting FossaWork V2 production deployment"
    
    pre_deployment_checks
    create_backup
    deploy_application
    run_database_migration
    update_services
    restart_services
    run_health_checks
    post_deployment_tasks
    
    log "Production deployment completed successfully"
    
    # Send notification (implement based on your notification system)
    # send_deployment_notification "success" "FossaWork V2 deployed successfully"
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        source rollback.sh
        ;;
    status)
        systemctl status fossawork-backend nginx
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status}"
        exit 1
        ;;
esac
```

## Docker Containerization

### Dockerfile for Backend
```dockerfile
# Dockerfile for FossaWork V2 Backend
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create app user
RUN groupadd -g 1000 fossawork && \
    useradd -u 1000 -g fossawork -m -s /bin/bash fossawork

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs data/users && \
    chown -R fossawork:fossawork /app

# Switch to non-root user
USER fossawork

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile for Frontend
```dockerfile
# Multi-stage build for FossaWork V2 Frontend
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1000 fossawork && \
    adduser -u 1000 -G fossawork -s /bin/sh -D fossawork

# Set permissions
RUN chown -R fossawork:fossawork /usr/share/nginx/html && \
    chown -R fossawork:fossawork /var/cache/nginx && \
    chown -R fossawork:fossawork /var/log/nginx && \
    chown -R fossawork:fossawork /etc/nginx/conf.d

# Switch to non-root user
USER fossawork

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose for Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fossawork_backend
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://fossawork:${DB_PASSWORD}@db:5432/fossawork_v2
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./backups:/app/backups
    depends_on:
      - db
      - redis
    networks:
      - fossawork_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: fossawork_frontend
    restart: unless-stopped
    ports:
      - "80:3000"
      - "443:3000"
    depends_on:
      - backend
    networks:
      - fossawork_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:13
    container_name: fossawork_db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=fossawork_v2
      - POSTGRES_USER=fossawork
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - fossawork_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fossawork"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:6-alpine
    container_name: fossawork_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - fossawork_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: fossawork_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deployment/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - fossawork_network

volumes:
  postgres_data:
  redis_data:

networks:
  fossawork_network:
    driver: bridge
```

## Database Migration and Management

### Migration Strategy
```python
# Database migration management
from alembic import command
from alembic.config import Config
import os
import shutil
from datetime import datetime

class DatabaseMigration:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.backup_dir = "/backups/database"
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def create_backup(self) -> str:
        """Create database backup before migration"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"{self.backup_dir}/backup_{timestamp}.sql"
        
        if "sqlite" in self.database_url:
            # SQLite backup
            db_file = self.database_url.split("///")[-1]
            backup_db = f"{self.backup_dir}/backup_{timestamp}.db"
            shutil.copy2(db_file, backup_db)
            return backup_db
        
        elif "postgresql" in self.database_url:
            # PostgreSQL backup
            os.system(f"pg_dump {self.database_url} > {backup_file}")
            return backup_file
        
        else:
            raise ValueError("Unsupported database type")
    
    def run_migration(self, target_revision: str = "head"):
        """Run database migration"""
        try:
            # Create backup
            backup_file = self.create_backup()
            print(f"Database backup created: {backup_file}")
            
            # Run migration
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, target_revision)
            
            print(f"Migration to {target_revision} completed successfully")
            return True
            
        except Exception as e:
            print(f"Migration failed: {e}")
            self.rollback_migration(backup_file)
            return False
    
    def rollback_migration(self, backup_file: str):
        """Rollback migration using backup"""
        try:
            if "sqlite" in self.database_url:
                db_file = self.database_url.split("///")[-1]
                shutil.copy2(backup_file, db_file)
            
            elif "postgresql" in self.database_url:
                os.system(f"psql {self.database_url} < {backup_file}")
            
            print("Database rollback completed")
            
        except Exception as e:
            print(f"Rollback failed: {e}")
            raise
    
    def validate_migration(self) -> bool:
        """Validate migration success"""
        try:
            from app.database import engine
            
            # Test database connectivity
            with engine.connect() as conn:
                result = conn.execute("SELECT 1")
                assert result.fetchone()[0] == 1
            
            # Test table existence
            from sqlalchemy import inspect
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            required_tables = ["work_orders", "users", "dispensers"]
            for table in required_tables:
                assert table in tables, f"Table {table} missing"
            
            print("Migration validation passed")
            return True
            
        except Exception as e:
            print(f"Migration validation failed: {e}")
            return False

# Migration script
def run_production_migration():
    """Run production database migration"""
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not set")
    
    migration = DatabaseMigration(database_url)
    
    print("Starting production database migration...")
    
    # Run migration
    success = migration.run_migration()
    
    if success:
        # Validate migration
        if migration.validate_migration():
            print("Migration completed and validated successfully")
        else:
            print("Migration validation failed")
            return False
    else:
        print("Migration failed")
        return False
    
    return True

if __name__ == "__main__":
    run_production_migration()
```

### Database Schema Management
```sql
-- Schema versioning and management

-- Create schema_version table for tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version_id INTEGER PRIMARY KEY,
    version_number VARCHAR(50) NOT NULL,
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    checksum VARCHAR(255)
);

-- Migration V1.0.0: Initial schema
-- Description: Create initial tables for FossaWork V2
BEGIN TRANSACTION;

-- Work orders table
CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id VARCHAR(20) NOT NULL,
    store_number VARCHAR(10) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    address TEXT,
    service_code INTEGER NOT NULL,
    service_name VARCHAR(100),
    service_items TEXT,
    scheduled_date DATE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    visit_url TEXT,
    customer_url TEXT,
    instructions TEXT
);

-- Users table (for multi-user support)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Dispensers table
CREATE TABLE IF NOT EXISTS dispensers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_url TEXT NOT NULL,
    dispenser_id VARCHAR(50),
    product VARCHAR(100),
    serial_number VARCHAR(100),
    user_id INTEGER NOT NULL,
    scraped_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_orders_user_id ON work_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_job_id ON work_orders (job_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_store_number ON work_orders (store_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_service_code ON work_orders (service_code);
CREATE INDEX IF NOT EXISTS idx_dispensers_user_id ON dispensers (user_id);
CREATE INDEX IF NOT EXISTS idx_dispensers_customer_url ON dispensers (customer_url);

-- Insert schema version
INSERT INTO schema_version (version_number, description, checksum) 
VALUES ('1.0.0', 'Initial schema creation', 'checksum_placeholder');

COMMIT;

-- Migration V1.1.0: Add audit logging
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    user_id INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation ON audit_logs (table_name, operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);

INSERT INTO schema_version (version_number, description, checksum) 
VALUES ('1.1.0', 'Add audit logging', 'checksum_placeholder');

COMMIT;
```

## Security Hardening for Production

### Production Security Configuration
```bash
#!/bin/bash
# Production security hardening script

echo "=== FossaWork V2 Production Security Hardening ==="

# System hardening
harden_system() {
    echo "Hardening system security..."
    
    # Update system packages
    sudo apt update && sudo apt upgrade -y
    
    # Install security tools
    sudo apt install -y ufw fail2ban rkhunter chkrootkit
    
    # Configure firewall
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow 22    # SSH
    sudo ufw allow 80    # HTTP
    sudo ufw allow 443   # HTTPS
    sudo ufw --force enable
    
    # Configure fail2ban
    sudo tee /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-dos]
enabled = true
filter = nginx-dos
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 300
findtime = 600
bantime = 600
EOF
    
    sudo systemctl restart fail2ban
    
    echo "System hardening completed"
}

# Application security
harden_application() {
    echo "Hardening application security..."
    
    # Set file permissions
    find /opt/fossawork-v2 -type f -exec chmod 644 {} \;
    find /opt/fossawork-v2 -type d -exec chmod 755 {} \;
    chmod 600 /opt/fossawork-v2/current/backend/.env
    chmod 600 /opt/fossawork-v2/current/backend/fossawork_v2.db
    
    # Secure sensitive directories
    find /opt/fossawork-v2/current/backend/data -type f -exec chmod 600 {} \;
    find /opt/fossawork-v2/current/backend/data -type d -exec chmod 700 {} \;
    
    # Set ownership
    chown -R fossawork:fossawork /opt/fossawork-v2
    
    echo "Application hardening completed"
}

# Database security
harden_database() {
    echo "Hardening database security..."
    
    # PostgreSQL security (if using PostgreSQL)
    if command -v psql >/dev/null 2>&1; then
        sudo -u postgres psql -c "ALTER USER fossawork PASSWORD '$(openssl rand -base64 32)';"
        
        # Update pg_hba.conf for stricter authentication
        sudo tee -a /etc/postgresql/*/main/pg_hba.conf << EOF
# FossaWork V2 security
local   fossawork_v2    fossawork                     md5
host    fossawork_v2    fossawork    127.0.0.1/32     md5
EOF
        
        sudo systemctl restart postgresql
    fi
    
    # SQLite security (if using SQLite)
    if [ -f "/opt/fossawork-v2/current/backend/fossawork_v2.db" ]; then
        chmod 600 /opt/fossawork-v2/current/backend/fossawork_v2.db
        chown fossawork:fossawork /opt/fossawork-v2/current/backend/fossawork_v2.db
    fi
    
    echo "Database hardening completed"
}

# Web server security
harden_nginx() {
    echo "Hardening Nginx security..."
    
    # Create secure Nginx configuration
    sudo tee /etc/nginx/conf.d/security.conf << EOF
# Security headers
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'" always;
add_header Referrer-Policy strict-origin-when-cross-origin always;

# Hide Nginx version
server_tokens off;

# Rate limiting
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/m;

# SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
EOF
    
    # Test and reload Nginx
    sudo nginx -t && sudo systemctl reload nginx
    
    echo "Nginx hardening completed"
}

# SSL/TLS setup
setup_ssl() {
    echo "Setting up SSL certificates..."
    
    # Install certbot if not present
    if ! command -v certbot >/dev/null 2>&1; then
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    # Generate SSL certificate (replace with your domain)
    DOMAIN="your-domain.com"
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN"
    
    # Setup auto-renewal
    sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -
    
    echo "SSL setup completed"
}

# Environment security
secure_environment() {
    echo "Securing environment configuration..."
    
    # Generate secure secrets
    SECRET_KEY=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Create secure environment file
    sudo tee /opt/fossawork-v2/config/production.env << EOF
# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false

# Database
DATABASE_URL=postgresql://fossawork:${DB_PASSWORD}@localhost:5432/fossawork_v2

# Security
SECRET_KEY=${SECRET_KEY}

# CORS
ALLOWED_ORIGINS=https://your-domain.com

# Logging
LOG_LEVEL=INFO

# Rate Limiting
ENABLE_RATE_LIMITING=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600

# Session Security
SESSION_SECURE=true
SESSION_HTTPONLY=true
SESSION_SAMESITE=strict

# External Services
WORKFOSSA_BASE_URL=https://app.workfossa.com
EOF
    
    chmod 600 /opt/fossawork-v2/config/production.env
    chown fossawork:fossawork /opt/fossawork-v2/config/production.env
    
    echo "Environment security completed"
}

# Security monitoring
setup_security_monitoring() {
    echo "Setting up security monitoring..."
    
    # Install OSSEC or similar HIDS
    wget -q -O - https://ossec.github.io/key/GPG-KEY-OSSEC | sudo apt-key add -
    echo 'deb http://ossec.github.io/repos/apt/ubuntu xenial main' | sudo tee /etc/apt/sources.list.d/ossec.list
    sudo apt update
    sudo apt install -y ossec-hids
    
    # Configure log monitoring
    sudo tee -a /var/ossec/etc/ossec.conf << EOF
<localfile>
    <log_format>syslog</log_format>
    <location>/var/log/fossawork-deploy.log</location>
</localfile>

<localfile>
    <log_format>json</log_format>
    <location>/opt/fossawork-v2/current/logs/*.jsonl</location>
</localfile>
EOF
    
    sudo systemctl restart ossec
    
    echo "Security monitoring setup completed"
}

# Main hardening function
main() {
    harden_system
    harden_application
    harden_database
    harden_nginx
    setup_ssl
    secure_environment
    setup_security_monitoring
    
    echo ""
    echo "=== Security Hardening Complete ==="
    echo "Next steps:"
    echo "1. Update DNS records to point to this server"
    echo "2. Test SSL certificate: https://www.ssllabs.com/ssltest/"
    echo "3. Run security scan: nmap -sS -O target_ip"
    echo "4. Monitor logs: tail -f /var/log/auth.log"
    echo "5. Test fail2ban: fail2ban-client status"
}

main
```

## Monitoring and Health Checks

### Application Health Monitoring
```python
# Health check endpoint implementation
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import psutil
import time
from datetime import datetime
from sqlalchemy import text
from app.database import engine

class HealthCheck:
    def __init__(self):
        self.start_time = time.time()
    
    async def check_database(self) -> dict:
        """Check database connectivity and performance"""
        try:
            start_time = time.time()
            
            async with engine.begin() as conn:
                # Test basic connectivity
                await conn.execute(text("SELECT 1"))
                
                # Test table access
                result = await conn.execute(text("SELECT COUNT(*) FROM work_orders"))
                work_order_count = result.scalar()
                
                # Test write capability
                await conn.execute(text("SELECT 1 WHERE 1=0"))  # No-op write test
            
            response_time = time.time() - start_time
            
            return {
                "status": "healthy",
                "response_time_ms": round(response_time * 1000, 2),
                "work_order_count": work_order_count,
                "last_checked": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy", 
                "error": str(e),
                "last_checked": datetime.now().isoformat()
            }
    
    def check_system_resources(self) -> dict:
        """Check system resource usage"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            
            # Network I/O
            network = psutil.net_io_counters()
            
            return {
                "status": "healthy" if all([
                    cpu_percent < 80,
                    memory_percent < 85,
                    disk_percent < 90
                ]) else "warning",
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent,
                "disk_percent": round(disk_percent, 2),
                "network_bytes_sent": network.bytes_sent,
                "network_bytes_recv": network.bytes_recv,
                "last_checked": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "last_checked": datetime.now().isoformat()
            }
    
    def check_external_services(self) -> dict:
        """Check external service connectivity"""
        import requests
        
        services = {
            "workfossa": "https://app.workfossa.com",
        }
        
        results = {}
        
        for service_name, url in services.items():
            try:
                start_time = time.time()
                response = requests.get(url, timeout=10)
                response_time = time.time() - start_time
                
                results[service_name] = {
                    "status": "healthy" if response.status_code == 200 else "unhealthy",
                    "response_code": response.status_code,
                    "response_time_ms": round(response_time * 1000, 2),
                    "last_checked": datetime.now().isoformat()
                }
                
            except Exception as e:
                results[service_name] = {
                    "status": "unhealthy",
                    "error": str(e),
                    "last_checked": datetime.now().isoformat()
                }
        
        return results
    
    async def comprehensive_health_check(self) -> dict:
        """Run comprehensive health check"""
        
        # Calculate uptime
        uptime_seconds = time.time() - self.start_time
        uptime_hours = uptime_seconds / 3600
        
        # Run all checks
        database_health = await self.check_database()
        system_health = self.check_system_resources()
        external_health = self.check_external_services()
        
        # Determine overall status
        all_checks = [database_health, system_health] + list(external_health.values())
        
        if any(check.get("status") == "unhealthy" for check in all_checks):
            overall_status = "unhealthy"
        elif any(check.get("status") == "warning" for check in all_checks):
            overall_status = "warning"
        else:
            overall_status = "healthy"
        
        return {
            "status": overall_status,
            "timestamp": datetime.now().isoformat(),
            "uptime_hours": round(uptime_hours, 2),
            "version": "1.0.0",  # Get from config
            "checks": {
                "database": database_health,
                "system": system_health,
                "external_services": external_health
            }
        }

# Initialize health checker
health_checker = HealthCheck()

# FastAPI endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    health_status = await health_checker.comprehensive_health_check()
    
    status_code = 200
    if health_status["status"] == "unhealthy":
        status_code = 503
    elif health_status["status"] == "warning":
        status_code = 200  # Still healthy, just warning
    
    return JSONResponse(content=health_status, status_code=status_code)

@app.get("/health/database")
async def database_health():
    """Database-specific health check"""
    return await health_checker.check_database()

@app.get("/health/system")
async def system_health():
    """System resource health check"""
    return health_checker.check_system_resources()
```

### Monitoring Dashboard Script
```bash
#!/bin/bash
# Monitoring dashboard for FossaWork V2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service status
check_service() {
    local service_name=$1
    if systemctl is-active --quiet "$service_name"; then
        echo -e "${GREEN}✓${NC} $service_name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not running"
        return 1
    fi
}

# Function to check URL response
check_url() {
    local url=$1
    local expected_code=${2:-200}
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
    
    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $url responding (${response_time}s)"
        return 0
    else
        echo -e "${RED}✗${NC} $url not responding (HTTP $response_code)"
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    local threshold=${1:-85}
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -lt "$threshold" ]; then
        echo -e "${GREEN}✓${NC} Disk usage: ${usage}%"
        return 0
    else
        echo -e "${RED}✗${NC} Disk usage critical: ${usage}%"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    local threshold=${1:-85}
    local usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [ "$usage" -lt "$threshold" ]; then
        echo -e "${GREEN}✓${NC} Memory usage: ${usage}%"
        return 0
    else
        echo -e "${RED}✗${NC} Memory usage high: ${usage}%"
        return 1
    fi
}

# Function to check log errors
check_logs() {
    local log_file=$1
    local error_count
    
    if [ -f "$log_file" ]; then
        error_count=$(grep -c "ERROR\|CRITICAL" "$log_file" 2>/dev/null || echo 0)
        if [ "$error_count" -eq 0 ]; then
            echo -e "${GREEN}✓${NC} No errors in $log_file"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} $error_count errors in $log_file"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Log file $log_file not found"
        return 1
    fi
}

# Main monitoring function
run_monitoring() {
    clear
    echo "=== FossaWork V2 System Status ==="
    echo "Timestamp: $(date)"
    echo ""
    
    # System services
    echo "System Services:"
    check_service "fossawork-backend"
    check_service "nginx"
    check_service "postgresql" || check_service "sqlite"
    check_service "redis-server"
    echo ""
    
    # Application endpoints
    echo "Application Health:"
    check_url "http://localhost:8000/health"
    check_url "http://localhost:3000"
    check_url "https://your-domain.com" 443
    echo ""
    
    # System resources
    echo "System Resources:"
    check_disk_space 85
    check_memory 85
    
    # CPU load
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    cpu_cores=$(nproc)
    cpu_threshold=$(echo "$cpu_cores * 0.8" | bc)
    
    if (( $(echo "$load_avg < $cpu_threshold" | bc -l) )); then
        echo -e "${GREEN}✓${NC} CPU load: $load_avg (cores: $cpu_cores)"
    else
        echo -e "${RED}✗${NC} High CPU load: $load_avg (cores: $cpu_cores)"
    fi
    echo ""
    
    # Log file checks
    echo "Log Files:"
    check_logs "/var/log/fossawork-deploy.log"
    check_logs "/opt/fossawork-v2/current/logs/backend-errors.jsonl"
    check_logs "/var/log/nginx/error.log"
    echo ""
    
    # Security checks
    echo "Security Status:"
    
    # Check fail2ban
    if command -v fail2ban-client >/dev/null 2>&1; then
        banned_count=$(fail2ban-client status | grep "Jail list" | awk -F: '{print $2}' | wc -w)
        echo -e "${GREEN}✓${NC} Fail2ban active with $banned_count jails"
    else
        echo -e "${YELLOW}⚠${NC} Fail2ban not installed"
    fi
    
    # Check firewall
    if command -v ufw >/dev/null 2>&1; then
        ufw_status=$(ufw status | head -1 | awk '{print $2}')
        if [ "$ufw_status" = "active" ]; then
            echo -e "${GREEN}✓${NC} UFW firewall active"
        else
            echo -e "${RED}✗${NC} UFW firewall inactive"
        fi
    fi
    
    # Check SSL certificate expiry
    if command -v openssl >/dev/null 2>&1; then
        cert_expiry=$(echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
        if [ -n "$cert_expiry" ]; then
            days_until_expiry=$(( ( $(date -d "$cert_expiry" +%s) - $(date +%s) ) / 86400 ))
            if [ "$days_until_expiry" -gt 30 ]; then
                echo -e "${GREEN}✓${NC} SSL certificate expires in $days_until_expiry days"
            elif [ "$days_until_expiry" -gt 7 ]; then
                echo -e "${YELLOW}⚠${NC} SSL certificate expires in $days_until_expiry days"
            else
                echo -e "${RED}✗${NC} SSL certificate expires in $days_until_expiry days"
            fi
        fi
    fi
    
    echo ""
    echo "=== End Status Report ==="
}

# Continuous monitoring mode
if [ "$1" = "--watch" ]; then
    while true; do
        run_monitoring
        sleep 30
    done
else
    run_monitoring
fi
```

## Rollback Procedures

### Automated Rollback Script
```bash
#!/bin/bash
# Automated rollback script for FossaWork V2

set -e

# Configuration
DEPLOY_PATH="/opt/fossawork-v2"
BACKUP_PATH="/backup/fossawork-v2"
LOG_FILE="/var/log/fossawork-rollback.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Get last backup
get_last_backup() {
    if [ -f "$DEPLOY_PATH/.last_backup" ]; then
        cat "$DEPLOY_PATH/.last_backup"
    else
        error_exit "No backup information found"
    fi
}

# Rollback application
rollback_application() {
    local backup_dir=$1
    
    log "Rolling back application from: $backup_dir"
    
    # Stop services
    log "Stopping services..."
    sudo systemctl stop fossawork-backend
    
    # Backup current state (in case we need to roll forward)
    current_timestamp=$(date +%Y%m%d_%H%M%S)
    cp -r "$DEPLOY_PATH/current" "$BACKUP_PATH/pre_rollback_$current_timestamp" 2>/dev/null || true
    
    # Restore application from backup
    if [ -d "$backup_dir/application" ]; then
        rm -rf "$DEPLOY_PATH/current"
        cp -r "$backup_dir/application" "$DEPLOY_PATH/current"
        chown -R fossawork:fossawork "$DEPLOY_PATH/current"
    else
        error_exit "Application backup not found in $backup_dir"
    fi
    
    log "Application rollback completed"
}

# Rollback database
rollback_database() {
    local backup_dir=$1
    
    log "Rolling back database from: $backup_dir"
    
    if [ -f "$backup_dir/database.db" ]; then
        # SQLite rollback
        cp "$backup_dir/database.db" "$DEPLOY_PATH/current/backend/fossawork_v2.db"
        chown fossawork:fossawork "$DEPLOY_PATH/current/backend/fossawork_v2.db"
        chmod 600 "$DEPLOY_PATH/current/backend/fossawork_v2.db"
        
    elif [ -f "$backup_dir/database.sql" ]; then
        # PostgreSQL rollback
        local db_url=$(grep DATABASE_URL "$DEPLOY_PATH/current/backend/.env" | cut -d= -f2)
        psql "$db_url" < "$backup_dir/database.sql"
        
    else
        log "WARNING: No database backup found"
    fi
    
    log "Database rollback completed"
}

# Rollback user data
rollback_user_data() {
    local backup_dir=$1
    
    log "Rolling back user data from: $backup_dir"
    
    if [ -d "$backup_dir/data" ]; then
        rm -rf "$DEPLOY_PATH/current/backend/data"
        cp -r "$backup_dir/data" "$DEPLOY_PATH/current/backend/data"
        chown -R fossawork:fossawork "$DEPLOY_PATH/current/backend/data"
        find "$DEPLOY_PATH/current/backend/data" -type f -exec chmod 600 {} \;
        find "$DEPLOY_PATH/current/backend/data" -type d -exec chmod 700 {} \;
    else
        log "WARNING: No user data backup found"
    fi
    
    log "User data rollback completed"
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    # Start backend service
    sudo systemctl start fossawork-backend
    sleep 5
    
    if ! systemctl is-active --quiet fossawork-backend; then
        error_exit "Backend service failed to start after rollback"
    fi
    
    # Reload nginx
    sudo systemctl reload nginx
    
    if ! systemctl is-active --quiet nginx; then
        error_exit "Nginx failed to reload after rollback"
    fi
    
    log "Services restarted successfully"
}

# Verify rollback
verify_rollback() {
    log "Verifying rollback..."
    
    # Wait for application to be ready
    sleep 10
    
    # Check backend health
    local backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
    if [ "$backend_health" != "200" ]; then
        error_exit "Backend health check failed after rollback: HTTP $backend_health"
    fi
    
    # Check frontend accessibility
    local frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
    if [ "$frontend_health" != "200" ]; then
        error_exit "Frontend health check failed after rollback: HTTP $frontend_health"
    fi
    
    # Check database connectivity
    cd "$DEPLOY_PATH/current/backend"
    source venv/bin/activate
    python -c "
from app.database import engine
with engine.connect() as conn:
    result = conn.execute('SELECT COUNT(*) FROM work_orders')
    print(f'Rollback verification passed: {result.fetchone()[0]} work orders')
" || error_exit "Database connectivity check failed after rollback"
    
    log "Rollback verification completed successfully"
}

# Emergency rollback (fast rollback without full verification)
emergency_rollback() {
    local backup_dir=$1
    
    log "EMERGENCY ROLLBACK INITIATED"
    
    # Stop services immediately
    sudo systemctl stop fossawork-backend nginx
    
    # Quick application restore
    rm -rf "$DEPLOY_PATH/current"
    cp -r "$backup_dir/application" "$DEPLOY_PATH/current"
    
    # Quick database restore
    if [ -f "$backup_dir/database.db" ]; then
        cp "$backup_dir/database.db" "$DEPLOY_PATH/current/backend/fossawork_v2.db"
    fi
    
    # Set permissions quickly
    chown -R fossawork:fossawork "$DEPLOY_PATH/current"
    
    # Restart services
    sudo systemctl start fossawork-backend nginx
    
    log "EMERGENCY ROLLBACK COMPLETED"
}

# Interactive rollback selection
select_rollback_target() {
    echo "Available backups:"
    ls -la "$BACKUP_PATH" | grep "^d" | awk '{print $9}' | grep -v "^\.$\|^\.\.$" | sort -r | head -10
    
    echo ""
    read -p "Enter backup directory name (or 'last' for most recent): " backup_choice
    
    if [ "$backup_choice" = "last" ]; then
        get_last_backup
    else
        echo "$BACKUP_PATH/$backup_choice"
    fi
}

# Main rollback function
main() {
    log "Starting FossaWork V2 rollback procedure"
    
    local rollback_type=${1:-"standard"}
    local backup_dir
    
    case "$rollback_type" in
        "emergency")
            backup_dir=$(get_last_backup)
            emergency_rollback "$backup_dir"
            ;;
        "interactive")
            backup_dir=$(select_rollback_target)
            if [ ! -d "$backup_dir" ]; then
                error_exit "Backup directory not found: $backup_dir"
            fi
            rollback_application "$backup_dir"
            rollback_database "$backup_dir"
            rollback_user_data "$backup_dir"
            restart_services
            verify_rollback
            ;;
        "standard"|*)
            backup_dir=$(get_last_backup)
            if [ ! -d "$backup_dir" ]; then
                error_exit "Backup directory not found: $backup_dir"
            fi
            rollback_application "$backup_dir"
            rollback_database "$backup_dir" 
            rollback_user_data "$backup_dir"
            restart_services
            verify_rollback
            ;;
    esac
    
    log "Rollback completed successfully"
    log "Backup used: $backup_dir"
    
    # Send notification
    echo "FossaWork V2 has been rolled back to backup: $(basename $backup_dir)" | \
        mail -s "FossaWork V2 Rollback Completed" admin@fossawork.com 2>/dev/null || true
}

# Handle script arguments
case "${1:-standard}" in
    "emergency")
        main "emergency"
        ;;
    "interactive")
        main "interactive"
        ;;
    "standard")
        main "standard"
        ;;
    *)
        echo "Usage: $0 {standard|emergency|interactive}"
        echo "  standard    - Rollback to last backup with full verification"
        echo "  emergency   - Fast rollback with minimal checks"
        echo "  interactive - Choose backup interactively"
        exit 1
        ;;
esac
```

## Training Exercises

### Exercise 1: Local Development Setup
**Objective**: Set up complete local development environment
**Time**: 45 minutes

**Tasks**:
1. Install all prerequisites (Node.js, Python, Git)
2. Clone repository and set up project structure
3. Configure environment variables for development
4. Start frontend and backend services
5. Verify application is running correctly
6. Test hot reload functionality

**Deliverables**:
- Running development environment
- Documentation of any setup issues encountered
- Screenshot of application running locally

### Exercise 2: Production Deployment Simulation
**Objective**: Deploy application to staging environment
**Time**: 90 minutes

**Tasks**:
1. Set up staging server (VM or container)
2. Run production deployment script
3. Configure security hardening
4. Set up monitoring and health checks
5. Test application functionality
6. Document deployment process

**Deliverables**:
- Deployed staging environment
- Deployment checklist completed
- Health check verification report

### Exercise 3: Rollback Scenario
**Objective**: Practice rollback procedures
**Time**: 60 minutes

**Tasks**:
1. Create backup of current deployment
2. Deploy intentionally broken version
3. Detect deployment failure
4. Execute rollback procedure
5. Verify system recovery
6. Document lessons learned

**Deliverables**:
- Rollback execution report
- Time measurement for rollback process
- Improved rollback procedures (if needed)

## Assessment and Certification

### Deployment Competency Assessment
1. Can you explain the difference between deployment environments?
2. What are the key components of a deployment checklist?
3. How do you ensure zero-downtime deployment?
4. What security measures are essential for production deployment?
5. How do you monitor deployment health and performance?
6. What are the steps for a safe rollback procedure?
7. How do you handle database migrations in production?
8. What are the best practices for containerized deployments?

### Practical Assessment
- [ ] Successfully deploy application to staging environment
- [ ] Configure production security hardening
- [ ] Implement monitoring and alerting
- [ ] Execute rollback procedure
- [ ] Troubleshoot deployment issues
- [ ] Document deployment processes

### Certification Requirements
- [ ] Complete all training modules with 85% minimum score
- [ ] Successfully perform supervised deployment
- [ ] Demonstrate rollback capabilities
- [ ] Show proficiency in troubleshooting
- [ ] Create deployment documentation
- [ ] Pass security hardening verification

---

**Next Steps**:
1. Complete monitoring training
2. Practice with backup and recovery scenarios
3. Review troubleshooting procedures
4. Schedule deployment readiness assessment
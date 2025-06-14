from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import time
import asyncio
from .database import get_db, create_tables
from .models.user_models import User
from .core_models import WorkOrder, Dispenser
from .routes import auth, setup, users, work_orders, automation, logging, file_logging, url_generation, credentials, schedule_detection, form_automation, user_preferences, settings
# Temporarily disabled due to FastAPI validation errors: filter_calculation, filter_inventory, filter_scheduling, filter_cost, advanced_scheduling
from .services.logging_service import get_logger, log_api_request
from .utils.memory_monitor import setup_memory_monitoring, start_memory_monitoring
from .middleware.auth_middleware import AuthenticationMiddleware

# Initialize logger
logger = get_logger("fossawork.main")

# Create FastAPI app
app = FastAPI(
    title="FossaWork V2 API", 
    version="2.0.0",
    description="Modern Fuel Dispenser Automation System with Browser Automation and Real-time Logging"
)

# CORS for development (must be added BEFORE authentication middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication middleware (must be added AFTER CORS)
app.add_middleware(AuthenticationMiddleware)

# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests with timing and details"""
    start_time = time.time()
    
    # Log incoming request
    logger.info(f"[WEB] {request.method} {request.url.path} - Started")
    
    # Process request
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        
        # Log completed request
        log_api_request(
            method=request.method,
            path=str(request.url.path),
            status_code=response.status_code,
            duration_ms=process_time
        )
        
        # Add timing header
        response.headers["X-Process-Time"] = str(process_time)
        return response
        
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"[ERROR] {request.method} {request.url.path} - Error after {process_time:.2f}ms: {e}")
        raise

# Include route modules
app.include_router(auth.router)  # Authentication routes (no auth required)
app.include_router(setup.router)  # Setup routes (no auth required)
app.include_router(users.router)
app.include_router(work_orders.router)
app.include_router(automation.router)
app.include_router(credentials.router)
app.include_router(logging.router)
app.include_router(file_logging.router)
app.include_router(url_generation.router)
# app.include_router(migration.router)  # Migration route removed
app.include_router(schedule_detection.router)
app.include_router(form_automation.router)
app.include_router(user_preferences.router)
app.include_router(settings.router)
# Temporarily disabled routes due to FastAPI validation errors:
# app.include_router(filter_calculation.router, prefix="/api/filters", tags=["filters"])
# app.include_router(filter_inventory.router, prefix="/api/inventory", tags=["inventory"])
# app.include_router(filter_scheduling.router, prefix="/api/scheduling", tags=["scheduling"])
# app.include_router(filter_cost.router, prefix="/api/costs", tags=["costs"])
# app.include_router(advanced_scheduling.router, prefix="/api/calendar", tags=["calendar"])

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    logger.info("[START] FossaWork V2 API starting up...")
    create_tables()
    logger.info("[DATA] Database tables created/verified")
    
    # Setup memory monitoring
    setup_memory_monitoring(max_memory_mb=6144, check_interval=30)
    
    # Start memory monitoring in background
    asyncio.create_task(start_memory_monitoring())
    logger.info("[MEMORY] Memory monitoring started (6GB limit)")
    
    logger.info("[OK] FossaWork V2 API startup completed successfully")

@app.get("/")
async def root():
    logger.info("[HOME] Root endpoint accessed")
    return {
        "message": "FossaWork V2 API - Running",
        "version": "2.0.0",
        "status": "healthy",
        "features": ["real-time logging", "browser automation", "multi-user support"]
    }

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint with database connectivity test"""
    try:
        logger.info("[HEALTH] Health check requested")
        
        # Test database connection
        users_count = db.query(User).count()
        work_orders_count = db.query(WorkOrder).count()
        dispensers_count = db.query(Dispenser).count()
        
        result = {
            "status": "healthy",
            "database": "connected",
            "counts": {
                "users": users_count,
                "work_orders": work_orders_count,
                "dispensers": dispensers_count
            },
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"[OK] Health check passed - DB counts: {result['counts']}")
        return result
        
    except Exception as e:
        logger.error(f"[ERROR] Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

@app.get("/api/v1/status")
async def api_status():
    """API status endpoint"""
    logger.info("[DATA] API status requested")
    return {
        "api_version": "1.0",
        "service": "fossawork-v2",
        "features": ["real-time logging", "WebSocket support", "browser automation", "secure credential management"],
        "endpoints": {
            "health": "/health",
            "users": "/api/v1/users",
            "work_orders": "/api/v1/work-orders",
            "dispensers": "/api/v1/dispensers",
            "credentials": "/api/v1/credentials",
            "automation": "/api/v1/automation",
            "logs": "/api/v1/logs",
            "logs_stream": "/api/v1/logs/stream",
            "migration": "/api/migration",
            "schedule_detection": "/api/schedule",
            "form_automation": "/api/form-automation",
            "integrated_automation": "/api/form-automation/execute-full-automation",
            "notifications": "/api/notifications",
            "filter_calculation": "/api/filters",
            "filter_inventory": "/api/inventory",
            "filter_scheduling": "/api/scheduling",
            "filter_cost": "/api/costs",
            "advanced_scheduling": "/api/calendar"
        },
        "timestamp": datetime.now().isoformat()
    }


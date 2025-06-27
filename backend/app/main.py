from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import time
import asyncio
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

from .database import get_db, create_tables
from .models.user_models import User
from .core_models import WorkOrder, Dispenser
from .auth.dependencies import get_current_user
from .routes import auth, setup, users, work_orders, automation, logging, file_logging, url_generation, credentials, schedule_detection, form_automation, user_preferences, settings, metrics, notifications, scraping_schedules, filters, testing
# monitoring temporarily disabled for merge
# Temporarily disabled due to FastAPI validation errors: filter_calculation, filter_inventory, filter_scheduling, filter_cost, advanced_scheduling
from .services.logging_service import get_logger, log_api_request
from .utils.memory_monitor import setup_memory_monitoring, start_memory_monitoring
from .middleware.auth_middleware import AuthenticationMiddleware
from .middleware.request_id import RequestIDMiddleware, configure_request_id_logging
from .middleware.database_monitoring import db_monitoring
from .middleware.security_migration import SecurityMigrationMiddleware
from .services.metrics_service import metrics_service
# Temporarily disable complex managers for merge testing
# from .core.config_manager import ConfigManager
# from .core.migration_manager import MigrationManager

# Initialize logger first
logger = get_logger("fossawork.main")

# Try to import scheduler service, fall back to simple implementation
scheduler_service = None
scheduler_type = "none"

try:
    from .services.scheduler_service import scheduler_service
    logger.info("[SCHEDULER] ✓ Using full APScheduler-based scheduler service")
    scheduler_type = "full"
except ImportError as e:
    logger.warning(f"[SCHEDULER] APScheduler not available ({e.__class__.__name__}: {e})")
    try:
        from .services.simple_scheduler_service import simple_scheduler_service as scheduler_service
        logger.info("[SCHEDULER] ✓ Using simple scheduler service (database-only mode)")
        logger.warning("[SCHEDULER] ⚠️  Schedules will be stored but not automatically executed")
        scheduler_type = "simple"
    except ImportError as e2:
        logger.error(f"[SCHEDULER] ✗ Failed to import any scheduler service ({e2.__class__.__name__}: {e2})")
        scheduler_service = None
        scheduler_type = "none"

# Create FastAPI app
app = FastAPI(
    title="FossaWork V2 API", 
    version="2.0.0",
    description="Modern Fuel Dispenser Automation System with Browser Automation and Real-time Logging"
)

# Environment-based CORS configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Security feature flags
ENABLE_SECURITY_MIGRATION = os.getenv("ENABLE_SECURITY_MIGRATION", "true").lower() == "true"
BLOCK_LEGACY_AUTH = os.getenv("BLOCK_LEGACY_AUTH", "false").lower() == "true"
ENABLE_QUERY_PROFILING = os.getenv("ENABLE_QUERY_PROFILING", "false").lower() == "true"

logger.info(f"[SECURITY] Security features - Migration: {ENABLE_SECURITY_MIGRATION}, Block Legacy: {BLOCK_LEGACY_AUTH}, Query Profiling: {ENABLE_QUERY_PROFILING}")

# Define CORS settings based on environment
CORS_ORIGINS = {
    "development": ["http://localhost:3001", "http://localhost:5173", "http://localhost:5174"],
    "staging": [os.getenv("STAGING_FRONTEND_URL", "https://staging.fossawork.com")],
    "production": [os.getenv("PRODUCTION_FRONTEND_URL", "https://app.fossawork.com")]
}

# Get allowed origins for current environment
allowed_origins = CORS_ORIGINS.get(ENVIRONMENT, CORS_ORIGINS["development"])

# Add any additional origins from environment variable
additional_origins = os.getenv("ADDITIONAL_CORS_ORIGINS", "")
if additional_origins:
    allowed_origins.extend([origin.strip() for origin in additional_origins.split(",") if origin.strip()])

# Configure CORS with proper production settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Use specific origins when credentials=True
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["X-Process-Time", "X-Request-ID"],  # Headers exposed to frontend
    max_age=86400,  # Cache preflight requests for 24 hours
)

logger.info(f"[CORS] Environment: {ENVIRONMENT}, Allowed origins: {allowed_origins}")

# Global exception handler to ensure CORS headers are always included
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Global exception handler that ensures CORS headers are always included"""
    origin = request.headers.get("origin")
    
    # Add CORS headers based on allowed origins
    headers = {
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "X-Process-Time, X-Request-ID"
    }
    
    # Only add origin if it's in allowed list
    if origin in allowed_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    elif origin and ENVIRONMENT == "development":
        # In development, be more permissive but still specific
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    # Add any existing headers from the exception
    if hasattr(exc, 'headers') and exc.headers:
        headers.update(exc.headers)
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )

# Request ID middleware (must be first for proper tracking)
app.add_middleware(RequestIDMiddleware)

# Security headers middleware (early in chain for all responses)
from .middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# Security migration middleware (tracks legacy auth patterns)
if ENABLE_SECURITY_MIGRATION:
    logger.info(f"[SECURITY] Enabling security migration middleware (block_legacy={BLOCK_LEGACY_AUTH})")
    app.add_middleware(SecurityMigrationMiddleware, block_legacy=BLOCK_LEGACY_AUTH)

# Rate limiting middleware (before authentication for DDoS protection)
from .middleware.rate_limit import RateLimitMiddleware, limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
app.add_middleware(RateLimitMiddleware, limiter_instance=limiter)
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Authentication middleware (must be added AFTER CORS and rate limiting)
app.add_middleware(AuthenticationMiddleware)

# Add schedule debug middleware
from .middleware.schedule_debug import ScheduleDebugMiddleware
app.add_middleware(ScheduleDebugMiddleware)

# Logging middleware with metrics integration
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests with timing and metrics"""
    start_time = time.time()
    
    # Log incoming request
    logger.info(f"[WEB] {request.method} {request.url.path} - Started")
    
    # Process request
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        process_time = duration * 1000
        
        # Log completed request
        log_api_request(
            method=request.method,
            path=str(request.url.path),
            status_code=response.status_code,
            duration_ms=process_time
        )
        
        # Track metrics
        metrics_service.track_request(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
            duration=duration
        )
        
        # Add timing header
        response.headers["X-Process-Time"] = str(process_time)
        return response
        
    except Exception as e:
        duration = time.time() - start_time
        process_time = duration * 1000
        logger.error(f"[ERROR] {request.method} {request.url.path} - Error after {process_time:.2f}ms: {e}")
        
        # Track error metrics
        metrics_service.track_request(
            method=request.method,
            endpoint=request.url.path,
            status=500,
            duration=duration
        )
        metrics_service.track_error("http_request_error", "error")
        
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
app.include_router(metrics.router)
app.include_router(notifications.router)
app.include_router(scraping_schedules.router)
app.include_router(filters.router)
app.include_router(testing.router)
# app.include_router(monitoring.router)  # Temporarily disabled for merge
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
    
    # Configuration and migration managers temporarily disabled for merge testing
    logger.info("[CONFIG] Configuration and migration managers disabled for basic testing")
    
    # Configure request ID logging
    configure_request_id_logging()
    logger.info("[LOGGING] Request ID tracking configured")
    
    # Setup database monitoring
    from .database import engine
    db_monitoring.setup_monitoring(engine)
    logger.info("[DATABASE] Query monitoring configured")
    
    # Setup query profiling if enabled
    if ENABLE_QUERY_PROFILING:
        from .utils.query_profiler import QueryProfiler
        global_profiler = QueryProfiler(enabled=True)
        app.state.query_profiler = global_profiler
        logger.info("[DATABASE] Query profiling enabled - N+1 detection active")
    
    # Start metrics background tasks
    await metrics_service.start_background_tasks()
    logger.info("[METRICS] Prometheus metrics collection started")
    
    # Setup memory monitoring
    setup_memory_monitoring(max_memory_mb=6144, check_interval=30, warning_threshold=0.8)
    
    # Start memory monitoring in background
    asyncio.create_task(start_memory_monitoring())
    logger.info("[MEMORY] Memory monitoring started (6GB limit)")
    
    # Initialize scheduler service
    if scheduler_service:
        try:
            database_url = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")
            logger.info(f"[SCHEDULER] Initializing {scheduler_type} scheduler with database: {database_url}")
            await scheduler_service.initialize(database_url)
            
            # Log scheduler capabilities based on type
            if scheduler_type == "full":
                logger.info("[SCHEDULER] ✓ Full APScheduler service active - automated job execution enabled")
                logger.info("[SCHEDULER] ✓ Schedules will run automatically in the background")
            elif scheduler_type == "simple":
                logger.info("[SCHEDULER] ✓ Simple scheduler service active - manual execution only")
                logger.warning("[SCHEDULER] ⚠️  Schedules stored but require manual triggering (APScheduler not available)")
            
            # Test scheduler functionality
            if hasattr(scheduler_service, 'is_initialized'):
                logger.info(f"[SCHEDULER] Scheduler initialization status: {scheduler_service.is_initialized}")
            
        except Exception as e:
            logger.error(f"[SCHEDULER] ✗ Failed to initialize {scheduler_type} scheduler: {e}", exc_info=True)
            logger.warning("[SCHEDULER] ⚠️  Continuing without scheduler - schedules will be database-only")
    else:
        logger.error("[SCHEDULER] ✗ No scheduler service available - scheduling features disabled")
    
    logger.info("[OK] FossaWork V2 API startup completed successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("[SHUTDOWN] FossaWork V2 API shutting down...")
    
    # Stop metrics background tasks
    await metrics_service.stop_background_tasks()
    logger.info("[METRICS] Metrics collection stopped")
    
    # Shutdown scheduler service
    if scheduler_service:
        try:
            await scheduler_service.shutdown()
            logger.info("[SCHEDULER] Scheduler service stopped successfully")
        except Exception as e:
            logger.error(f"[SCHEDULER] Error during scheduler shutdown: {e}", exc_info=True)
    else:
        logger.debug("[SCHEDULER] No scheduler service to shutdown")
    
    logger.info("[SHUTDOWN] Cleanup completed")

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
            "advanced_scheduling": "/api/calendar",
            "security_status": "/api/v1/security/status",
            "security_migration_report": "/api/v1/security/migration-report",
            "security_query_profile": "/api/v1/security/query-profile"
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/security/migration-report")
async def security_migration_report(current_user: User = Depends(get_current_user)):
    """Get security migration report (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not ENABLE_SECURITY_MIGRATION:
        return {
            "enabled": False,
            "message": "Security migration tracking is disabled"
        }
    
    # Get middleware instance using the helper function
    from .middleware.security_migration import get_migration_middleware_instance
    migration_middleware = get_migration_middleware_instance()
    
    if migration_middleware:
        return {
            "enabled": True,
            "block_legacy": BLOCK_LEGACY_AUTH,
            "report": migration_middleware.get_migration_report()
        }
    
    return {
        "enabled": True,
        "error": "Security migration middleware not initialized yet",
        "hint": "The middleware will be available after first request"
    }

@app.get("/api/v1/security/query-profile")
async def query_profile_status(current_user: User = Depends(get_current_user)):
    """Get query profiling status and recent analysis (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not ENABLE_QUERY_PROFILING:
        return {
            "enabled": False,
            "message": "Query profiling is disabled"
        }
    
    # Get profiler from app state
    profiler = getattr(app.state, 'query_profiler', None)
    if not profiler:
        return {
            "enabled": True,
            "error": "Query profiler not initialized"
        }
    
    # Get current analysis
    analysis = profiler.analyze()
    
    return {
        "enabled": True,
        "analysis": analysis,
        "recommendations": _generate_query_recommendations(analysis)
    }

def _generate_query_recommendations(analysis):
    """Generate recommendations based on query analysis"""
    recommendations = []
    
    if analysis.get('n_plus_one_candidates'):
        recommendations.append({
            "severity": "high",
            "issue": "N+1 queries detected",
            "details": f"Found {len(analysis['n_plus_one_candidates'])} potential N+1 query patterns",
            "fix": "Use eager loading (joinedload/selectinload) or batch queries"
        })
    
    if analysis.get('slow_queries'):
        recommendations.append({
            "severity": "medium",
            "issue": "Slow queries detected",
            "details": f"Found {len(analysis['slow_queries'])} queries slower than 100ms",
            "fix": "Add indexes, optimize query structure, or cache results"
        })
    
    if analysis.get('duplicate_queries'):
        recommendations.append({
            "severity": "low",
            "issue": "Duplicate queries detected",
            "details": f"Found {len(analysis['duplicate_queries'])} duplicate queries",
            "fix": "Cache query results or refactor to avoid redundant database calls"
        })
    
    return recommendations

@app.get("/api/v1/security/status")
async def security_status():
    """Get overall security feature status (public endpoint for monitoring)"""
    return {
        "environment": ENVIRONMENT,
        "features": {
            "security_headers": {
                "enabled": True,
                "description": "OWASP security headers active"
            },
            "security_migration": {
                "enabled": ENABLE_SECURITY_MIGRATION,
                "block_legacy": BLOCK_LEGACY_AUTH,
                "description": "Tracking legacy authentication patterns"
            },
            "query_profiling": {
                "enabled": ENABLE_QUERY_PROFILING,
                "description": "N+1 query detection and performance monitoring"
            },
            "rate_limiting": {
                "enabled": True,
                "description": "API rate limiting active"
            },
            "authentication": {
                "enabled": True,
                "description": "JWT-based authentication required"
            }
        },
        "recommendations": _get_security_recommendations()
    }

def _get_security_recommendations():
    """Generate security recommendations based on current configuration"""
    recommendations = []
    
    if ENVIRONMENT == "production" and not BLOCK_LEGACY_AUTH:
        recommendations.append({
            "severity": "high",
            "message": "Legacy authentication patterns should be blocked in production",
            "action": "Set BLOCK_LEGACY_AUTH=true"
        })
    
    if ENVIRONMENT == "production" and ENABLE_QUERY_PROFILING:
        recommendations.append({
            "severity": "medium",
            "message": "Query profiling has performance overhead in production",
            "action": "Set ENABLE_QUERY_PROFILING=false for production"
        })
    
    if ENVIRONMENT != "development":
        recommendations.append({
            "severity": "info",
            "message": f"Running in {ENVIRONMENT} mode with appropriate security settings"
        })
    
    return recommendations



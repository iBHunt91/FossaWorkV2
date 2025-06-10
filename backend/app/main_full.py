#!/usr/bin/env python3
"""
FossaWork V2 - Full Production Server
Includes real browser automation with fallback to demo data
"""

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import json
import os
from typing import Dict, Any, List

# Import our models and services
from models_simple import Base, User, WorkOrder, Dispenser, UserCredentials
from services.workfossa_automation import workfossa_automation, WorkFossaCredentials

# Database setup
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Create database
DATABASE_URL = "sqlite:///./fossawork_v2.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# FastAPI app
app = FastAPI(
    title="FossaWork V2 API",
    version="2.0.0",
    description="Modern Fuel Dispenser Automation System with Real Browser Automation"
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check if we're in demo mode - use workfossa_automation service
from services.workfossa_automation import PLAYWRIGHT_AVAILABLE
DEMO_MODE = not PLAYWRIGHT_AVAILABLE

# Mock data (fallback)
MOCK_WORK_ORDERS = [
    {
        "id": "wo-001",
        "external_id": "WO-110157",
        "site_name": "Shell Station #1247",
        "address": "1501 Main Street, Springfield, IL 62701",
        "scheduled_date": "2025-01-08T10:00:00",
        "status": "pending",
        "created_at": "2025-01-07T12:00:00",
        "updated_at": "2025-01-07T12:00:00",
        "dispensers": [
            {
                "id": "disp-001",
                "dispenser_number": "1",
                "dispenser_type": "Wayne 300",
                "fuel_grades": {
                    "regular": {"octane": 87, "ethanol": 10, "position": 1},
                    "mid": {"octane": 89, "ethanol": 10, "position": 2},
                    "premium": {"octane": 91, "ethanol": 0, "position": 3}
                },
                "status": "ready_for_automation",
                "progress_percentage": 25.0,
                "automation_completed": False
            }
        ]
    }
]

# Include routes
from routes.credentials import router as credentials_router
from routes.user_preferences import router as user_preferences_router
app.include_router(credentials_router)
app.include_router(user_preferences_router)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await workfossa_automation.initialize_browser()
    print(f"FossaWork V2 Server Started")
    print(f"Demo Mode: {DEMO_MODE}")
    print(f"Browser Automation: {'Available' if not DEMO_MODE else 'Using Mock Data'}")
    print(f"Credential Management: Available")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await workfossa_automation.cleanup()

@app.get("/")
async def root():
    """Root endpoint with system status"""
    return {
        "message": "FossaWork V2 API",
        "version": "2.0.0",
        "status": "running",
        "demo_mode": DEMO_MODE,
        "browser_automation": not DEMO_MODE,
        "endpoints": {
            "health": "/health",
            "work_orders": "/api/v1/work-orders",
            "users": "/api/v1/users",
            "automation": "/api/v1/automation",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "FossaWork V2 API",
        "version": "2.0.0",
        "database": "connected",
        "browser_automation": not DEMO_MODE,
        "timestamp": datetime.now().isoformat(),
        "demo_mode": DEMO_MODE
    }

@app.get("/api/v1/work-orders")
async def get_work_orders(user_id: str = "demo-user", db: Session = Depends(get_db)):
    """Get work orders - real data if available, mock if not"""
    
    if DEMO_MODE:
        # Return mock data
        return MOCK_WORK_ORDERS
    
    # Try to get real data from database
    work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
    
    if not work_orders:
        # No real data yet, return mock data
        return MOCK_WORK_ORDERS
    
    # Convert database objects to dictionaries
    result = []
    for wo in work_orders:
        dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
        
        wo_data = {
            "id": wo.id,
            "external_id": wo.external_id,
            "site_name": wo.site_name,
            "address": wo.address,
            "scheduled_date": wo.scheduled_date.isoformat() if wo.scheduled_date else None,
            "status": wo.status,
            "created_at": wo.created_at.isoformat(),
            "updated_at": wo.updated_at.isoformat(),
            "dispensers": [
                {
                    "id": d.id,
                    "dispenser_number": d.dispenser_number,
                    "dispenser_type": d.dispenser_type,
                    "fuel_grades": d.fuel_grades,
                    "status": d.status,
                    "progress_percentage": d.progress_percentage,
                    "automation_completed": d.automation_completed
                }
                for d in dispensers
            ]
        }
        result.append(wo_data)
    
    return result

@app.post("/api/v1/work-orders/scrape")
async def trigger_scrape(
    user_id: str,
    background_tasks: BackgroundTasks,
    credentials: Dict[str, str] = None,
    db: Session = Depends(get_db)
):
    """Trigger work order scraping with real browser automation"""
    
    if DEMO_MODE:
        return {
            "status": "demo_mode",
            "message": "Demo mode - using mock data. Install Playwright for real automation.",
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get credentials - either from request or from saved credentials
    if not credentials:
        # Try to get saved credentials
        saved_creds = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa",
            UserCredentials.is_active == True
        ).first()
        
        if not saved_creds:
            raise HTTPException(status_code=400, detail="No WorkFossa credentials found. Please save credentials first.")
        
        # Import credential functions
        import base64
        def simple_decrypt(encrypted_password: str) -> str:
            try:
                return base64.b64decode(encrypted_password.encode()).decode()
            except:
                return ""
        
        credentials = {
            "username": saved_creds.username,
            "password": simple_decrypt(saved_creds.encrypted_password)
        }
    
    # Add real scraping task to background
    background_tasks.add_task(perform_real_scrape, user_id, credentials, db)
    
    return {
        "status": "scraping_started",
        "message": "Real browser automation initiated with saved credentials",
        "user_id": user_id,
        "username": credentials["username"],
        "timestamp": datetime.now().isoformat(),
        "automation_type": "playwright"
    }

async def perform_real_scrape(user_id: str, credentials: Dict[str, str], db: Session):
    """Background task for real WorkFossa scraping"""
    try:
        # Create WorkFossa credentials object
        workfossa_creds = WorkFossaCredentials(
            email=credentials["username"],
            password=credentials["password"],
            user_id=user_id
        )
        
        # Create browser session
        session_id = await workfossa_automation.create_automation_session(user_id, workfossa_creds)
        
        # Login to WorkFossa
        login_success = await workfossa_automation.login_to_workfossa(session_id)
        if not login_success:
            print(f"[ERROR] Login failed for user {user_id}")
            await workfossa_automation.close_session(session_id)
            return
        
        # Perform real work order scraping
        work_orders = await workfossa_automation.scrape_work_orders(session_id)
        
        # Store in database
        for wo_data in work_orders:
            # Create or update work order (wo_data is a dictionary)
            existing_wo = db.query(WorkOrder).filter(
                WorkOrder.external_id == wo_data["external_id"],
                WorkOrder.user_id == user_id
            ).first()
            
            if existing_wo:
                # Update existing
                existing_wo.status = wo_data["status"]
                existing_wo.updated_at = datetime.now()
            else:
                # Parse scheduled date if present
                scheduled_date = None
                if wo_data.get("scheduled_date"):
                    try:
                        # Handle various date formats
                        date_str = wo_data["scheduled_date"]
                        if 'T' in date_str:
                            scheduled_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        else:
                            scheduled_date = datetime.strptime(date_str, "%Y-%m-%d")
                    except:
                        pass  # Skip invalid dates
                
                # Create new work order
                work_order = WorkOrder(
                    id=wo_data["id"],
                    user_id=user_id,
                    external_id=wo_data["external_id"],
                    site_name=wo_data["site_name"],
                    address=wo_data["address"],
                    scheduled_date=scheduled_date,
                    status=wo_data["status"]
                )
                db.add(work_order)
                db.flush()
                
                # Create mock dispensers for work orders (since WorkFossa may not have dispenser data)
                # This creates a basic dispenser entry so the frontend has something to display
                dispenser = Dispenser(
                    work_order_id=work_order.id,
                    dispenser_number="1",
                    dispenser_type="Standard",
                    fuel_grades={"regular": {"octane": 87}, "premium": {"octane": 91}},
                    status="pending",
                    progress_percentage=0.0,
                    automation_completed=False
                )
                db.add(dispenser)
        
        db.commit()
        print(f"[OK] Scraping completed for user {user_id}: {len(work_orders)} work orders")
        
        # Close browser session
        await workfossa_automation.close_session(session_id)
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Scraping failed for user {user_id}: {e}")
        
        # Close session on error
        if 'session_id' in locals():
            await workfossa_automation.close_session(session_id)

@app.get("/api/v1/automation/status")
async def automation_status():
    """Get automation system status"""
    return {
        "playwright_available": PLAYWRIGHT_AVAILABLE,
        "demo_mode": DEMO_MODE,
        "active_sessions": len(workfossa_automation.sessions),
        "capabilities": {
            "browser_automation": not DEMO_MODE,
            "workfossa_login": not DEMO_MODE,
            "form_filling": not DEMO_MODE,
            "real_time_scraping": not DEMO_MODE
        }
    }

@app.post("/api/v1/users/login")
async def login_user(credentials: Dict[str, str], db: Session = Depends(get_db)):
    """User login with real authentication"""
    username = credentials.get("username")
    password = credentials.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    # Find user
    user = db.query(User).filter(User.username == username).first()
    
    if DEMO_MODE:
        # Demo mode - accept any credentials
        return {
            "status": "success",
            "message": "Demo login successful",
            "user": {
                "id": "demo-user",
                "username": username,
                "email": f"{username}@fossawork.com"
            },
            "demo_mode": True,
            "timestamp": datetime.now().isoformat()
        }
    
    if not user or not user.verify_password(password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "status": "success",
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        },
        "demo_mode": False,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting FossaWork V2 Full Server...")
    print("Server will be available at: http://localhost:8001")
    print("API Documentation at: http://localhost:8001/docs")
    print("Browser automation will be used if Playwright is available")
    print("Press Ctrl+C to stop the server")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)
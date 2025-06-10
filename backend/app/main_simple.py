#!/usr/bin/env python3
"""
Simplified FastAPI app for quick demo
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import json

app = FastAPI(
    title="FossaWork V2 API - Demo",
    version="2.0.0",
    description="Modern Fuel Dispenser Automation System - Quick Demo"
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load real work orders from exported data
import json
import os

def load_real_work_orders():
    """Load real work orders from the exported JSON file and enhance with URLs"""
    try:
        # Path to the real exported data
        export_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'exports', 'work_orders_export_20250607_163409.json')
        
        if os.path.exists(export_file):
            with open(export_file, 'r') as f:
                data = json.load(f)
                work_orders = data.get('work_orders', [])
                
                if work_orders:
                    # Import URL enhancement here to avoid circular imports
                    try:
                        from .services.url_generator import enhance_work_orders_with_urls
                        enhanced_orders = enhance_work_orders_with_urls(work_orders)
                        print(f"[OK] Loaded and enhanced {len(enhanced_orders)} work orders with visit URLs")
                        return enhanced_orders
                    except ImportError as e:
                        print(f"Warning: Could not enhance with URLs: {e}")
                        return work_orders
                
        # Fallback to empty array if file not found
        return []
    except Exception as e:
        print(f"Warning: Could not load real work orders: {e}")
        return []

# Load real work orders data
REAL_WORK_ORDERS = load_real_work_orders()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "FossaWork V2 API - Real Data Mode",
        "version": "2.0.0", 
        "status": "running",
        "data_source": "exported_work_orders",
        "total_work_orders": len(REAL_WORK_ORDERS),
        "endpoints": {
            "health": "/health",
            "work_orders": "/api/v1/work-orders",
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
        "database": "exported_json_data",
        "work_orders_loaded": len(REAL_WORK_ORDERS),
        "timestamp": datetime.now().isoformat(),
        "real_data_mode": True
    }

@app.get("/api/v1/work-orders")
async def get_work_orders(user_id: str = "demo-user"):
    """Get real work orders from exported data"""
    return REAL_WORK_ORDERS

@app.get("/api/v1/work-orders/{work_order_id}")
async def get_work_order(work_order_id: str, user_id: str = "demo-user"):
    """Get specific work order"""
    for wo in REAL_WORK_ORDERS:
        if wo.get("basic_info", {}).get("id") == work_order_id:
            return wo
    return {"error": "Work order not found"}

@app.post("/api/v1/work-orders/scrape")
async def trigger_scrape(user_id: str = "demo-user"):
    """Trigger scraping (demo)"""
    return {
        "status": "scraping_started",
        "message": "Demo scraping initiated - using mock data",
        "user_id": user_id,
        "timestamp": datetime.now().isoformat(),
        "demo_mode": True
    }

@app.patch("/api/v1/work-orders/{work_order_id}/status")
async def update_work_order_status(work_order_id: str, status_data: dict, user_id: str = "demo-user"):
    """Update work order status (demo)"""
    return {
        "status": "success",
        "work_order_id": work_order_id,
        "new_status": status_data.get("status", "pending"),
        "updated_at": datetime.now().isoformat(),
        "demo_mode": True
    }

@app.get("/api/v1/users")
async def list_users():
    """List users (demo)"""
    return [
        {
            "id": "demo-user",
            "username": "demo",
            "email": "demo@fossawork.com",
            "is_active": True,
            "created_at": "2025-01-07T12:00:00"
        }
    ]

@app.post("/api/v1/users/login")
async def login_user(credentials: dict):
    """User login (demo)"""
    return {
        "status": "success",
        "message": "Demo login successful",
        "user": {
            "id": "demo-user",
            "username": credentials.get("username", "demo"),
            "email": "demo@fossawork.com"
        },
        "login_time": datetime.now().isoformat(),
        "demo_mode": True
    }

@app.get("/api/v1/users/{user_id}/preferences")
async def get_user_preferences(user_id: str):
    """Get user preferences (demo)"""
    return {
        "user_id": user_id,
        "preferences": {
            "email_notifications": True,
            "pushover_enabled": False,
            "theme": "light",
            "default_view": "dashboard"
        },
        "demo_mode": True
    }

@app.get("/api/v1/credentials/workfossa")
async def get_workfossa_credentials(user_id: str = "demo-user"):
    """Get WorkFossa credentials (demo)"""
    return {
        "status": "success",
        "has_credentials": True,
        "username": "demo_user",
        "last_verified": datetime.now().isoformat(),
        "demo_mode": True
    }

@app.post("/api/v1/logs/write")
async def write_log_entry(log_data: dict):
    """Write a log entry from the frontend (demo)"""
    print(f"[FRONTEND LOG] {log_data.get('level', 'info').upper()}: {log_data.get('message', '')}")
    return {
        "status": "success",
        "message": "Log entry written (demo mode)",
        "timestamp": datetime.now().isoformat(),
        "demo_mode": True
    }

if __name__ == "__main__":
    import uvicorn
    print("[START] Starting FossaWork V2 Backend Demo...")
    print("[NETWORK] Server will be available at: http://localhost:8000")
    print("📚 API Documentation at: http://localhost:8000/docs")
    print("[ERROR] Press Ctrl+C to stop the server")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
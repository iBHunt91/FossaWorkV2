#!/usr/bin/env python3
"""
Test that the Scrape button fix works - no browser window should open
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
import requests
from app.database import SessionLocal
from app.models import WorkOrder, User

def test_scrape_button():
    """Test the scrape dispenser endpoint"""
    
    print("🧪 Testing Scrape Button Fix")
    print("=" * 80)
    
    # Get a work order with customer URL
    db = SessionLocal()
    work_order = db.query(WorkOrder).filter(
        WorkOrder.customer_url.isnot(None)
    ).first()
    
    if not work_order:
        print("❌ No work orders with customer URL found")
        db.close()
        return
    
    # Get the user
    user = db.query(User).filter(User.id == work_order.user_id).first()
    if not user:
        print("❌ User not found for work order")
        db.close()
        return
    
    print(f"✅ Found work order: {work_order.external_id}")
    print(f"📍 Customer URL: {work_order.customer_url}")
    print(f"👤 User: {user.email}")
    
    # Make API request to scrape dispensers
    api_url = f"http://localhost:8000/api/v1/work-orders/{work_order.id}/scrape-dispensers"
    params = {
        "user_id": user.id
    }
    
    # You would need a valid JWT token here
    # For testing, we'll just show what the request would look like
    print(f"\n📡 API Request:")
    print(f"   URL: {api_url}")
    print(f"   Params: {params}")
    print(f"   Headers: Authorization: Bearer <JWT_TOKEN>")
    
    print("\n⚠️  To fully test:")
    print("1. Start the backend server: cd backend && uvicorn app.main:app --reload")
    print("2. Login through the frontend to get a JWT token")
    print("3. Click the Scrape button on a work order card")
    print("4. Watch the console - NO browser window should appear")
    print("5. Check the backend logs for headless mode confirmation")
    
    db.close()

if __name__ == "__main__":
    test_scrape_button()
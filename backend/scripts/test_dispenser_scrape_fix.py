#!/usr/bin/env python3
"""
Test the dispenser scraping fix - browser should navigate properly now
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.routes.work_orders import perform_dispenser_scrape
from app.database import SessionLocal
from app.models import WorkOrder, User

async def test_dispenser_scrape():
    """Test the fixed dispenser scraping"""
    
    print("🧪 Testing Fixed Dispenser Scraping")
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
    
    user = db.query(User).filter(User.id == work_order.user_id).first()
    if not user:
        print("❌ User not found")
        db.close()
        return
    
    print(f"✅ Found work order: {work_order.external_id}")
    print(f"📍 Customer URL: {work_order.customer_url}")
    print(f"👤 User: {user.email}")
    
    # Test credentials - will fail but we want to see navigation
    credentials = {
        "username": "test@example.com",
        "password": "test123"
    }
    
    print("\n🚀 Starting dispenser scrape...")
    print("🖥️ You should see the browser:")
    print("   1. Navigate to WorkFossa login page")
    print("   2. Fill in credentials")
    print("   3. Attempt login (will fail with test credentials)")
    print("   4. Browser should close after error")
    
    try:
        await perform_dispenser_scrape(
            work_order_id=work_order.id,
            user_id=user.id,
            credentials=credentials,
            customer_url=work_order.customer_url
        )
    except Exception as e:
        print(f"\n⚠️  Expected error with test credentials: {e}")
    
    db.close()
    print("\n✅ Test complete - if browser navigated to WorkFossa, the fix is working!")

if __name__ == "__main__":
    asyncio.run(test_dispenser_scrape())
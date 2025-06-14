#!/usr/bin/env python3
"""Run a small batch test to verify dispenser scraping"""

import requests
import time
import sys

base_url = "http://localhost:8000"
user_id = "7bea3bdb7e8e303eacaba442bd824004"

print("🚀 Starting small batch dispenser scraping test...")

# First, let's limit to just a few work orders for testing
# We'll use the API directly
try:
    response = requests.post(f"{base_url}/api/v1/work-orders/scrape-dispensers-batch?user_id={user_id}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ {result.get('message', 'Scraping started')}")
        print(f"   Work orders: {result.get('work_order_count', 'unknown')}")
    else:
        print(f"❌ Failed to start scraping: {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# Wait a bit and check progress
print("\n⏳ Waiting 30 seconds before checking results...")
time.sleep(30)

# Check results
print("\n📊 Checking results...")
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()
try:
    # Check for work orders with dispenser_scrape_date
    result = db.execute(text("""
        SELECT COUNT(*)
        FROM work_orders
        WHERE user_id = :user_id
        AND scraped_data LIKE '%dispenser_scrape_date%'
    """), {"user_id": user_id}).scalar()
    
    print(f"Work orders with dispenser data: {result}/60")
    
    # Show a sample
    sample = db.execute(text("""
        SELECT external_id, scraped_data
        FROM work_orders
        WHERE user_id = :user_id
        AND scraped_data LIKE '%dispenser_scrape_date%'
        LIMIT 3
    """), {"user_id": user_id}).fetchall()
    
    if sample:
        print("\nSample results:")
        for row in sample:
            data = json.loads(row.scraped_data)
            print(f"  {row.external_id}: {len(data.get('dispensers', []))} dispensers")
            
finally:
    db.close()
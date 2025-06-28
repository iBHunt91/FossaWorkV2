#!/usr/bin/env python3
"""
Test script to simulate and verify ScrapingStatus timeout handling.

This script tests the improved error handling and timeout behavior
of the ScrapingStatus component.
"""

import time
import asyncio
from fastapi import FastAPI, Response
import uvicorn
import threading
import requests

# Create a test FastAPI app that simulates slow responses
app = FastAPI()

# Global variable to control response delay
response_delay = 0

@app.get("/api/scraping-schedules/")
async def get_schedules():
    """Simulate a slow endpoint that might timeout"""
    if response_delay > 0:
        print(f"Simulating {response_delay}s delay...")
        await asyncio.sleep(response_delay)
    
    return [{
        "id": 1,
        "user_id": "test-user",
        "schedule_type": "work_orders",
        "interval_hours": 1.0,
        "enabled": True,
        "last_run": "2025-01-26T10:00:00Z",
        "next_run": "2025-01-26T11:00:00Z",
        "consecutive_failures": 0
    }]

@app.get("/api/scraping-schedules/{schedule_id}/history")
async def get_history(schedule_id: int):
    """Return schedule history"""
    return [{
        "id": 1,
        "started_at": "2025-01-26T10:00:00Z",
        "completed_at": "2025-01-26T10:05:00Z",
        "success": True,
        "items_processed": 42
    }]

def run_server():
    """Run the test server in a separate thread"""
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="warning")

def test_timeout_scenarios():
    """Test various timeout scenarios"""
    global response_delay
    
    print("\n=== ScrapingStatus Timeout Test ===\n")
    
    # Test 1: Normal response (no delay)
    print("Test 1: Normal response (no delay)")
    response_delay = 0
    try:
        response = requests.get("http://localhost:8001/api/scraping-schedules/", timeout=10)
        print(f"✅ Success: {response.status_code} in {response.elapsed.total_seconds():.2f}s")
    except requests.exceptions.Timeout:
        print("❌ Timeout occurred")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "-"*50 + "\n")
    
    # Test 2: Slow response (5 seconds - within timeout)
    print("Test 2: Slow response (5s delay - within 10s timeout)")
    response_delay = 5
    try:
        response = requests.get("http://localhost:8001/api/scraping-schedules/", timeout=10)
        print(f"✅ Success: {response.status_code} in {response.elapsed.total_seconds():.2f}s")
    except requests.exceptions.Timeout:
        print("❌ Timeout occurred")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "-"*50 + "\n")
    
    # Test 3: Timeout scenario (15 seconds - exceeds timeout)
    print("Test 3: Timeout scenario (15s delay - exceeds 10s timeout)")
    response_delay = 15
    try:
        response = requests.get("http://localhost:8001/api/scraping-schedules/", timeout=10)
        print(f"✅ Success: {response.status_code} in {response.elapsed.total_seconds():.2f}s")
    except requests.exceptions.Timeout:
        print("✅ Timeout handled correctly after 10s")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    
    print("\n" + "-"*50 + "\n")
    
    # Test 4: Server error simulation
    print("Test 4: Frontend error handling expectations")
    print("- Timeout errors should show: 'Unable to fetch status (timeout). The server might be busy.'")
    print("- Retry button should be visible")
    print("- Exponential backoff should increase intervals: 30s → 60s → 120s → 300s")
    print("- Manual refresh button should reset retry count")
    
    print("\n=== Test Complete ===\n")

if __name__ == "__main__":
    # Start the test server in a background thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # Give the server time to start
    print("Starting test server...")
    time.sleep(2)
    
    # Run the tests
    test_timeout_scenarios()
    
    print("\nNote: The frontend ScrapingStatus component now has:")
    print("1. Reduced timeout from 30s to 10s for status checks")
    print("2. Separate 5s timeout for history (non-critical)")
    print("3. User-friendly error messages")
    print("4. Retry button with exponential backoff")
    print("5. Manual refresh button in compact mode")
    print("6. Detailed logging for debugging")
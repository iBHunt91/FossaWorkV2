#!/usr/bin/env python3
"""Test which scheduler type the app is using"""

import os
import sys
from pathlib import Path

# Set required env vars
os.environ['SECRET_KEY'] = 'test-secret-key'

sys.path.append(str(Path(__file__).parent.parent))

print("Testing FastAPI app scheduler type...")
print("-" * 60)

# Test the import pattern used in main.py
scheduler_service = None
try:
    from app.services.scheduler_service import scheduler_service
    print("✅ Using full APScheduler-based scheduler service")
    print(f"   - Type: {type(scheduler_service)}")
    print(f"   - Has scheduler: {hasattr(scheduler_service, 'scheduler')}")
    print(f"   - Scheduler value: {scheduler_service.scheduler}")
except ImportError as e:
    print(f"❌ APScheduler not available: {e}")
    try:
        from app.services.simple_scheduler_service import simple_scheduler_service as scheduler_service
        print("✅ Using simple scheduler service (database-only)")
        print(f"   - Type: {type(scheduler_service)}")
    except ImportError as e2:
        print(f"❌ Failed to import any scheduler service: {e2}")
        scheduler_service = None

print("\n" + "-" * 60)
print("Result:")
if scheduler_service:
    print(f"App would use: {type(scheduler_service).__name__}")
    if hasattr(scheduler_service, 'scheduler'):
        print("This is the FULL scheduler with automatic job execution")
    else:
        print("This is the SIMPLE scheduler (database-only, no automatic execution)")
else:
    print("No scheduler available")
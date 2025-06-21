#!/usr/bin/env python3
"""Debug why scheduler service import is failing"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

print("Testing scheduler service import...")
print("-" * 60)

try:
    print("1. Importing APScheduler...")
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    print("   ✅ APScheduler imported successfully")
except Exception as e:
    print(f"   ❌ Failed to import APScheduler: {e}")
    sys.exit(1)

try:
    print("\n2. Importing scheduler_service module...")
    from app.services import scheduler_service
    print("   ✅ Module imported successfully")
except Exception as e:
    print(f"   ❌ Failed to import module: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("\n3. Accessing scheduler_service object...")
    from app.services.scheduler_service import scheduler_service
    print("   ✅ scheduler_service object accessed")
    print(f"   - Type: {type(scheduler_service)}")
    print(f"   - Has scheduler attr: {hasattr(scheduler_service, 'scheduler')}")
    print(f"   - Scheduler value: {scheduler_service.scheduler}")
    print(f"   - Is initialized: {scheduler_service.is_initialized}")
except Exception as e:
    print(f"   ❌ Failed to access scheduler_service: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "-" * 60)
print("Import test complete")
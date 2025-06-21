#!/usr/bin/env python3
"""
Check scheduler initialization and diagnose issues
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

print("🔍 Checking Scheduler Initialization")
print("=" * 50)

# Check if APScheduler is available
try:
    import apscheduler
    print("✅ APScheduler is installed")
    print(f"   Version: {apscheduler.__version__}")
except ImportError as e:
    print("❌ APScheduler is NOT installed")
    print(f"   Error: {e}")
    print("\n   Run: pip install apscheduler")

# Check scheduler service initialization
print("\n📋 Checking scheduler service...")
try:
    from app.services.scheduler_service import SchedulerService
    print("✅ SchedulerService can be imported")
    
    # Try to create an instance
    try:
        scheduler = SchedulerService()
        print("✅ SchedulerService instance created")
        print(f"   Is initialized: {scheduler.is_initialized}")
        print(f"   Scheduler state: {scheduler.scheduler.state if scheduler.scheduler else 'No scheduler'}")
    except Exception as e:
        print(f"❌ Failed to create SchedulerService: {e}")
        
except ImportError as e:
    print(f"❌ Cannot import SchedulerService: {e}")
    print("\n   Checking fallback services...")
    
    try:
        from app.services.simple_scheduler_service import SimpleSchedulerService
        print("✅ SimpleSchedulerService is available (fallback)")
    except ImportError:
        print("❌ SimpleSchedulerService not available")

# Check what's actually being used in main.py
print("\n🔍 Checking main.py scheduler initialization...")
try:
    with open(backend_dir / "app" / "main.py", "r") as f:
        content = f.read()
        
    if "SchedulerService" in content:
        print("✅ SchedulerService is referenced in main.py")
        
        # Check for try/except blocks
        if "try:" in content and "scheduler_service" in content:
            print("⚠️  main.py has fallback logic for scheduler")
            
            # Extract the relevant section
            import re
            scheduler_section = re.search(r'# Initialize scheduler.*?(?=\n# |\nif __name__|$)', content, re.DOTALL)
            if scheduler_section:
                print("\n📄 Scheduler initialization code:")
                print("-" * 40)
                lines = scheduler_section.group(0).split('\n')
                for i, line in enumerate(lines[:20]):  # First 20 lines
                    print(f"   {line}")
                if len(lines) > 20:
                    print("   ...")
    else:
        print("❌ No SchedulerService reference found in main.py")
        
except Exception as e:
    print(f"❌ Error checking main.py: {e}")

# Check the actual scheduler being used
print("\n🔍 Checking active scheduler service...")
try:
    from app.main import scheduler_service
    print(f"✅ Active scheduler service: {type(scheduler_service).__name__}")
    print(f"   Is initialized: {getattr(scheduler_service, 'is_initialized', 'N/A')}")
    if hasattr(scheduler_service, 'scheduler'):
        print(f"   Has APScheduler: {'Yes' if scheduler_service.scheduler else 'No'}")
except Exception as e:
    print(f"❌ Cannot import active scheduler: {e}")

print("\n💡 Diagnosis Complete")
#!/usr/bin/env python3
"""
Fix scheduler initialization issue
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

print("🔧 Fixing Scheduler Initialization")
print("=" * 50)

# Check the imports in scheduler_service.py
scheduler_file = backend_dir / "app" / "services" / "scheduler_service.py"
print(f"\n📄 Checking {scheduler_file.name}...")

with open(scheduler_file, 'r') as f:
    content = f.read()

# Check for the singleton instance creation
if "scheduler_service = SchedulerService()" not in content:
    print("❌ Missing singleton instance creation")
    print("✅ Adding singleton instance...")
    
    # Add the singleton instance at the end of the file
    if not content.endswith('\n'):
        content += '\n'
    content += "\n# Create singleton instance\nscheduler_service = SchedulerService()\n"
    
    with open(scheduler_file, 'w') as f:
        f.write(content)
    
    print("✅ Fixed! Singleton instance added")
else:
    print("✅ Singleton instance already exists")

# Check simple_scheduler_service.py
simple_file = backend_dir / "app" / "services" / "simple_scheduler_service.py"
if simple_file.exists():
    print(f"\n📄 Checking {simple_file.name}...")
    
    with open(simple_file, 'r') as f:
        simple_content = f.read()
    
    if "simple_scheduler_service = SimpleSchedulerService()" not in simple_content:
        print("❌ Missing singleton instance creation")
        print("✅ Adding singleton instance...")
        
        if not simple_content.endswith('\n'):
            simple_content += '\n'
        simple_content += "\n# Create singleton instance\nsimple_scheduler_service = SimpleSchedulerService()\n"
        
        with open(simple_file, 'w') as f:
            f.write(simple_content)
        
        print("✅ Fixed! Singleton instance added")
    else:
        print("✅ Singleton instance already exists")

print("\n🎯 Verification Test...")
try:
    from app.services.scheduler_service import scheduler_service
    print("✅ SchedulerService singleton can be imported")
    print(f"   Type: {type(scheduler_service).__name__}")
    print(f"   Initialized: {scheduler_service.is_initialized}")
except Exception as e:
    print(f"❌ Import failed: {e}")

print("\n✅ Scheduler initialization fix complete!")
print("\n📌 Next steps:")
print("   1. Restart the backend server")
print("   2. The scheduler should now initialize properly")
print("   3. Your existing schedule will be loaded from the database")
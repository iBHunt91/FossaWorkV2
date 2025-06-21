#!/usr/bin/env python3
"""
Fix all service instantiation issues in route files
"""

import os
import re
from pathlib import Path

def fix_file(filepath):
    """Fix service instantiation in a single file"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix UserManagementService instantiation
    content = re.sub(
        r'UserManagementService\(db\)',
        'UserManagementService()',
        content
    )
    
    # Fix LoggingService instantiation
    content = re.sub(
        r'LoggingService\(db\)',
        'LoggingService()',
        content
    )
    
    # Check if file was modified
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    """Fix all route files"""
    
    print("🔧 Fixing Service Instantiation Issues")
    print("=" * 50)
    
    routes_dir = Path("app/routes")
    fixed_count = 0
    
    for py_file in routes_dir.glob("*.py"):
        if py_file.name == "__init__.py":
            continue
            
        if fix_file(py_file):
            print(f"✅ Fixed: {py_file.name}")
            fixed_count += 1
        else:
            print(f"⏭️  No changes needed: {py_file.name}")
    
    print(f"\n📊 Summary: Fixed {fixed_count} files")
    
    # Also check for any remaining issues
    print("\n🔍 Checking for remaining issues...")
    
    issues = []
    for py_file in routes_dir.glob("*.py"):
        with open(py_file, 'r') as f:
            content = f.read()
            
        if 'UserManagementService(db)' in content:
            issues.append(f"{py_file.name}: Still has UserManagementService(db)")
        if 'LoggingService(db)' in content:
            issues.append(f"{py_file.name}: Still has LoggingService(db)")
    
    if issues:
        print("\n⚠️  Remaining issues found:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("\n✅ All service instantiation issues have been fixed!")
        print("\n⚠️  IMPORTANT: You must restart the backend server for changes to take effect!")
        print("\nTo restart the backend:")
        print("1. Stop the current server (Ctrl+C in the terminal running uvicorn)")
        print("2. Start it again with:")
        print("   cd backend")
        print("   source venv/bin/activate  # or venv\\Scripts\\activate on Windows")
        print("   uvicorn app.main:app --reload --port 8000")

if __name__ == "__main__":
    main()
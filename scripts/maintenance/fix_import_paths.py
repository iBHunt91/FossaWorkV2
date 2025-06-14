#!/usr/bin/env python3
"""
Fix import paths in moved test and script files
"""
import os
import re
from pathlib import Path

def fix_import_paths(file_path):
    """Fix import paths in a single file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix hardcoded paths
    content = re.sub(
        r"sys\.path\.insert\(0, ['\"]?/Users/[^'\"]+/FossaWorkV2/backend['\"]?\)",
        "sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))",
        content
    )
    
    # Fix relative parent imports
    content = re.sub(
        r"sys\.path\.insert\(0, str\(Path\(__file__\)\.parent\)\)",
        "sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))",
        content
    )
    
    # Add proper Path import if sys.path.insert is used but Path not imported
    if "sys.path.insert" in content and "from pathlib import Path" not in content:
        # Add after other imports
        lines = content.split('\n')
        import_added = False
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('from '):
                # Find last import
                continue
            elif i > 0 and not import_added:
                # Insert after imports
                lines.insert(i, 'from pathlib import Path')
                import_added = True
                break
        content = '\n'.join(lines)
    
    # Fix file paths in the code
    content = re.sub(
        r'["\']?/Users/[^"\']+/FossaWorkV2/backend/data/',
        'str(Path(__file__).resolve().parent.parent.parent / "backend" / "data") + "/',
        content
    )
    
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"✅ Fixed imports in: {file_path}")
    else:
        print(f"✓ No changes needed: {file_path}")

def main():
    """Fix imports in all moved files"""
    base_path = Path(__file__).resolve().parent.parent.parent
    
    # Directories to check
    dirs_to_check = [
        base_path / "tests" / "backend",
        base_path / "tests" / "integration", 
        base_path / "tests" / "manual",
        base_path / "scripts" / "debugging",
        base_path / "scripts" / "testing",
        base_path / "scripts" / "data",
        base_path / "scripts" / "maintenance"
    ]
    
    for dir_path in dirs_to_check:
        if not dir_path.exists():
            continue
            
        print(f"\n📁 Checking {dir_path.relative_to(base_path)}...")
        
        for py_file in dir_path.glob("*.py"):
            if py_file.name != "fix_import_paths.py":
                fix_import_paths(py_file)

if __name__ == "__main__":
    main()
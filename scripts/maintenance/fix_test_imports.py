#!/usr/bin/env python3
"""Fix imports in test files after moving them to tests/backend directory"""

import re
from pathlib import Path

def fix_test_imports(test_file: Path):
    """Fix the sys.path imports in a test file"""
    content = test_file.read_text()
    
    # Pattern to find the sys.path.insert line
    pattern = r'sys\.path\.insert\(0,\s*str\(Path\(__file__\)\.parent\)\)'
    
    # Calculate the relative path from test file to backend directory
    # From tests/backend/subdir/file.py we need to go up to project root then down to backend
    depth = len(test_file.relative_to(Path(__file__).parent.parent.parent / "tests/backend").parts)
    parent_chain = ".parent" * (depth + 2)  # +2 for tests/backend
    
    replacement = f'# Add backend directory to path\nbackend_path = Path(__file__){parent_chain} / "backend"\nsys.path.insert(0, str(backend_path))'
    
    # Check if the pattern exists
    if re.search(pattern, content):
        # Replace the pattern
        new_content = re.sub(
            r'sys\.path\.insert\(0,\s*str\(Path\(__file__\)\.parent\)\)',
            'sys.path.insert(0, str(backend_path))',
            content
        )
        
        # Add the backend_path definition before the sys.path.insert
        new_content = re.sub(
            r'(from pathlib import Path\n)(.*?)(sys\.path\.insert)',
            rf'\1{replacement.split("sys.path.insert")[0]}\2\3',
            new_content,
            flags=re.DOTALL
        )
        
        test_file.write_text(new_content)
        print(f"✅ Fixed imports in {test_file}")
        return True
    else:
        print(f"⏭️  No imports to fix in {test_file}")
        return False

def main():
    """Fix imports in all test files"""
    tests_dir = Path(__file__).parent.parent.parent / "tests/backend"
    
    if not tests_dir.exists():
        print(f"❌ Tests directory not found: {tests_dir}")
        return
    
    fixed_count = 0
    total_count = 0
    
    for test_file in tests_dir.rglob("test_*.py"):
        if test_file.is_file():
            total_count += 1
            if fix_test_imports(test_file):
                fixed_count += 1
    
    print(f"\n📊 Summary: Fixed {fixed_count} out of {total_count} test files")

if __name__ == "__main__":
    main()
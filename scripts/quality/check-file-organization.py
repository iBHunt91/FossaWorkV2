#!/usr/bin/env python3
"""
Check that files are organized according to project standards.
"""

import sys
from pathlib import Path

# Files that should not be in certain directories
MISPLACED_PATTERNS = [
    # Test files in wrong locations
    ('backend/', ['test_*.py', '*_test.py'], 'Test files should be in /tests/backend/'),
    ('frontend/src/', ['*.test.{js,jsx,ts,tsx}', '*.spec.{js,jsx,ts,tsx}'], 'Test files should be in /tests/frontend/'),
    
    # Scripts in wrong locations
    ('backend/', ['debug_*.py', 'check_*.py'], 'Debug/check scripts should be in /scripts/'),
    
    # Documentation in wrong locations
    ('backend/', ['*.md'], 'Documentation should be in /docs/ (except README.md)'),
    ('frontend/', ['*.md'], 'Documentation should be in /docs/ (except README.md)'),
]

def check_organization() -> list:
    """Check file organization in the project."""
    issues = []
    project_root = Path.cwd()
    
    for base_dir, patterns, message in MISPLACED_PATTERNS:
        base_path = project_root / base_dir
        if not base_path.exists():
            continue
            
        for pattern in patterns:
            # Handle glob patterns
            if '*' in pattern:
                misplaced = list(base_path.rglob(pattern))
            else:
                misplaced = list(base_path.glob(pattern))
                
            # Exclude allowed files
            allowed_files = ['README.md', '__init__.py']
            misplaced = [f for f in misplaced if f.name not in allowed_files]
            
            # Exclude proper test directories
            misplaced = [f for f in misplaced if '/tests/' not in str(f) and '/__pycache__/' not in str(f)]
            
            for file in misplaced:
                relative_path = file.relative_to(project_root)
                issues.append(f"{relative_path}: {message}")
                
    return issues

def main():
    """Main function to check file organization."""
    issues = check_organization()
    
    if issues:
        print("\n❌ File organization issues detected:\n")
        for issue in issues:
            print(f"  {issue}")
        print(f"\nTotal issues: {len(issues)}")
        print("\n💡 Fix: Move files to their proper directories according to project standards")
        sys.exit(1)
    else:
        print("✅ File organization follows project standards")
        sys.exit(0)

if __name__ == "__main__":
    main()
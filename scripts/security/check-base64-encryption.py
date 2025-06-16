#!/usr/bin/env python3
"""
Check for base64 encoding used as "encryption" for sensitive data.
"""

import re
import sys
from pathlib import Path

# Patterns that indicate base64 being used for sensitive data
BASE64_PATTERNS = [
    (r'base64\.(?:b64encode|urlsafe_b64encode).*(?:password|secret|token|key)', 
     'Base64 encoding used for sensitive data - this is NOT encryption!'),
    (r'base64.*(?:encrypt|cipher)', 
     'Base64 mentioned with encryption terms - possible confusion'),
    (r'#.*(?:fallback|backup).*base64', 
     'Base64 fallback mechanism detected - remove this!'),
]

def check_file(filepath: Path) -> list:
    """Check a single file for base64 misuse."""
    issues = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.splitlines()
            
        for line_num, line in enumerate(lines, 1):
            for pattern, message in BASE64_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append(f"{filepath}:{line_num}: {message}")
                    
    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)
        
    return issues

def main():
    """Main function to check files passed as arguments."""
    if len(sys.argv) < 2:
        print("Usage: check-base64-encryption.py <file1> [file2] ...")
        sys.exit(1)
        
    all_issues = []
    
    for filename in sys.argv[1:]:
        filepath = Path(filename)
        if filepath.exists() and filepath.is_file():
            issues = check_file(filepath)
            all_issues.extend(issues)
            
    if all_issues:
        print("\n❌ Base64 encoding misuse detected:\n")
        for issue in all_issues:
            print(f"  {issue}")
        print(f"\nTotal issues: {len(all_issues)}")
        print("\n💡 Fix: Use proper encryption (cryptography library) instead of base64")
        sys.exit(1)
    else:
        print("✅ No base64 encryption misuse found")
        sys.exit(0)

if __name__ == "__main__":
    main()
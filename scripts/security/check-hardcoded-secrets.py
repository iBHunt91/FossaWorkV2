#!/usr/bin/env python3
"""
Check for hardcoded secrets in source files.
"""

import re
import sys
from pathlib import Path

# Patterns that indicate hardcoded secrets
SECRET_PATTERNS = [
    # Direct assignments
    (r'(?i)(password|passwd|pwd)\s*=\s*["\'][^"\']+["\']', 'Hardcoded password found'),
    (r'(?i)(secret_key|api_key|auth_key)\s*=\s*["\'][^"\']+["\']', 'Hardcoded API/secret key found'),
    (r'(?i)(token|auth_token|access_token)\s*=\s*["\'][^"\']+["\']', 'Hardcoded token found'),
    
    # Environment variables with defaults
    (r'os\.(?:getenv|environ\.get)\(["\'](?:SECRET_KEY|API_KEY|PASSWORD)["\'],\s*["\'][^"\']+["\']', 'Hardcoded default secret found'),
    
    # Base64 encoding for passwords
    (r'base64\.b64encode.*password', 'Base64 encoding used for password (insecure)'),
    
    # Common test passwords (should use environment variables even in tests)
    (r'["\'](?:password123|test123|admin123|12345678?)["\']', 'Common test password found'),
]

# Allowed exceptions (e.g., example values in comments or documentation)
ALLOWED_CONTEXTS = [
    r'#.*example',
    r'#.*todo',
    r'\.example',
    r'README',
]

def check_file(filepath: Path) -> list:
    """Check a single file for hardcoded secrets."""
    issues = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.splitlines()
            
        for line_num, line in enumerate(lines, 1):
            # Skip if line is in allowed context
            if any(re.search(pattern, line, re.IGNORECASE) for pattern in ALLOWED_CONTEXTS):
                continue
                
            # Check each secret pattern
            for pattern, message in SECRET_PATTERNS:
                if re.search(pattern, line):
                    issues.append(f"{filepath}:{line_num}: {message}")
                    
    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)
        
    return issues

def main():
    """Main function to check files passed as arguments."""
    if len(sys.argv) < 2:
        print("Usage: check-hardcoded-secrets.py <file1> [file2] ...")
        sys.exit(1)
        
    all_issues = []
    
    for filename in sys.argv[1:]:
        filepath = Path(filename)
        if filepath.exists() and filepath.is_file():
            issues = check_file(filepath)
            all_issues.extend(issues)
            
    if all_issues:
        print("\n❌ Hardcoded secrets detected:\n")
        for issue in all_issues:
            print(f"  {issue}")
        print(f"\nTotal issues: {len(all_issues)}")
        print("\n💡 Fix: Use environment variables instead of hardcoded values")
        sys.exit(1)
    else:
        print("✅ No hardcoded secrets found")
        sys.exit(0)

if __name__ == "__main__":
    main()
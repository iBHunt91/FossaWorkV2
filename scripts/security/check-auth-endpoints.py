#!/usr/bin/env python3
"""
Check that API endpoints have proper authentication decorators.
"""

import ast
import sys
from pathlib import Path

# Authentication decorators that should be present
AUTH_DECORATORS = [
    'requires_auth',
    'login_required',
    'Depends(get_current_user)',
    'Depends(verify_token)',
]

# Endpoints that don't need authentication
PUBLIC_ENDPOINTS = [
    'login',
    'register',
    'health',
    'docs',
    'openapi',
    'favicon',
]

def check_file(filepath: Path) -> list:
    """Check a route file for unprotected endpoints."""
    issues = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Check if it's an API endpoint (has route decorator)
                is_endpoint = False
                has_auth = False
                
                for decorator in node.decorator_list:
                    decorator_str = ast.unparse(decorator) if hasattr(ast, 'unparse') else str(decorator)
                    
                    # Check if it's a route decorator
                    if any(method in decorator_str for method in ['get', 'post', 'put', 'delete', 'patch']):
                        is_endpoint = True
                        
                    # Check if it has authentication
                    if any(auth in decorator_str for auth in AUTH_DECORATORS):
                        has_auth = True
                        
                # Check function parameters for auth dependencies
                for arg in node.args.args:
                    if arg.annotation:
                        annotation_str = ast.unparse(arg.annotation) if hasattr(ast, 'unparse') else str(arg.annotation)
                        if any(auth in annotation_str for auth in AUTH_DECORATORS):
                            has_auth = True
                            
                # If it's an endpoint without auth and not public
                if is_endpoint and not has_auth:
                    # Check if it's a public endpoint
                    is_public = any(public in node.name.lower() for public in PUBLIC_ENDPOINTS)
                    if not is_public:
                        line_num = node.lineno
                        issues.append(f"{filepath}:{line_num}: Endpoint '{node.name}' lacks authentication")
                        
    except Exception as e:
        print(f"Error parsing {filepath}: {e}", file=sys.stderr)
        
    return issues

def main():
    """Main function to check route files."""
    if len(sys.argv) < 2:
        print("Usage: check-auth-endpoints.py <file1> [file2] ...")
        sys.exit(1)
        
    all_issues = []
    
    for filename in sys.argv[1:]:
        filepath = Path(filename)
        if filepath.exists() and filepath.is_file():
            issues = check_file(filepath)
            all_issues.extend(issues)
            
    if all_issues:
        print("\n❌ Unprotected API endpoints detected:\n")
        for issue in all_issues:
            print(f"  {issue}")
        print(f"\nTotal issues: {len(all_issues)}")
        print("\n💡 Fix: Add authentication dependencies to these endpoints")
        sys.exit(1)
    else:
        print("✅ All endpoints have proper authentication")
        sys.exit(0)

if __name__ == "__main__":
    main()
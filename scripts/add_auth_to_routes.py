#!/usr/bin/env python3
"""
Script to add authentication to all unprotected route endpoints
"""

import re
import sys

def add_auth_to_routes(file_path):
    """Add authentication dependency to all route handlers"""
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Pattern to match route decorator followed by function definition
    # This captures routes that don't already have current_user parameter
    pattern = r'(@router\.(get|post|put|patch|delete)\([^)]+\)\s*\n(?:async )?def \w+\([^)]*\):)'
    
    lines = content.split('\n')
    modified_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a route decorator
        if '@router.' in line and any(method in line for method in ['get', 'post', 'put', 'patch', 'delete']):
            # Look ahead to find the function definition
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith('def ') and not lines[j].strip().startswith('async def '):
                j += 1
            
            if j < len(lines):
                func_line = lines[j]
                # Check if current_user is already in the parameters
                if 'current_user' not in func_line and 'Depends(require_auth)' not in func_line:
                    # Find the closing parenthesis of the function parameters
                    if func_line.rstrip().endswith('):'):
                        # Single line function definition
                        # Insert before the closing ):
                        new_func_line = func_line.rstrip()[:-2] + ',\n    current_user: User = Depends(require_auth)\n):'
                        lines[j] = new_func_line
                    else:
                        # Multi-line function definition, find the closing line
                        k = j + 1
                        while k < len(lines) and not lines[k].rstrip().endswith('):'):
                            k += 1
                        if k < len(lines):
                            # Add the auth parameter before the closing
                            lines[k] = lines[k].rstrip()[:-2] + ',\n    current_user: User = Depends(require_auth)\n):'
        
        i += 1
    
    # Join the lines back
    modified_content = '\n'.join(lines)
    
    # Write back to file
    with open(file_path, 'w') as f:
        f.write(modified_content)
    
    print(f"✅ Added authentication to routes in {file_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python add_auth_to_routes.py <route_file.py>")
        sys.exit(1)
    
    add_auth_to_routes(sys.argv[1])
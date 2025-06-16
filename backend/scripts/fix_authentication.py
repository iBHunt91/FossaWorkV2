#!/usr/bin/env python3
"""
Fix authentication in all route files by adding proper authentication dependencies
"""

import os
import re
from pathlib import Path

# Routes that should remain public (no auth required)
PUBLIC_ROUTES = {
    "/api/auth/login",
    "/api/auth/verify", 
    "/api/auth/check",
    "/api/setup/status",
    "/api/setup/initialize",
    "/health",
    "/"
}

def needs_auth_fix(file_path):
    """Check if file needs authentication fixes"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Skip if already has auth imports
    if "from ..auth.dependencies import require_auth" in content or "from ..auth.security import get_current_user" in content:
        return False
    
    # Skip auth.py and setup.py as they contain public routes
    if file_path.name in ['auth.py', 'setup.py']:
        return False
        
    return True

def add_auth_import(content):
    """Add authentication import if not present"""
    if "from ..auth.dependencies import require_auth" not in content and "from ..auth.security import get_current_user" not in content:
        # Find the last import line
        import_lines = []
        lines = content.split('\n')
        last_import_idx = 0
        
        for i, line in enumerate(lines):
            if line.startswith('from ') or line.startswith('import '):
                last_import_idx = i
        
        # Insert the auth import after the last import
        lines.insert(last_import_idx + 1, "from ..auth.dependencies import require_auth")
        content = '\n'.join(lines)
    
    return content

def fix_route_endpoints(content, file_name):
    """Add authentication to route endpoints"""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a route decorator
        if '@router.' in line and any(method in line for method in ['get(', 'post(', 'put(', 'patch(', 'delete(']):
            # Skip test endpoints and truly public endpoints
            if '/test' in line or any(pub in line for pub in PUBLIC_ROUTES):
                fixed_lines.append(line)
                i += 1
                continue
                
            # Look for the function definition
            route_line = line
            j = i + 1
            
            # Find the function def line
            while j < len(lines) and not (lines[j].strip().startswith('def ') or lines[j].strip().startswith('async def ')):
                j += 1
            
            if j < len(lines):
                func_start = j
                func_line = lines[j]
                
                # Check if already has authentication
                if 'current_user' in func_line or 'Depends(require_auth)' in func_line:
                    fixed_lines.append(line)
                    i += 1
                    continue
                
                # Find the end of function parameters
                paren_count = func_line.count('(') - func_line.count(')')
                func_end = j
                
                while paren_count > 0 and func_end < len(lines) - 1:
                    func_end += 1
                    paren_count += lines[func_end].count('(') - lines[func_end].count(')')
                
                # Add route decorator
                fixed_lines.append(route_line)
                
                # Add intermediate lines
                for k in range(i + 1, func_start):
                    fixed_lines.append(lines[k])
                
                # Now add the function with auth
                if func_end == func_start:  # Single line function def
                    # Remove trailing ):
                    func_content = lines[func_start].rstrip()
                    if func_content.endswith('):'):
                        func_content = func_content[:-2]
                        func_content += ',\n    current_user: User = Depends(require_auth)\n):'
                    fixed_lines.append(func_content)
                else:  # Multi-line function def
                    # Add all lines except the last
                    for k in range(func_start, func_end):
                        fixed_lines.append(lines[k])
                    
                    # Modify the last line
                    last_line = lines[func_end].rstrip()
                    if last_line.endswith('):'):
                        last_line = last_line[:-2]
                        last_line += ',\n    current_user: User = Depends(require_auth)\n):'
                    fixed_lines.append(last_line)
                
                # Skip the lines we've already processed
                i = func_end + 1
                continue
        
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines)

def add_user_validation(content):
    """Add user validation checks where user_id parameters exist"""
    # This is a simplified version - in practice you'd want more sophisticated parsing
    lines = content.split('\n')
    fixed_lines = []
    
    in_function = False
    has_user_id_param = False
    indent_level = ""
    
    for i, line in enumerate(lines):
        # Check if we're entering a function that has user_id parameter
        if 'def ' in line and 'user_id' in line and 'current_user: User = Depends(require_auth)' in line:
            in_function = True
            has_user_id_param = True
            # Determine indent level
            next_line_idx = i + 1
            while next_line_idx < len(lines) and not lines[next_line_idx].strip():
                next_line_idx += 1
            if next_line_idx < len(lines):
                indent_match = re.match(r'^(\s*)', lines[next_line_idx])
                if indent_match:
                    indent_level = indent_match.group(1)
        
        fixed_lines.append(line)
        
        # Add validation after docstring
        if in_function and has_user_id_param and '"""' in line and i > 0 and '"""' in lines[i-1]:
            fixed_lines.append(f'{indent_level}# Verify user can only access their own data')
            fixed_lines.append(f'{indent_level}if current_user.id != user_id and not current_user.is_admin:')
            fixed_lines.append(f'{indent_level}    raise HTTPException(status_code=403, detail="Not authorized to access this user\'s data")')
            fixed_lines.append('')
            in_function = False
            has_user_id_param = False
    
    return '\n'.join(fixed_lines)

def fix_file(file_path):
    """Fix authentication in a single file"""
    print(f"Processing {file_path}...")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add import
    content = add_auth_import(content)
    
    # Fix route endpoints
    content = fix_route_endpoints(content, file_path.name)
    
    # Add user validation where needed
    if file_path.name not in ['auth.py', 'setup.py', 'logging.py']:
        content = add_user_validation(content)
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"✅ Fixed {file_path}")

def main():
    """Fix authentication in all route files"""
    routes_dir = Path(__file__).parent.parent / "app" / "routes"
    
    # Files that need fixing
    files_to_fix = [
        "automation.py",
        "form_automation.py", 
        "schedule_detection.py",
        "url_generation.py",
        "notifications.py"
    ]
    
    for file_name in files_to_fix:
        file_path = routes_dir / file_name
        if file_path.exists() and needs_auth_fix(file_path):
            fix_file(file_path)
    
    print("\n✅ Authentication fixes complete!")
    print("\nIMPORTANT: Please review the changes and test thoroughly.")
    print("Some endpoints may need custom authorization logic beyond user_id checks.")

if __name__ == "__main__":
    main()
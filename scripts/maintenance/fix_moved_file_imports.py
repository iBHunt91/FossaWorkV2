#!/usr/bin/env python3
"""
Fix import paths for files that were moved during organization
"""

import os
import re
from pathlib import Path

def fix_backend_path_references():
    """Fix hardcoded backend directory references in moved files"""
    
    # Patterns to fix
    backend_path_patterns = [
        (r"os\.chdir\('/Users/ibhunt/Documents/GitHub/FossaWorkV2-[^/]+/backend'\)", 
         "os.chdir('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')"),
        (r"'/Users/ibhunt/Documents/GitHub/FossaWorkV2-[^/]+/backend'", 
         "'/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend'"),
        (r"sys\.path\.insert\(0, '\.\'\)", 
         "sys.path.insert(0, '/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')"),
        (r"sys\.path\.append\(os\.path\.dirname\(os\.path\.abspath\(__file__\)\)\)", 
         "sys.path.append('/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend')"),
    ]
    
    # Files to check
    directories_to_check = [
        '/Users/ibhunt/Documents/GitHub/FossaWorkV2/tests',
        '/Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts',
    ]
    
    files_updated = 0
    
    for directory in directories_to_check:
        if not os.path.exists(directory):
            continue
            
        for root, dirs, files in os.walk(directory):
            # Skip virtual environment directories
            if 'venv' in root or '__pycache__' in root:
                continue
                
            for file in files:
                if not file.endswith('.py'):
                    continue
                    
                file_path = os.path.join(root, file)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    original_content = content
                    
                    # Apply all pattern fixes
                    for pattern, replacement in backend_path_patterns:
                        content = re.sub(pattern, replacement, content)
                    
                    # Write back if changed
                    if content != original_content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        files_updated += 1
                        print(f"Updated imports in: {file_path}")
                        
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
    
    print(f"\nTotal files updated: {files_updated}")

if __name__ == "__main__":
    print("Fixing import paths for moved files...")
    fix_backend_path_references()
    print("Import path fixes completed!")
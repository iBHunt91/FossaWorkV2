#!/usr/bin/env python3
"""
Fix all emoji characters in backend Python files to prevent Windows console Unicode errors
"""
import os
import re
from pathlib import Path

# Define emoji replacements for Windows console compatibility
EMOJI_REPLACEMENTS = {
    "[START]": "[START]",
    "[OK]": "[OK]", 
    "[ERROR]": "[ERROR]",
    "[SYNC]": "[SYNC]",
    "[WARNING]": "[WARNING]",
    "[CAMERA]": "[CAMERA]",
    "[CHART]": "[CHART]",
    "[DOWN]": "[DOWN]",
    "[WAIT]": "[WAIT]",
    "[INFO]": "[INFO]",
    "[TEST]": "[TEST]",
    "[SUCCESS]": "[SUCCESS]",
    "[NETWORK]": "[NETWORK]",
    "[BOT]": "[BOT]",
    "[USER]": "[USER]",
    "[SAVE]": "[SAVE]",
    "[SEARCH]": "[SEARCH]",
    "[FILE]": "[FILE]",
    "[SECURE]": "[SECURE]",
    "[KEY]": "[KEY]",
    "[EMAIL]": "[EMAIL]",
    "[TIME]": "[TIME]",
    "[TIP]": "[TIP]"
}

def fix_emojis_in_file(file_path):
    """Replace all emojis in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Replace each emoji
        for emoji, replacement in EMOJI_REPLACEMENTS.items():
            content = content.replace(emoji, replacement)
        
        # Only write if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Fix all emojis in backend Python files"""
    backend_dir = Path(__file__).parent
    fixed_files = []
    
    print("[INFO] Starting emoji replacement in backend Python files...")
    
    # Find all Python files (excluding venv)
    python_files = []
    for root, dirs, files in os.walk(backend_dir):
        # Skip venv directory
        if 'venv' in dirs:
            dirs.remove('venv')
        
        for file in files:
            if file.endswith('.py'):
                python_files.append(Path(root) / file)
    
    print(f"[INFO] Found {len(python_files)} Python files to process")
    
    # Process each file
    for file_path in python_files:
        if fix_emojis_in_file(file_path):
            fixed_files.append(file_path)
            print(f"[OK] Fixed emojis in: {file_path.relative_to(backend_dir)}")
    
    if fixed_files:
        print(f"\n[SUCCESS] Fixed emojis in {len(fixed_files)} files:")
        for file_path in fixed_files:
            print(f"  - {file_path.relative_to(backend_dir)}")
    else:
        print("\n[INFO] No emoji replacements needed")
    
    print("\n[COMPLETE] Emoji replacement finished!")

if __name__ == "__main__":
    main()
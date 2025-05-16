#!/usr/bin/env python3
import re

# Read the file
with open('AutomateForm.js', 'r') as f:
    lines = f.readlines()

# Find the duplicate dispenserProgress declaration around line 3355
# We want to keep the first one and remove the second
updated_lines = []
skip_lines = False
skip_count = 0

for i, line in enumerate(lines):
    # Check if we're at the duplicate declaration
    if i >= 3350 and i <= 3360 and 'const dispenserProgress = {' in line:
        skip_lines = True
        skip_count = 0
        # Replace with comment
        updated_lines.append('    // dispenserProgress already initialized earlier\n')
        continue
    
    # Skip the lines that are part of the duplicate declaration
    if skip_lines:
        skip_count += 1
        # Skip until we find the closing brace and array mapping
        if '}));' in line or (skip_count > 20):
            skip_lines = False
        continue
    
    updated_lines.append(line)

# Write the file back
with open('AutomateForm.js', 'w') as f:
    f.writelines(updated_lines)

print("Fixed duplicate dispenserProgress declaration!")
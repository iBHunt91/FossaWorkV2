#!/usr/bin/env python3
import re

# Read the file
with open('AutomateForm.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Count escaped quotes before fixing
escaped_count = content.count("\\'")
print(f"Found {escaped_count} escaped quotes")

# Replace escaped quotes with regular quotes
fixed_content = content.replace("\\'", "'")

# Write the fixed content back
with open('AutomateForm.js', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print(f"Fixed {escaped_count} escaped quotes in AutomateForm.js")
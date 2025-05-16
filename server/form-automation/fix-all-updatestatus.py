#!/usr/bin/env python3
import re

# Read the file
with open('AutomateForm.js', 'r') as f:
    lines = f.readlines()

# Track whether we're inside processVisit function
in_process_visit = False
brace_count = 0
updated_lines = []

for i, line in enumerate(lines):
    # Check if we're at the start of processVisit function  
    if 'async function processVisit(' in line:
        in_process_visit = True
        brace_count = 0
    
    # Count braces to track function scope
    if in_process_visit:
        brace_count += line.count('{') - line.count('}')
        
        # Exit processVisit if we've closed all braces
        if brace_count == 0 and '{' in lines[i-1]:
            in_process_visit = False
        
        # Check for updateStatus calls without dispenserProgress
        if 'updateStatus(' in line and in_process_visit:
            # Count existing parameters
            if ', dispenserProgress);' not in line:
                # Check if it already has 3 parameters (status, message, progress)
                match = re.search(r'updateStatus\((.*?)\);', line)
                if match:
                    params = match.group(1)
                    param_count = len([p.strip() for p in params.split(',') if p.strip()])
                    
                    if param_count == 2:
                        # Only has status and message, add null and dispenserProgress
                        line = line.replace(');', ', null, dispenserProgress);')
                    elif param_count == 3:
                        # Has status, message, and progress, add dispenserProgress
                        line = line.replace(');', ', dispenserProgress);')
    
    updated_lines.append(line)

# Write the file back
with open('AutomateForm.js', 'w') as f:
    f.writelines(updated_lines)

print("Fixed all updateStatus calls in processVisit function!")
#!/usr/bin/env python3
import re

# Read the file
with open('AutomateForm.js', 'r') as f:
    content = f.read()

# Define patterns for updateStatus calls that need dispenserProgress added
patterns_to_fix = [
    # Pattern for updateStatus with only 2 parameters
    (r"updateStatus\('(completed|running|error)', '([^']+)'\);", r"updateStatus('\1', '\2', null, dispenserProgress);"),
    (r'updateStatus\("(completed|running|error)", "([^"]+)"\);', r'updateStatus("\1", "\2", null, dispenserProgress);'),
    (r"updateStatus\('(completed|running|error)', `([^`]+)`\);", r"updateStatus('\1', `\2`, null, dispenserProgress);"),
    
    # Pattern for updateStatus with 3 parameters 
    (r"updateStatus\('(completed|running|error)', '([^']+)', ([^)]+)\);", r"updateStatus('\1', '\2', \3, dispenserProgress);"),
    (r'updateStatus\("(completed|running|error)", "([^"]+)", ([^)]+)\);', r'updateStatus("\1", "\2", \3, dispenserProgress);'),
    (r"updateStatus\('(completed|running|error)', `([^`]+)`, ([^)]+)\);", r"updateStatus('\1', `\2`, \3, dispenserProgress);"),
]

# Apply fixes within processVisit function
# First, find the processVisit function
process_visit_match = re.search(r'async function processVisit\([^)]*\) \{', content)
if process_visit_match:
    start_pos = process_visit_match.start()
    
    # Find the end of the function by counting braces
    brace_count = 0
    end_pos = start_pos
    for i, char in enumerate(content[start_pos:]):
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                end_pos = start_pos + i + 1
                break
    
    # Extract the function content
    before_function = content[:start_pos]
    function_content = content[start_pos:end_pos]
    after_function = content[end_pos:]
    
    # Apply fixes to function content
    for pattern, replacement in patterns_to_fix:
        function_content = re.sub(pattern, replacement, function_content)
    
    # Reconstruct the content
    content = before_function + function_content + after_function

# Write the file back
with open('AutomateForm.js', 'w') as f:
    f.write(content)

print("Comprehensively fixed all updateStatus calls in processVisit function!")
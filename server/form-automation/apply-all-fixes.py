#!/usr/bin/env python3
import re

# Read the file
with open('AutomateForm.js', 'r') as f:
    content = f.read()

# Fix 1: Add dispenserProgress initialization after serviceCode variable
# Look for this pattern in the processVisit function
pattern1 = r'(let serviceCode = null;)'
replacement1 = r'\1\n    \n    // Initialize dispenserProgress early\n    let dispenserProgress = {\n      workOrderId: null,\n      dispensers: []\n    };'
content = re.sub(pattern1, replacement1, content)

# Fix 2: Set workOrderId in dispenserProgress after "Final work order ID for lookup"
pattern2 = r'(logger\.info\(`Final work order ID for lookup: \$\{workOrderIdFromUrl\}`\);)'
replacement2 = r'\1\n    \n    // Set work order ID in dispenserProgress\n    if (workOrderIdFromUrl) {\n      dispenserProgress.workOrderId = workOrderIdFromUrl;\n    }'
content = re.sub(pattern2, replacement2, content)

# Fix 3: Update initial updateStatus call to include dispenserProgress
pattern3 = r'updateStatus\(\'running\', `Processing visit: \$\{visitUrl\}`\);'
replacement3 = r'updateStatus(\'running\', `Processing visit: ${visitUrl}`, null, dispenserProgress);'
content = re.sub(pattern3, replacement3, content)

# Fix 4: Update fillFormDetails call to pass dispenserProgress
pattern4 = r'await fillFormDetails\(page, formUrls, dispensers, isSpecificDispensers, formType\);'
replacement4 = r'await fillFormDetails(page, formUrls, dispensers, isSpecificDispensers, formType, dispenserProgress);'
content = re.sub(pattern4, replacement4, content)

# Fix 5: Update key updateStatus calls to include dispenserProgress
# These are specific known calls that need updating
updates = [
    (r'updateStatus\(\'running\', \'Analyzing visit details\.\.\.\'\);', 
     r'updateStatus(\'running\', \'Analyzing visit details...\', null, dispenserProgress);'),
    
    (r'updateStatus\(\'completed\', `Job cancelled by user`\);',
     r'updateStatus(\'completed\', `Job cancelled by user`, null, dispenserProgress);'),
     
    (r'updateStatus\(\'error\', `No dispensers found for work order ID: \$\{workOrderIdFromUrl\}',
     r'updateStatus(\'error\', `No dispensers found for work order ID: ${workOrderIdFromUrl}'),
]

for pattern, replacement in updates:
    content = re.sub(pattern, replacement, content)

# Fix 6: Remove the duplicate dispenserProgress declaration
# This is a more complex fix - we need to find the duplicate declaration and remove just that
# Look for the pattern around line 3355
pattern6 = r'(\n\s*// Initialize dispenser progress for the entire visit\n\s*const dispenserProgress = \{[^}]+\};\n)'
content = re.sub(pattern6, '\n    // dispenserProgress already initialized earlier\n', content, flags=re.DOTALL)

# Write the file back
with open('AutomateForm.js', 'w') as f:
    f.write(content)

print("All fixes applied successfully!")
print("1. Added dispenserProgress initialization")
print("2. Set workOrderId in dispenserProgress")
print("3. Updated initial updateStatus call")
print("4. Updated fillFormDetails call")
print("5. Updated key updateStatus calls")
print("6. Handled duplicate declaration")
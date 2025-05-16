#!/usr/bin/env python3
import re

# Read the file
with open('AutomateForm.js', 'r') as f:
    content = f.read()

# Fix 1: Add dispenserProgress initialization after serviceCode variable
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

# Fix 5: Update all updateStatus calls to include dispenserProgress
# Let's fix some key updateStatus calls
pattern5a = r'updateStatus\(\'running\', \'Analyzing visit details\.\.\.\'\);'
replacement5a = r'updateStatus(\'running\', \'Analyzing visit details...\', null, dispenserProgress);'
content = re.sub(pattern5a, replacement5a, content)

pattern5b = r'updateStatus\(\'completed\', `Visit processed successfully\. Created \$\{formUrls\.length\} forms\.`\);'
replacement5b = r'updateStatus(\'completed\', `Visit processed successfully. Created ${formUrls.length} forms.`, null, dispenserProgress);'
content = re.sub(pattern5b, replacement5b, content)

pattern5c = r'updateStatus\(\'error\', `Error processing visit: \$\{error\.message\}`\);'
replacement5c = r'updateStatus(\'error\', `Error processing visit: ${error.message}`, null, dispenserProgress);'
content = re.sub(pattern5c, replacement5c, content)

# Write the file back
with open('AutomateForm.js', 'w') as f:
    f.write(content)

print("Fixes applied successfully!")
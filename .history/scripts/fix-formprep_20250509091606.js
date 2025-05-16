import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to FormPrep.tsx
const formPrepPath = path.join(__dirname, '..', 'src', 'pages', 'FormPrep.tsx');

// Function to patch the file
function patchFormPrep() {
  try {
    console.log('Reading FormPrep.tsx...');
    
    // Read the file
    let content = fs.readFileSync(formPrepPath, 'utf8');
    
    // First check if we already have our LogsButton imported
    if (!content.includes("import LogsButton from '../components/LogsButton'")) {
      // Add import for LogsButton at the top, after the first React import
      content = content.replace(
        "import React, { useState, useEffect } from 'react';",
        "import React, { useState, useEffect } from 'react';\nimport LogsButton from '../components/LogsButton';"
      );
    }
    
    // Add the LogsButton component to the header
    // Look for the statusMessage span and add the button after it
    if (!content.includes("<LogsButton />")) {
      content = content.replace(
        /<span className="text-xs font-medium bg-gray-700 dark:bg-gray-800\/80 text-gray-300 py-1 px-2 rounded">\s*{\s*statusMessage\s*}\s*<\/span>/,
        '<span className="text-xs font-medium bg-gray-700 dark:bg-gray-800/80 text-gray-300 py-1 px-2 rounded">{statusMessage}</span>\n              <LogsButton />'
      );
    }
    
    // Write the file back
    fs.writeFileSync(formPrepPath, content, 'utf8');
    console.log('FormPrep.tsx patched successfully!');
    
    return true;
  } catch (error) {
    console.error('Error patching FormPrep.tsx:', error);
    return false;
  }
}

// Run the patch
const success = patchFormPrep();
process.exit(success ? 0 : 1); 
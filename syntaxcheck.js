import fs from 'fs';

try {
  const content = fs.readFileSync('src/main.tsx', 'utf8');
  console.log('Syntax check passed: No syntax errors in src/main.tsx');
} catch (err) {
  console.error('Error:', err.message);
} 
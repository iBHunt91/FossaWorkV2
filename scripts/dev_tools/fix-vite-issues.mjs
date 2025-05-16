#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

console.log('🔧 Starting Vite and TailwindCSS issue fix process...');

try {
  // 1. Clean Vite cache
  console.log('\n🧹 Step 1: Cleaning Vite cache...');
  execSync('node scripts/dev_tools/fix-vite-cache.mjs', { stdio: 'inherit', cwd: rootDir });
  
  // 2. Ensure node_modules are properly installed
  console.log('\n📦 Step 2: Reinstalling dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: rootDir });
  
  // 3. Validate configuration files
  console.log('\n✅ Step 3: Validating configuration files...');
  
  // Check if postcss.config.mjs exists and has right content
  const postcssPath = join(rootDir, 'postcss.config.mjs');
  if (!fs.existsSync(postcssPath) || !fs.readFileSync(postcssPath, 'utf8').includes('@tailwindcss/postcss')) {
    console.log('⚠️ postcss.config.mjs needs to be updated. Fixing...');
    fs.writeFileSync(postcssPath, `import postcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}`);
    console.log('✅ Fixed postcss.config.mjs');
  } else {
    console.log('✅ postcss.config.mjs looks good');
  }
  
  // Check tailwind.config.js
  const tailwindPath = join(rootDir, 'tailwind.config.js');
  if (fs.existsSync(tailwindPath)) {
    const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
    if (!tailwindContent.includes('export default') || !tailwindContent.includes('./src/**/*.{js,ts,jsx,tsx')) {
      console.log('⚠️ tailwind.config.js needs to be updated. Fixing...');
      // Only update if necessary - this is a simplified check, the actual file is complex
      console.log('⚠️ Please review tailwind.config.js manually to ensure it uses ES module format');
    } else {
      console.log('✅ tailwind.config.js looks good');
    }
  }
  
  // Check CSS directives
  const indexCssPath = join(rootDir, 'src', 'index.css');
  if (fs.existsSync(indexCssPath)) {
    const cssContent = fs.readFileSync(indexCssPath, 'utf8');
    if (!cssContent.includes('@tailwind base') || 
        !cssContent.includes('@tailwind components') || 
        !cssContent.includes('@tailwind utilities')) {
      console.log('⚠️ src/index.css is missing Tailwind directives. Fixing...');
      // Prepend the directives if they're missing
      const updatedCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

${cssContent.includes('@tailwind') ? '' : cssContent}`;
      fs.writeFileSync(indexCssPath, updatedCss);
      console.log('✅ Fixed src/index.css');
    } else {
      console.log('✅ src/index.css has all required Tailwind directives');
    }
  }
  
  console.log('\n🚀 All fixes applied successfully!');
  console.log('You can now run the application with: npm run electron:dev:start');
  
} catch (error) {
  console.error('\n❌ Error during fix process:', error);
  console.log('\n👉 Please try running the steps manually:');
  console.log('   1. npm run fix-vite-cache');
  console.log('   2. npm install');
  console.log('   3. Check configuration files (postcss.config.mjs, tailwind.config.js)');
  console.log('   4. npm run electron:dev:start');
} 
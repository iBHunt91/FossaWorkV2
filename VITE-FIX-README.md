# Vite and TailwindCSS Issues Fix

This document explains the fixes applied to resolve module loading errors in the application.

## Issues Fixed

1. **Module Loading Errors in Vite** - The "Failed to fetch dynamically imported module" error
2. **TailwindCSS Configuration** - Issues with incorrect module format
3. **Vite Cache Corruption** - Stale references in Vite's build cache

## Fix Components

### 1. Vite Cache Cleanup

Created a script (`scripts/fix-vite-cache.mjs`) to clean up Vite's cache, which removes:
- `node_modules/.vite` - Module cache directory
- `.vite` - Root cache directory (if exists)

### 2. ES Module Format Fixes

Fixed configuration files to use proper ES module format since the project uses `"type": "module"` in package.json:

- **postcss.config.mjs** - Updated to use proper ES module imports and exports with TailwindCSS 4.x:
  ```js
  import postcss from '@tailwindcss/postcss';
  import autoprefixer from 'autoprefixer';

  export default {
    plugins: {
      '@tailwindcss/postcss': {},
      autoprefixer: {},
    },
  }
  ```

- **tailwind.config.js** - Verified it uses ES module format:
  ```js
  export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx,css}",
    ],
    // ...
  }
  ```

### 3. CSS Directives

Ensured `src/index.css` contains the three required Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Important Note for TailwindCSS 4.x

If you're using TailwindCSS 4.x (which this project does), the PostCSS plugin has been moved to a separate package called `@tailwindcss/postcss`. This is different from earlier versions of TailwindCSS where you would use the `tailwindcss` package directly as a PostCSS plugin.

Make sure your PostCSS configuration uses:
```js
'@tailwindcss/postcss': {}
```
instead of:
```js
'tailwindcss': {}
```

## How to Run the Fix

1. Run the comprehensive fix script:
   ```
   npm run fix-vite-issues
   ```

   This will:
   - Clean the Vite cache
   - Reinstall dependencies
   - Validate and fix configuration files
   - Ensure CSS directives are present

2. If you prefer to run the steps manually:
   ```
   npm run fix-vite-cache
   npm install
   ```

3. After the fix, start the application:
   ```
   npm run electron:dev:start
   ```

## Common Troubleshooting

If you still encounter issues:

1. **Delete and Reinstall node_modules**: 
   ```
   rm -rf node_modules
   npm install
   ```

2. **Check Browser Console**: Look for specific module loading errors

3. **Verify Import/Export Syntax**: Ensure all files use proper ES module syntax:
   - Use `import x from 'y'` instead of `require()`
   - Use `export default` instead of `module.exports`

4. **Check for Path Resolution Issues**: Use absolute imports or proper relative paths

## Further Reading

- [Vite Documentation on Module Preloading](https://vitejs.dev/guide/features.html#production-ready)
- [TailwindCSS with Vite](https://tailwindcss.com/docs/guides/vite)
- [ES Modules in Node.js](https://nodejs.org/api/esm.html) 
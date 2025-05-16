# Development Tools

This directory contains scripts for development and build-related tasks.

## Scripts

- `fix-vite-cache.mjs` - Fixes Vite cache issues that can occur during development
- `fix-vite-issues.mjs` - Resolves common Vite configuration issues
- `fix-tailwind.mjs` - Fixes Tailwind CSS configuration issues
- `free-port.js` - Releases ports that may be in use by stalled processes

## Usage

These scripts are typically run via npm scripts:

```bash
# Fix Vite cache issues
npm run fix-vite-cache

# Fix Tailwind issues
npm run fix-tailwind
```

## Package.json Scripts

These scripts are referenced in package.json with scripts like:

```json
{
  "scripts": {
    "fix-vite-cache": "node scripts/dev_tools/fix-vite-cache.mjs",
    "fix-vite-issues": "node scripts/dev_tools/fix-vite-issues.mjs",
    "fix-tailwind": "node scripts/dev_tools/fix-tailwind.mjs",
    "free-port": "node scripts/dev_tools/free-port.js"
  }
}
```

## Common Issues

### Vite Cache Issues
Vite caches dependencies and sometimes this cache can become corrupted during development, causing errors. The `fix-vite-cache.mjs` script helps to clear this cache and resolve related issues.

### Tailwind Issues
Tailwind CSS configuration issues can arise when adding new CSS files or when PurgeCSS incorrectly removes required CSS classes. The `fix-tailwind.mjs` script addresses these issues. 
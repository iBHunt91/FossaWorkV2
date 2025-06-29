#!/bin/bash
# Script to completely reset the development environment

echo "🔧 Fixing FossaWork development environment..."

# Kill all Node processes
echo "1️⃣ Killing all Node.js processes..."
pkill -f node
pkill -f vite

# Clear all caches
echo "2️⃣ Clearing all caches..."
rm -rf frontend/node_modules/.vite
rm -rf frontend/node_modules/.cache
rm -rf ~/.npm/_cacache

# Clear browser cache for localhost
echo "3️⃣ Browser cache must be cleared manually:"
echo "   - Open DevTools (F12)"
echo "   - Right-click the refresh button"
echo "   - Select 'Empty Cache and Hard Reload'"

# Restart the frontend
echo "4️⃣ Restarting frontend dev server..."
cd frontend
npm run dev

echo "✅ Environment reset complete!"
echo "🔍 Now check the Network tab in DevTools when testing Pushover"
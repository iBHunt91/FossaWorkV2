#!/bin/bash
# Reset FossaWork database to zero-user state

echo "🎯 FossaWork V2 - Database Reset Tool"
echo "===================================="
echo
echo "⚠️  WARNING: This will delete the database!"
echo "All users and data will be permanently removed."
echo

read -p "Are you sure you want to continue? (type 'YES' to confirm): " confirm

if [ "$confirm" != "YES" ]; then
    echo
    echo "❌ Reset cancelled"
    exit 1
fi

# Find the database file
DB_FILE="fossawork.db"

if [ -f "$DB_FILE" ]; then
    echo
    echo "🗑️  Removing database file: $DB_FILE"
    rm "$DB_FILE"
    echo "✅ Database removed"
else
    echo
    echo "ℹ️  No database file found"
fi

# Also remove any journal files
if [ -f "${DB_FILE}-journal" ]; then
    rm "${DB_FILE}-journal"
    echo "✅ Journal file removed"
fi

echo
echo "✅ SUCCESS: Database has been reset!"
echo
echo "The system is now in zero-user state."
echo
echo "Next steps:"
echo "1. Start the backend: uvicorn app.main:app --reload"
echo "2. The database will be recreated automatically"
echo "3. Visit: http://localhost:8000/api/setup/status"
echo "4. You should see: {\"setup_required\": true}"
echo
echo "===================================="
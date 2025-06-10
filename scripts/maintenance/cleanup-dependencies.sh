#!/bin/bash
# FossaWork V2 Dependency Cleanup Script

echo "🧹 FossaWork V2 Dependency Cleanup"
echo "=================================="

# Function to safely remove node_modules
cleanup_node_modules() {
    local dir=$1
    if [ -d "$dir/node_modules" ]; then
        echo "📦 Removing node_modules in $dir..."
        # Try normal removal first
        rm -rf "$dir/node_modules" 2>/dev/null || {
            echo "⚠️  Permission issues detected, trying alternative cleanup..."
            # Alternative cleanup for Windows/WSL permission issues
            find "$dir/node_modules" -name "*.dll" -delete 2>/dev/null
            find "$dir/node_modules" -name "*.exe" -delete 2>/dev/null
            find "$dir/node_modules" -type f -delete 2>/dev/null
            find "$dir/node_modules" -type d -empty -delete 2>/dev/null
            
            if [ -d "$dir/node_modules" ]; then
                echo "⚠️  Some files remain due to permission issues"
                echo "   Manual removal may be required for: $dir/node_modules"
            else
                echo "✅ Successfully cleaned $dir/node_modules"
            fi
        }
    fi
}

# Function to remove Python virtual environments
cleanup_python_venv() {
    local dir=$1
    if [ -d "$dir/venv" ]; then
        echo "🐍 Removing Python venv in $dir..."
        rm -rf "$dir/venv"
        echo "✅ Removed $dir/venv"
    fi
    if [ -d "$dir/.venv" ]; then
        echo "🐍 Removing Python .venv in $dir..."
        rm -rf "$dir/.venv"
        echo "✅ Removed $dir/.venv"
    fi
}

# Function to remove backup files
cleanup_backups() {
    echo "🗑️  Removing backup files..."
    find . -name "*.bak" -delete 2>/dev/null
    find . -name "*.backup" -delete 2>/dev/null
    find . -name "*~" -delete 2>/dev/null
    echo "✅ Backup files removed"
}

# Function to remove temporary files
cleanup_temp() {
    echo "🗑️  Removing temporary files..."
    find . -name "*.tmp" -delete 2>/dev/null
    find . -name "*.temp" -delete 2>/dev/null
    rm -rf tmp/ temp/ 2>/dev/null
    echo "✅ Temporary files removed"
}

# Function to remove log files older than 30 days
cleanup_old_logs() {
    echo "📜 Removing old log files..."
    find . -name "*.log" -mtime +30 -delete 2>/dev/null
    find . -name "server.log.*" -mtime +7 -delete 2>/dev/null
    echo "✅ Old log files removed"
}

# Main cleanup execution
echo "Starting cleanup process..."

# Clean dependencies
cleanup_node_modules "."
cleanup_node_modules "frontend"
cleanup_node_modules "V1-Archive-2025-01-07" 2>/dev/null # If still present
cleanup_python_venv "backend"

# Clean artifacts
cleanup_backups
cleanup_temp
cleanup_old_logs

# Remove empty directories
echo "📁 Removing empty directories..."
find . -type d -empty -delete 2>/dev/null

# Show final status
echo ""
echo "🎯 Cleanup Summary"
echo "=================="
echo "Current directory size:"
du -sh . 2>/dev/null | head -1

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "Note: If node_modules directories remain due to permission issues,"
echo "they can be safely deleted manually or by running npm install again."
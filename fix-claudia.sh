#!/bin/bash
echo "Fixing Claudia to find Claude Code..."
echo ""
echo "Creating a wrapper script that Claudia can find..."

# Create a simple wrapper in your home directory
cat > ~/claude << 'EOF'
#!/bin/bash
exec /Users/ibhunt/.npm-global/bin/claude "$@"
EOF

chmod +x ~/claude

echo ""
echo "Fix applied! Now try running Claudia again."
echo "The app will look for 'claude' in your home directory."
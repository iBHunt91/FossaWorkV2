#!/bin/bash
# Start Claude Code with project MCP servers

# First, try to start normally - Claude will prompt for MCP approval
claude "$@"

# If you need to force MCP config, uncomment the line below:
# claude --mcp-config .mcp.json "$@"

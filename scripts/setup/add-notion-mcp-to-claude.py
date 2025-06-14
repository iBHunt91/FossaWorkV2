#!/usr/bin/env python3
"""
Add Notion MCP server to Claude Code configuration
"""

import json
import os
import sys
from pathlib import Path

def add_notion_mcp_server():
    # Path to Claude Code config
    config_path = Path.home() / ".claude.json"
    
    if not config_path.exists():
        print(f"❌ Claude Code config not found at {config_path}")
        return False
    
    # Backup the config
    backup_path = config_path.with_suffix('.json.backup')
    print(f"📁 Creating backup at {backup_path}")
    config_path.read_text()  # Verify file is readable
    backup_path.write_text(config_path.read_text())
    
    # Load the config
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Find the FossaWorkV2 project
    project_path = "/Users/ibhunt/Documents/GitHub/FossaWorkV2"
    
    if project_path not in config.get('projects', {}):
        print(f"❌ Project {project_path} not found in Claude Code config")
        return False
    
    # Add Notion MCP server to the project's mcpServers
    notion_server = {
        "type": "stdio",
        "command": "npx",
        "args": [
            "-y",
            "@notionhq/notion-mcp-server"
        ],
        "env": {
            "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer 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\", \"Notion-Version\": \"2022-06-28\" }"
        }
    }
    
    # Update the mcpServers for the project
    if 'mcpServers' not in config['projects'][project_path]:
        config['projects'][project_path]['mcpServers'] = {}
    
    config['projects'][project_path]['mcpServers']['notion'] = notion_server
    
    # Write the updated config
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print("✅ Successfully added Notion MCP server to Claude Code configuration")
    print("📝 The server will be available as 'notion' in Claude Code")
    print("🔄 Please restart Claude Code for changes to take effect")
    
    return True

if __name__ == "__main__":
    success = add_notion_mcp_server()
    sys.exit(0 if success else 1)
# Claude/Claudia Scripts

This directory contains utility scripts for setting up and managing Claude Code and Claudia integration.

## Contents

- **claude-wrapper.sh** - Simple wrapper script that executes Claude Code from its npm-global installation
- **fix-claudia.sh** - Creates a Claude wrapper in the home directory that Claudia can find
- **install-claude-system.sh** - Installs Claude Code system-wide by creating a symlink in /usr/local/bin (requires sudo)
- **launch-claudia.sh** - Launches Claudia application with custom PATH environment

## Usage

### Initial Setup
1. Run `./fix-claudia.sh` to create a local Claude wrapper
2. Or run `./install-claude-system.sh` to install Claude system-wide (requires admin password)

### Launching Claudia
- Use `./launch-claudia.sh` to launch Claudia with the proper environment

### Claude Wrapper
- The `claude-wrapper.sh` can be copied to any location in PATH to make Claude accessible

## Note

These scripts are configured for the specific user environment with paths to `/Users/ibhunt/`. Modify the paths as needed for other systems.
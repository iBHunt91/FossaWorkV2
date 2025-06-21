# Claudia Launchers

This directory contains launcher scripts and applications for the Claudia interface, which provides a GUI wrapper around Claude Code.

## Contents

- **Claudia-Fixed.command** - macOS command script that sets up the environment and launches Claudia with proper PATH configuration
- **claudia-launcher.command** - Alternative launcher with simplified PATH setup
- **ClaudiaFixed.app** - macOS application bundle that launches Claudia
- **LaunchClaudia.app** - Alternative macOS application bundle for launching Claudia

## Usage

These launchers help ensure that Claudia can find the Claude Code executable by setting up the proper environment variables and PATH configuration before launching the Claudia application.

To use:
1. Double-click any of the `.command` files or `.app` bundles
2. The launcher will set up the environment and start Claudia
3. Claudia will then be able to locate and use Claude Code

## Note

These launchers are specific to the user's environment and contain hardcoded paths to `/Users/ibhunt/`. They would need to be modified for use on other systems.
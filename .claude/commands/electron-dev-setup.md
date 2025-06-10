# Electron Development Setup

Set up and verify Electron development environment for Windows.

## Execution Steps

1. Check Node.js and npm versions:
   - Required: Node.js 18+ and npm 8+
   - Verify with `node -v` and `npm -v`
2. Verify Electron dependencies in `package.json`:
   - electron
   - electron-builder
   - electron-updater
3. Test IPC communication channels:
   - Main to renderer: `api:*` channels
   - Renderer to main: Response handlers
   - Verify in `/electron/preload.js`
4. Validate preload script security:
   - Context isolation enabled
   - Node integration disabled
   - Secure IPC exposure only
5. Check renderer process configuration:
   - BrowserWindow settings
   - Web preferences
   - CSP headers
6. Test auto-updater setup:
   - Update server configuration
   - Version checking logic
   - Download/install flow
7. Verify Windows-specific features:
   - Taskbar progress integration
   - System tray functionality
   - Native notifications (Windows 10+)
   - Jump list items
   - Thumbnail toolbars
8. Check development tools:
   - DevTools extensions
   - React Developer Tools
   - Redux DevTools (if applicable)
9. Generate development report

## Example Usage

```
/electron-dev-setup
```

This will:
- Verify all Electron dependencies
- Test IPC communication
- Check security configurations
- Validate Windows integrations
- Generate comprehensive report

## Common Issues

### Native Module Compilation
- Install Windows Build Tools
- Use correct Node.js version for Electron
- Rebuild native modules: `npm run electron:rebuild`

### IPC Communication Failures
- Check channel names match
- Verify preload script loaded
- Test with simple ping/pong

### Windows Integration Issues
- Run as Administrator for some features
- Check Windows version compatibility
- Verify app manifest settings
# Windows Tools Check

Verify all Windows-specific tools and scripts are functioning correctly.

## Execution Steps

1. Check batch file integrity in `/tools/` directory:
   - Verify all .bat files have proper line endings (CRLF)
   - Check for syntax errors in batch scripts
   - Validate environment variable usage
2. Test PowerShell scripts permissions:
   - Check execution policy settings
   - Verify script signing requirements
   - Test elevated permission requirements
3. Validate Windows service integrations:
   - Check if running as Windows service
   - Verify service dependencies
   - Test service start/stop/restart
4. Test file path handling:
   - Forward slash to backslash conversion
   - UNC path support
   - Long path support (>260 chars)
   - Special character handling
5. Check process management utilities:
   - Task kill functionality
   - Process enumeration
   - Port management tools
6. Test Windows-specific automation:
   - COM object access
   - Registry read/write
   - Windows API calls
   - Shell integration
7. Verify development tools:
   - Node.js Windows build tools
   - Python Windows compiler
   - Git bash integration
   - WSL compatibility (if used)
8. Generate compatibility report

## Example Usage

```
/windows-tools-check
```

This will run all checks and generate a comprehensive report.

## Common Windows Issues

### Batch File Problems
- Line ending issues (LF vs CRLF)
- Path separator conflicts
- Environment variable expansion
- Unicode character support

### Permission Issues
- UAC elevation requirements
- File system permissions
- Network share access
- Firewall restrictions

### Process Management
- Orphaned processes
- Port conflicts
- Service dependencies
- Resource locks

## Tools Verified

### Batch Scripts
- `tools\\start-backend.bat`
- `tools\\start-frontend.bat`
- `tools\\start-full-system.bat`
- `tools\\quick-start.bat`
- `tools\\test-automation.bat`

### PowerShell Scripts
- Execution policy checks
- Module availability
- Version compatibility

### System Integration
- Windows Defender exclusions
- Scheduled task creation
- Event log writing
- Performance counter access
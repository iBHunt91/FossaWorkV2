# Browser Process Management Solution

## Problem
Stuck Chromium processes accumulate over time, causing system resource exhaustion and API timeout errors.

## Root Causes
1. Browser instances not properly closed after scraping operations
2. Error conditions leaving browsers orphaned
3. No automatic cleanup mechanism
4. Browser references set to None without proper cleanup

## Implemented Solution

### 1. Browser Process Manager (`backend/app/services/browser_manager.py`)
- **Automatic Monitoring**: Periodic cleanup task runs every minute
- **Process Tracking**: Maintains registry of managed browser instances
- **Lifecycle Management**: Enforces maximum browser lifetime (30 minutes)
- **Smart Detection**: Identifies Playwright-launched browsers vs system browsers
- **Force Cleanup**: Emergency cleanup capabilities

Key Features:
```python
# Automatic cleanup of stuck processes
browser_manager.start_monitoring()

# Context manager for guaranteed cleanup
async with ManagedBrowser("session_id") as browser:
    await browser.page.goto("https://example.com")
    # Browser automatically cleaned up even if error occurs
```

### 2. Application Lifecycle Integration (`backend/app/core/startup.py`)
- **Startup Cleanup**: Kills any leftover processes on application start
- **Graceful Shutdown**: Ensures all browsers closed on app shutdown
- **Background Monitoring**: Starts automatic cleanup task

### 3. Browser Management API (`backend/app/routes/browser_management.py`)
Endpoints for monitoring and control:
- `GET /api/browser/status` - View active browsers and processes
- `POST /api/browser/cleanup` - Manual cleanup trigger
- `GET /api/browser/health` - Quick health check
- `POST /api/browser/monitoring/start` - Start monitoring
- `POST /api/browser/monitoring/stop` - Stop monitoring

### 4. Manual Cleanup Script (`scripts/cleanup_browsers.py`)
Emergency cleanup tool for system administrators:
```bash
python3 scripts/cleanup_browsers.py
```

## Prevention Strategies

### 1. Fixed Browser Automation Service
- Set browser/playwright to None after cleanup
- Clear all session data on cleanup
- Prevent reuse of closed browser instances

### 2. Proper Error Handling
- Always close browsers in finally blocks
- Use context managers for automatic cleanup
- Track browser PIDs for forced cleanup

### 3. Resource Limits
- Maximum browser lifetime: 30 minutes
- Single-process mode to reduce subprocess count
- Memory pressure settings to prevent exhaustion

## Configuration

### Environment Variables
```bash
# Disable automatic cleanup (not recommended)
DISABLE_BROWSER_MONITORING=true

# Adjust cleanup interval (seconds)
BROWSER_CLEANUP_INTERVAL=60

# Maximum browser lifetime (minutes)
MAX_BROWSER_LIFETIME=30
```

### Platform-Specific Settings
- **Linux**: Added `--no-zygote` flag to prevent zombie processes
- **Windows**: Uses taskkill for process termination
- **macOS**: Standard Unix process management

## Monitoring

### Health Indicators
1. **Healthy**: 0 stuck processes
2. **Degraded**: 1-5 stuck processes
3. **Unhealthy**: >5 stuck processes

### Metrics Tracked
- Active browser sessions
- Process age and memory usage
- Cleanup success rate
- Monitoring task status

## Usage Examples

### Automated Cleanup (Default)
The system automatically monitors and cleans up stuck browsers every minute.

### Manual Cleanup
```python
# Via API (authenticated)
response = await apiClient.post('/api/browser/cleanup', {
    force: true  // Force kill all browsers
})

# Via script
python3 scripts/cleanup_browsers.py
```

### Status Check
```python
# Check browser health
const health = await apiClient.get('/api/browser/health')
console.log(`Browser system: ${health.status}`)
console.log(`Stuck processes: ${health.stuck_processes}`)
```

## Benefits
1. **Prevents Resource Exhaustion**: No more accumulating browser processes
2. **Improves Performance**: System stays responsive
3. **Reduces Errors**: No more timeout errors from resource starvation
4. **Better Observability**: Clear visibility into browser state
5. **Emergency Recovery**: Manual cleanup options available

## Testing
1. Start the application - browsers should be cleaned on startup
2. Run scraping operations - browsers should close properly
3. Simulate errors - orphaned browsers should be cleaned within 1 minute
4. Check status endpoint - should show accurate process counts
5. Use cleanup script - should kill all Chromium processes

## Future Enhancements
1. Prometheus metrics integration
2. Alerting for high process counts
3. Per-user browser limits
4. Browser pool management
5. Detailed process genealogy tracking
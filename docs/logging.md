# Server Logging System

## Overview
This document explains the logging system implemented for the application server. The system provides structured, configurable logging with both console and file output.

## Features
- **Log Levels**: DEBUG, INFO, WARN, ERROR, SILENT
- **Component-Based Logging**: Tag logs by component/module for better organization
- **Colorized Console Output**: Visual differentiation of log levels and components
- **File Logging with Rotation**: Automatic log rotation when files reach a certain size
- **JSON Formatting Option**: For machine-readable logs
- **Sensitive Information Masking**: Automatic redaction of passwords, tokens, and emails
- **Request ID Tracking**: Follow a request through the entire application flow
- **API Endpoints**: Dynamic control of log levels and component filtering
- **Success Highlighting**: Special formatting for success messages

## Log Levels
1. **DEBUG** (0): Detailed information for debugging purposes
2. **INFO** (1): General information about application operation
3. **WARN** (2): Warning conditions that should be addressed
4. **ERROR** (3): Error conditions that may affect normal operation
5. **SILENT** (4): Disable all logging output

## Log Files
The system creates and manages the following log files in the `logs` directory:
- `all.log`: All log entries regardless of level
- `error.log`: Only ERROR level messages
- `access.log`: HTTP request logs (from middleware)
- `debug.log`: Only DEBUG level messages

## Usage Examples
### Basic Logging
```javascript
import { debug, info, warn, error, success } from './utils/logger.js';

// Basic logging
debug('Detailed debug information', 'COMPONENT_NAME');
info('General information message', 'COMPONENT_NAME');
warn('Warning condition detected', 'COMPONENT_NAME');
error('Error occurred', 'COMPONENT_NAME');
success('Operation completed successfully', 'COMPONENT_NAME');

// Error logging with stack trace
try {
  // Some operation that might fail
} catch (err) {
  error('Failed to complete operation', 'COMPONENT_NAME', err);
}
```

### Component-Based Filtering
```javascript
import { enableComponents, disableComponents, resetComponentFilters } from './utils/logger.js';

// Only log messages from specific components
enableComponents(['DATABASE', 'AUTH']);

// Disable logging from specific components
disableComponents(['SOCKET']);

// Reset to log all components
resetComponentFilters();
```

### Dynamic Log Level Control
```javascript
import { setLogLevel, getLogLevel } from './utils/logger.js';

// Get current log level
const currentLevel = getLogLevel();
console.log(`Current log level: ${currentLevel}`);

// Change log level
setLogLevel('DEBUG'); // Set to most verbose
setLogLevel('ERROR'); // Set to most minimal
setLogLevel('SILENT'); // Disable all logging
```

## HTTP Middleware
The system includes middleware for Express.js:

### Request Logger
```javascript
app.use(requestLogger);
```
Logs all HTTP requests with:
- Method
- URL
- Status code
- Response time
- Client IP
- Request ID (for tracking)

### Error Handler
```javascript
app.use(errorHandler);
```
- Logs errors that occur during request processing
- Masks sensitive information
- Returns appropriate error responses to clients
- Includes stack traces in development environment

## Environment Variables
The logging system can be configured with the following environment variables:
- `LOG_LEVEL`: Sets the global log level (DEBUG, INFO, WARN, ERROR)
- `ENABLE_FILE_LOGGING`: Enable/disable file logging (default: true)
- `ENABLE_CONSOLE_COLORS`: Enable/disable colored console output (default: true)
- `LOG_FORMAT`: Format for log entries (detailed, simple, json)
- `MAX_LOG_SIZE`: Maximum size of log files before rotation in bytes (default: 5MB)
- `MAX_LOG_FILES`: Number of rotated log files to keep (default: 10)
- `INCLUDE_STACK_TRACE`: Include stack traces in error logs (default: false)

## API Endpoints
The system provides API endpoints for runtime configuration:

### Get Current Log Level
```
GET /api/logs/level
```
Returns the current log level and available options.

### Change Log Level
```
POST /api/logs/level
{
  "level": "DEBUG"
}
```
Sets the log level to the specified value.

### Enable Components Logging
```
POST /api/logs/components/enable
{
  "components": ["DATABASE", "AUTH"]
}
```
Enables logging for the specified components.

### Disable Components Logging
```
POST /api/logs/components/disable
{
  "components": ["SOCKET"]
}
```
Disables logging for the specified components.

### Reset Component Filtering
```
POST /api/logs/components/reset
```
Resets component filtering to log all components.

## Security Features
The logging system includes security features to prevent sensitive information exposure:

### Sensitive Data Masking
- Automatically masks passwords, tokens, and secrets in logs
- Masks email addresses (e.g., `j***@example.com`)
- Redacts environment variables containing sensitive information

### Safe Error Handling
- Creates safe error objects without sensitive details for client responses
- Provides more details in development mode while remaining safe
- Tracks errors with request IDs for easier debugging

## Best Practices
1. Always use component tags for better organization
2. Use the appropriate log level for each message
3. Include error objects when logging errors for stack traces
4. Use success() for successful operations instead of info()
5. Consider component filtering in production for focused debugging
6. Use maskSensitiveInfo() when logging potentially sensitive data
7. Maintain request IDs throughout the request lifecycle

## Implementation Details
The logging system is implemented in the following files:
- `server/utils/logger.js`: Main logging functionality
- `server/utils/middlewares.js`: HTTP middleware for logging
- `server/utils/security.js`: Security utilities for masking sensitive data
- `server/routes/api.js`: API endpoints for log configuration

## Future Enhancements
- Integration with external logging services
- Log aggregation and analysis tools
- Advanced filtering by log patterns
- Performance metrics logging
- User action audit logging 
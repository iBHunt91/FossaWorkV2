/**
 * Real-time Logging Service for FossaWork V2 Frontend
 * Provides detailed logging with real-time streaming and log management
 */

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  logger: string;
  message: string;
  module?: string;
  function?: string;
  line?: number;
  data?: any;
  exception?: string;
}

export interface LogStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  sessionStart: string;
  lastClear: string;
}

class FrontendLoggingService {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private sessionStart: string;
  private lastClear: string;
  private logListeners: ((log: LogEntry) => void)[] = [];
  private wsConnection: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  constructor() {
    this.sessionStart = new Date().toISOString();
    this.lastClear = this.sessionStart;
    this.initializeConsoleOverride();
    this.connectToBackendLogs();
    
    // Clear logs on page reload
    window.addEventListener('beforeunload', () => {
      this.clearLogs();
    });

    this.info('frontend.init', '🚀 Frontend logging service initialized');
  }

  /**
   * Override console methods to capture all console output
   */
  private initializeConsoleOverride() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Override console.log
    console.log = (...args: any[]) => {
      originalConsole.log(...args);
      this.debug('console.log', this.formatConsoleArgs(args));
    };

    // Override console.info
    console.info = (...args: any[]) => {
      originalConsole.info(...args);
      this.info('console.info', this.formatConsoleArgs(args));
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
      originalConsole.warn(...args);
      this.warn('console.warn', this.formatConsoleArgs(args));
    };

    // Override console.error
    console.error = (...args: any[]) => {
      originalConsole.error(...args);
      this.error('console.error', this.formatConsoleArgs(args));
    };

    // Override console.debug
    console.debug = (...args: any[]) => {
      originalConsole.debug(...args);
      this.debug('console.debug', this.formatConsoleArgs(args));
    };

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('window.error', `Unhandled error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('window.unhandledrejection', `Unhandled promise rejection: ${event.reason}`, {
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }

  /**
   * Connect to backend WebSocket for real-time log streaming
   */
  private connectToBackendLogs() {
    if (this.isConnecting || this.wsConnection?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    
    // Check if we should connect to backend (only if API_URL suggests backend is available)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const backendPort = apiUrl.includes('8000') ? '8000' : '8000';
    const wsUrl = `ws://localhost:${backendPort}/api/v1/logs/stream`;

    try {
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        this.info('websocket.backend', '🔌 Connected to backend logs');
        this.wsReconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection' || data.type === 'ping' || data.type === 'pong') {
            // System messages
            return;
          }

          // Backend log entry
          const backendLog: LogEntry = {
            timestamp: data.timestamp,
            level: data.level?.toLowerCase() as LogEntry['level'] || 'info',
            logger: `backend.${data.logger}`,
            message: data.message,
            module: data.module,
            function: data.function,
            line: data.line,
            data: {
              thread: data.thread,
              process: data.process,
              pathname: data.pathname
            },
            exception: data.exception
          };

          this.addLog(backendLog, false); // Don't log to console again
        } catch (error) {
          this.error('websocket.parse', 'Failed to parse backend log message', { error, data: event.data });
        }
      };

      this.wsConnection.onerror = (error) => {
        // Only log error if we haven't reached max attempts (to reduce noise)
        if (this.wsReconnectAttempts === 0) {
          this.warn('websocket.backend', '⚠️ Unable to connect to backend logging service', { 
            wsUrl,
            note: 'Backend may not be running - frontend logging will continue independently'
          });
        }
        this.isConnecting = false;
      };

      this.wsConnection.onclose = () => {
        this.isConnecting = false;
        this.wsConnection = null;

        // Attempt reconnection with exponential backoff
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
          this.wsReconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000); // Max 30s delay
          
          // Only log reconnection attempts for first few tries
          if (this.wsReconnectAttempts <= 2) {
            this.info('websocket.backend', `🔄 Attempting to reconnect to backend logs (attempt ${this.wsReconnectAttempts})`);
          }
          
          setTimeout(() => {
            this.connectToBackendLogs();
          }, delay);
        } else {
          this.info('websocket.backend', '📴 Backend logging service unavailable - operating in frontend-only mode');
        }
      };

    } catch (error) {
      this.error('websocket.backend', 'Failed to create WebSocket connection', { error });
      this.isConnecting = false;
    }
  }

  /**
   * Add a log entry
   */
  private addLog(entry: LogEntry, logToConsole: boolean = true) {
    // Add to internal logs
    this.logs.push(entry);

    // Maintain max logs limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.logListeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        // Prevent listener errors from breaking logging
      }
    });

    // Log to browser console if requested
    if (logToConsole && !entry.logger.startsWith('console.')) {
      const consoleMethod = entry.level === 'warn' ? 'warn' : 
                          entry.level === 'error' ? 'error' : 
                          entry.level === 'debug' ? 'debug' : 'info';
      
      const originalMethod = (console as any)[`original${consoleMethod.charAt(0).toUpperCase() + consoleMethod.slice(1)}`];
      if (originalMethod) {
        originalMethod(`[${entry.logger}] ${entry.message}`, entry.data || '');
      }
    }
  }

  /**
   * Create a log entry
   */
  private createLogEntry(level: LogEntry['level'], logger: string, message: string, data?: any): LogEntry {
    // Get caller information
    const stack = new Error().stack;
    const caller = this.parseStackTrace(stack);

    return {
      timestamp: new Date().toISOString(),
      level,
      logger: `frontend.${logger}`,
      message,
      module: caller.module,
      function: caller.function,
      line: caller.line,
      data
    };
  }

  /**
   * Parse stack trace to get caller information
   */
  private parseStackTrace(stack?: string): { module?: string; function?: string; line?: number } {
    if (!stack) return {};

    try {
      const lines = stack.split('\n');
      // Skip this function and the logging function
      const callerLine = lines[3] || lines[2] || '';
      
      // Extract function and file info
      const functionMatch = callerLine.match(/at\s+([^(]+)/);
      const locationMatch = callerLine.match(/\(([^:]+):(\d+):\d+\)|([^:]+):(\d+):\d+$/);
      
      const functionName = functionMatch?.[1]?.trim() || 'unknown';
      const fileName = locationMatch?.[1] || locationMatch?.[3] || 'unknown';
      const lineNumber = parseInt(locationMatch?.[2] || locationMatch?.[4] || '0', 10);
      
      return {
        module: fileName.split('/').pop()?.replace('.ts', '').replace('.tsx', '').replace('.js', '').replace('.jsx', ''),
        function: functionName,
        line: lineNumber || undefined
      };
    } catch {
      return {};
    }
  }

  /**
   * Logging methods
   */
  debug(logger: string, message: string, data?: any) {
    const entry = this.createLogEntry('debug', logger, message, data);
    this.addLog(entry);
  }

  info(logger: string, message: string, data?: any) {
    const entry = this.createLogEntry('info', logger, message, data);
    this.addLog(entry);
  }

  warn(logger: string, message: string, data?: any) {
    const entry = this.createLogEntry('warn', logger, message, data);
    this.addLog(entry);
  }

  error(logger: string, message: string, data?: any) {
    const entry = this.createLogEntry('error', logger, message, data);
    this.addLog(entry);
  }

  /**
   * Log user actions
   */
  logUserAction(action: string, details?: any) {
    this.info('user.action', `👤 ${action}`, details);
  }

  /**
   * Log API calls
   */
  logApiCall(method: string, url: string, status?: number, duration?: number, data?: any) {
    const level = status && status >= 400 ? 'error' : 'info';
    const message = `🌐 ${method} ${url}${status ? ` -> ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    this[level]('api.call', message, data);
  }

  /**
   * Log React component lifecycle
   */
  logComponentLifecycle(component: string, lifecycle: string, props?: any) {
    this.debug('react.lifecycle', `⚛️ ${component}.${lifecycle}`, props);
  }

  /**
   * Get logs
   */
  getLogs(filter?: { level?: LogEntry['level']; logger?: string; since?: string }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level);
      }
      if (filter.logger) {
        filteredLogs = filteredLogs.filter(log => log.logger.includes(filter.logger!));
      }
      if (filter.since) {
        const sinceDate = new Date(filter.since);
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= sinceDate);
      }
    }

    return filteredLogs;
  }

  /**
   * Get log statistics
   */
  getStats(): LogStats {
    const errorCount = this.logs.filter(log => log.level === 'error').length;
    const warningCount = this.logs.filter(log => log.level === 'warn').length;

    return {
      totalLogs: this.logs.length,
      errorCount,
      warningCount,
      sessionStart: this.sessionStart,
      lastClear: this.lastClear
    };
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
    this.lastClear = new Date().toISOString();
    this.info('logging.system', '🧹 Frontend logs cleared');
  }

  /**
   * Add log listener for real-time updates
   */
  addLogListener(listener: (log: LogEntry) => void) {
    this.logListeners.push(listener);
  }

  /**
   * Remove log listener
   */
  removeLogListener(listener: (log: LogEntry) => void) {
    const index = this.logListeners.indexOf(listener);
    if (index > -1) {
      this.logListeners.splice(index, 1);
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        sessionStart: this.sessionStart,
        totalLogs: this.logs.length,
        ...this.getStats()
      },
      logs: this.logs
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get WebSocket connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (!this.wsConnection) return 'disconnected';
    
    switch (this.wsConnection.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.CLOSED:
      case WebSocket.CLOSING:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * Manually reconnect to backend
   */
  reconnectToBackend() {
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    this.wsReconnectAttempts = 0;
    this.connectToBackendLogs();
  }
}

// Create and export the singleton instance
export const loggingService = new FrontendLoggingService();

// Export convenience functions
export const logger = {
  debug: (logger: string, message: string, data?: any) => loggingService.debug(logger, message, data),
  info: (logger: string, message: string, data?: any) => loggingService.info(logger, message, data),
  warn: (logger: string, message: string, data?: any) => loggingService.warn(logger, message, data),
  error: (logger: string, message: string, data?: any) => loggingService.error(logger, message, data),
  
  // Specialized logging functions
  userAction: (action: string, details?: any) => loggingService.logUserAction(action, details),
  apiCall: (method: string, url: string, status?: number, duration?: number, data?: any) => 
    loggingService.logApiCall(method, url, status, duration, data),
  componentLifecycle: (component: string, lifecycle: string, props?: any) => 
    loggingService.logComponentLifecycle(component, lifecycle, props)
};

export default loggingService;
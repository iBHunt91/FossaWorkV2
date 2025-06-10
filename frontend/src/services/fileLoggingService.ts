/**
 * File-based Logging Service for FossaWork V2 Frontend
 * Writes logs to files for AI debugging and testing purposes
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
  sessionId: string;
}

class FileLoggingService {
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBufferSize = 50; // Buffer logs before writing
  private flushIntervalMs = 5000; // Flush every 5 seconds

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeConsoleOverride();
    this.startPeriodicFlush();
    
    // Clear logs on page reload
    window.addEventListener('beforeunload', () => {
      this.flushLogs(true); // Force immediate flush
    });

    this.info('frontend.init', '🚀 File-based logging service initialized');
  }

  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `frontend-${timestamp}-${random}`;
  }

  private initializeConsoleOverride() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Store original methods for restoration if needed
    (window as any).__originalConsole = originalConsole;

    console.log = (...args: any[]) => {
      originalConsole.log(...args);
      this.debug('console.log', this.formatConsoleArgs(args));
    };

    console.info = (...args: any[]) => {
      originalConsole.info(...args);
      this.info('console.info', this.formatConsoleArgs(args));
    };

    console.warn = (...args: any[]) => {
      originalConsole.warn(...args);
      this.warn('console.warn', this.formatConsoleArgs(args));
    };

    console.error = (...args: any[]) => {
      originalConsole.error(...args);
      this.error('console.error', this.formatConsoleArgs(args));
    };

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

  private parseStackTrace(stack?: string): { module?: string; function?: string; line?: number } {
    if (!stack) return {};

    try {
      const lines = stack.split('\n');
      const callerLine = lines[3] || lines[2] || '';
      
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

  private createLogEntry(level: LogEntry['level'], logger: string, message: string, data?: any): LogEntry {
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
      data,
      sessionId: this.sessionId
    };
  }

  private addLog(entry: LogEntry) {
    this.logBuffer.push(entry);
    
    // Auto-flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushLogs();
    }
  }

  private async flushLogs(force = false) {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Send logs to backend for file writing
      const response = await fetch('http://localhost:8000/api/v1/logs/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToFlush,
          sessionId: this.sessionId,
          source: 'frontend'
        }),
      });

      if (!response.ok) {
        // If backend is not available, store logs locally
        this.storeLogsLocally(logsToFlush);
      }
    } catch (error) {
      // Backend not available, store locally
      this.storeLogsLocally(logsToFlush);
    }
  }

  private storeLogsLocally(logs: LogEntry[]) {
    try {
      // Store in localStorage as backup when backend unavailable
      const existingLogs = localStorage.getItem('fossawork_logs') || '[]';
      const allLogs = JSON.parse(existingLogs);
      allLogs.push(...logs);
      
      // Keep only last 1000 logs to prevent storage bloat
      const recentLogs = allLogs.slice(-1000);
      localStorage.setItem('fossawork_logs', JSON.stringify(recentLogs));
    } catch (error) {
      // If localStorage fails, at least log to console
      console.warn('Failed to store logs locally:', error);
    }
  }

  private startPeriodicFlush() {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, this.flushIntervalMs);
  }

  // Public logging methods
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

  // Specialized logging methods
  logUserAction(action: string, details?: any) {
    this.info('user.action', `👤 ${action}`, details);
  }

  logApiCall(method: string, url: string, status?: number, duration?: number, data?: any) {
    const level = status && status >= 400 ? 'error' : 'info';
    const message = `🌐 ${method} ${url}${status ? ` -> ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    this[level]('api.call', message, data);
  }

  logComponentLifecycle(component: string, lifecycle: string, props?: any) {
    this.debug('react.lifecycle', `⚛️ ${component}.${lifecycle}`, props);
  }

  logAutomationEvent(event: string, details?: any) {
    this.info('automation.event', `🤖 ${event}`, details);
  }

  logPerformanceMetric(metric: string, value: number, unit: string, details?: any) {
    this.debug('performance', `📊 ${metric}: ${value}${unit}`, { metric, value, unit, ...details });
  }

  // Cleanup method
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushLogs(true); // Final flush
  }

  // Get session info for debugging
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      bufferSize: this.logBuffer.length,
      maxBufferSize: this.maxBufferSize,
      flushInterval: this.flushIntervalMs
    };
  }
}

// Create and export the singleton instance
export const fileLoggingService = new FileLoggingService();

// Export convenience logger
export const logger = {
  debug: (logger: string, message: string, data?: any) => fileLoggingService.debug(logger, message, data),
  info: (logger: string, message: string, data?: any) => fileLoggingService.info(logger, message, data),
  warn: (logger: string, message: string, data?: any) => fileLoggingService.warn(logger, message, data),
  error: (logger: string, message: string, data?: any) => fileLoggingService.error(logger, message, data),
  
  // Specialized logging functions
  userAction: (action: string, details?: any) => fileLoggingService.logUserAction(action, details),
  apiCall: (method: string, url: string, status?: number, duration?: number, data?: any) => 
    fileLoggingService.logApiCall(method, url, status, duration, data),
  componentLifecycle: (component: string, lifecycle: string, props?: any) => 
    fileLoggingService.logComponentLifecycle(component, lifecycle, props),
  automationEvent: (event: string, details?: any) => 
    fileLoggingService.logAutomationEvent(event, details),
  performanceMetric: (metric: string, value: number, unit: string, details?: any) =>
    fileLoggingService.logPerformanceMetric(metric, value, unit, details)
};

export default fileLoggingService;
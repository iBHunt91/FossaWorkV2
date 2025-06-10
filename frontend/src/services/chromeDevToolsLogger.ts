/**
 * Chrome DevTools Logger for FossaWork V2
 * Captures console logs, network requests, and performance metrics from Chrome DevTools
 */

import { logger } from './fileLoggingService';

interface DevToolsLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: 'console' | 'network' | 'performance' | 'security' | 'devtools';
  message: string;
  data?: any;
  stack?: string;
}

class ChromeDevToolsLogger {
  private isInitialized = false;
  private performanceObserver?: PerformanceObserver;
  private networkLogs: any[] = [];

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    try {
      this.captureConsoleAPIMethods();
      this.captureNetworkRequests();
      this.capturePerformanceMetrics();
      this.captureSecurityEvents();
      this.captureUnhandledEvents();
      
      this.isInitialized = true;
      logger.info('devtools.init', '🔧 Chrome DevTools logging initialized');
    } catch (error) {
      logger.error('devtools.init', 'Failed to initialize Chrome DevTools logging', { error });
    }
  }

  /**
   * Capture Console API method calls (console.log, console.error, etc.)
   */
  private captureConsoleAPIMethods() {
    const originalConsole = { ...console };

    // Store original methods for restoration
    (window as any).__originalConsole = originalConsole;

    const logLevels = ['debug', 'log', 'info', 'warn', 'error', 'trace', 'assert'] as const;

    logLevels.forEach(level => {
      if (originalConsole[level]) {
        console[level] = (...args: any[]) => {
          // Call original method first
          originalConsole[level](...args);

          // Log to our system
          const message = this.formatConsoleArgs(args);
          const logLevel = level === 'log' ? 'info' : level === 'trace' ? 'debug' : level;
          
          this.logDevToolsEntry({
            level: logLevel as DevToolsLogEntry['level'],
            source: 'console',
            message: `[${level.toUpperCase()}] ${message}`,
            data: {
              method: level,
              args: args.map(arg => this.serializeArgument(arg)),
              stack: level === 'trace' ? new Error().stack : undefined
            }
          });
        };
      }
    });
  }

  /**
   * Capture network requests via fetch and XMLHttpRequest
   */
  private captureNetworkRequests() {
    // Capture fetch requests
    if (window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method || 'GET';
        const startTime = performance.now();

        try {
          const response = await originalFetch(input, init);
          const duration = performance.now() - startTime;

          this.logDevToolsEntry({
            level: response.ok ? 'info' : 'error',
            source: 'network',
            message: `🌐 ${method} ${url} -> ${response.status} (${duration.toFixed(1)}ms)`,
            data: {
              url,
              method,
              status: response.status,
              statusText: response.statusText,
              duration: Math.round(duration),
              headers: Object.fromEntries(response.headers.entries()),
              ok: response.ok
            }
          });

          return response;
        } catch (error) {
          const duration = performance.now() - startTime;
          
          this.logDevToolsEntry({
            level: 'error',
            source: 'network',
            message: `🌐 ${method} ${url} -> FAILED (${duration.toFixed(1)}ms)`,
            data: {
              url,
              method,
              duration: Math.round(duration),
              error: String(error)
            }
          });

          throw error;
        }
      };
    }

    // Capture XMLHttpRequest
    if (window.XMLHttpRequest) {
      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        let method = '';
        let url = '';
        let startTime = 0;

        xhr.open = function(m: string, u: string | URL, ...args: any[]) {
          method = m;
          url = typeof u === 'string' ? u : u.toString();
          return originalOpen.apply(this, [m, u, ...args]);
        };

        xhr.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
          startTime = performance.now();
          return originalSend.apply(this, [body]);
        };

        xhr.addEventListener('loadend', () => {
          const duration = performance.now() - startTime;
          const logger = ChromeDevToolsLogger.getInstance();
          
          logger.logDevToolsEntry({
            level: xhr.status >= 400 ? 'error' : 'info',
            source: 'network',
            message: `🌐 XHR ${method} ${url} -> ${xhr.status} (${duration.toFixed(1)}ms)`,
            data: {
              url,
              method,
              status: xhr.status,
              statusText: xhr.statusText,
              duration: Math.round(duration),
              readyState: xhr.readyState
            }
          });
        });

        return xhr;
      } as any;
    }
  }

  /**
   * Capture performance metrics
   */
  private capturePerformanceMetrics() {
    if ('PerformanceObserver' in window) {
      try {
        // Observe navigation timing
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          
          entries.forEach(entry => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.logDevToolsEntry({
                level: 'info',
                source: 'performance',
                message: `📊 Page navigation completed (${Math.round(navEntry.loadEventEnd)}ms)`,
                data: {
                  type: 'navigation',
                  duration: Math.round(navEntry.loadEventEnd),
                  domContentLoaded: Math.round(navEntry.domContentLoadedEventEnd),
                  firstPaint: Math.round(navEntry.loadEventStart),
                  url: navEntry.name
                }
              });
            } else if (entry.entryType === 'resource') {
              const resEntry = entry as PerformanceResourceTiming;
              if (resEntry.duration > 100) { // Only log slow resources
                this.logDevToolsEntry({
                  level: 'warn',
                  source: 'performance',
                  message: `⏱️ Slow resource load: ${resEntry.name} (${Math.round(resEntry.duration)}ms)`,
                  data: {
                    type: 'resource',
                    name: resEntry.name,
                    duration: Math.round(resEntry.duration),
                    size: resEntry.transferSize,
                    initiatorType: resEntry.initiatorType
                  }
                });
              }
            } else if (entry.entryType === 'measure') {
              this.logDevToolsEntry({
                level: 'debug',
                source: 'performance',
                message: `📏 Performance measure: ${entry.name} (${Math.round(entry.duration)}ms)`,
                data: {
                  type: 'measure',
                  name: entry.name,
                  duration: Math.round(entry.duration)
                }
              });
            }
          });
        });

        this.performanceObserver.observe({ 
          entryTypes: ['navigation', 'resource', 'measure', 'paint'] 
        });
      } catch (error) {
        logger.warn('devtools.performance', 'Failed to initialize performance observer', { error });
      }
    }
  }

  /**
   * Capture security-related events
   */
  private captureSecurityEvents() {
    // Capture Content Security Policy violations
    window.addEventListener('securitypolicyviolation', (event) => {
      this.logDevToolsEntry({
        level: 'error',
        source: 'security',
        message: `🚨 CSP Violation: ${event.violatedDirective}`,
        data: {
          blockedURI: event.blockedURI,
          violatedDirective: event.violatedDirective,
          originalPolicy: event.originalPolicy,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber
        }
      });
    });

    // Capture mixed content warnings
    if ('securityState' in navigator) {
      this.logDevToolsEntry({
        level: 'info',
        source: 'security',
        message: `🔒 Security state: ${(navigator as any).securityState || 'unknown'}`,
        data: {
          protocol: location.protocol,
          hostname: location.hostname,
          port: location.port
        }
      });
    }
  }

  /**
   * Capture unhandled errors and rejections
   */
  private captureUnhandledEvents() {
    // Unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logDevToolsEntry({
        level: 'error',
        source: 'console',
        message: `💥 Unhandled error: ${event.message}`,
        data: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        },
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logDevToolsEntry({
        level: 'error',
        source: 'console',
        message: `🚫 Unhandled promise rejection: ${event.reason}`,
        data: {
          reason: event.reason,
          stack: event.reason?.stack
        },
        stack: event.reason?.stack
      });
    });
  }

  /**
   * Log a DevTools entry
   */
  private logDevToolsEntry(entry: Omit<DevToolsLogEntry, 'timestamp'>) {
    const fullEntry: DevToolsLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Forward to main logging system
    logger[entry.level](`devtools.${entry.source}`, entry.message, entry.data);
  }

  /**
   * Format console arguments for logging
   */
  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => this.serializeArgument(arg)).join(' ');
  }

  /**
   * Serialize an argument for logging
   */
  private serializeArgument(arg: any): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
    
    try {
      return JSON.stringify(arg, null, 2);
    } catch (error) {
      return `[Object: ${Object.prototype.toString.call(arg)}]`;
    }
  }

  /**
   * Get singleton instance
   */
  private static instance?: ChromeDevToolsLogger;
  static getInstance(): ChromeDevToolsLogger {
    if (!this.instance) {
      this.instance = new ChromeDevToolsLogger();
    }
    return this.instance;
  }

  /**
   * Get current network logs
   */
  getNetworkLogs(): any[] {
    return [...this.networkLogs];
  }

  /**
   * Clear network logs
   */
  clearNetworkLogs(): void {
    this.networkLogs = [];
    this.logDevToolsEntry({
      level: 'info',
      source: 'devtools',
      message: '🧹 Network logs cleared'
    });
  }

  /**
   * Manually log a performance measure
   */
  logPerformanceMeasure(name: string, startMark?: string, endMark?: string): void {
    try {
      performance.measure(name, startMark, endMark);
      this.logDevToolsEntry({
        level: 'debug',
        source: 'performance',
        message: `📏 Manual performance measure: ${name}`,
        data: { name, startMark, endMark }
      });
    } catch (error) {
      this.logDevToolsEntry({
        level: 'error',
        source: 'performance',
        message: `❌ Failed to create performance measure: ${name}`,
        data: { name, error: String(error) }
      });
    }
  }

  /**
   * Destroy the logger and restore original methods
   */
  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // Restore original console methods
    if ((window as any).__originalConsole) {
      Object.assign(console, (window as any).__originalConsole);
    }

    this.isInitialized = false;
    logger.info('devtools.cleanup', '🧹 Chrome DevTools logger destroyed');
  }
}

// Create and export singleton instance
export const chromeDevToolsLogger = ChromeDevToolsLogger.getInstance();

export default chromeDevToolsLogger;
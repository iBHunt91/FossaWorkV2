/**
 * Memory monitoring and protection utilities for browser/Node.js
 */

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

class BrowserMemoryMonitor {
  private maxMemoryMB: number;
  private checkInterval: number;
  private warningThreshold: number;
  private isMonitoring: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    maxMemoryMB: number = 2048, // 2GB default for browser
    checkInterval: number = 30000, // 30 seconds
    warningThreshold: number = 0.8 // 80% warning
  ) {
    this.maxMemoryMB = maxMemoryMB;
    this.checkInterval = checkInterval;
    this.warningThreshold = warningThreshold;
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log(`🧠 Starting memory monitoring (max: ${this.maxMemoryMB}MB, interval: ${this.checkInterval/1000}s)`);
    
    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🧠 Memory monitoring stopped');
  }

  private checkMemory(): void {
    if (!('performance' in window) || !('memory' in window.performance)) {
      console.warn('🧠 Memory monitoring not supported in this browser');
      return;
    }

    const memory = (window.performance as any).memory as MemoryInfo;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
    
    const warningThresholdMB = this.maxMemoryMB * this.warningThreshold;
    
    if (usedMB > this.maxMemoryMB) {
      console.error(`🚨 Memory limit exceeded: ${usedMB.toFixed(1)}MB > ${this.maxMemoryMB}MB`);
      this.triggerMemoryCleanup();
    } else if (usedMB > warningThresholdMB) {
      console.warn(`⚠️ Memory usage high: ${usedMB.toFixed(1)}MB (warning: ${warningThresholdMB.toFixed(1)}MB)`);
      this.suggestCleanup();
    } else {
      console.debug(`🧠 Memory usage normal: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB limit`);
    }
  }

  private triggerMemoryCleanup(): void {
    console.log('🧹 Triggering aggressive memory cleanup...');
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
    
    // Clear caches
    this.clearCaches();
    
    // Dispatch custom event for app-specific cleanup
    window.dispatchEvent(new CustomEvent('memory-pressure', { 
      detail: { level: 'critical' } 
    }));
  }

  private suggestCleanup(): void {
    console.log('🧹 Suggesting memory cleanup...');
    
    // Dispatch custom event for app-specific cleanup
    window.dispatchEvent(new CustomEvent('memory-pressure', { 
      detail: { level: 'warning' } 
    }));
  }

  private clearCaches(): void {
    // Clear various browser caches
    try {
      // Clear console
      if ('clear' in console) {
        console.clear();
      }
      
      // Dispatch cache clear event
      window.dispatchEvent(new CustomEvent('clear-caches'));
      
    } catch (error) {
      console.warn('🧹 Could not clear some caches:', error);
    }
  }

  getMemoryInfo(): MemoryInfo | null {
    if (!('performance' in window) || !('memory' in window.performance)) {
      return null;
    }
    
    return (window.performance as any).memory as MemoryInfo;
  }
}

// Global instance
let memoryMonitor: BrowserMemoryMonitor | null = null;

export function setupMemoryMonitoring(
  maxMemoryMB: number = 2048,
  checkInterval: number = 30000
): BrowserMemoryMonitor {
  memoryMonitor = new BrowserMemoryMonitor(maxMemoryMB, checkInterval);
  return memoryMonitor;
}

export function startMemoryMonitoring(): void {
  if (memoryMonitor) {
    memoryMonitor.startMonitoring();
  } else {
    console.warn('🧠 Memory monitor not setup - call setupMemoryMonitoring first');
  }
}

export function stopMemoryMonitoring(): void {
  if (memoryMonitor) {
    memoryMonitor.stopMonitoring();
  }
}

export function getMemoryInfo(): MemoryInfo | null {
  return memoryMonitor?.getMemoryInfo() || null;
}

// React hook for memory monitoring
export function useMemoryMonitoring(maxMemoryMB: number = 2048) {
  const startMonitoring = () => {
    setupMemoryMonitoring(maxMemoryMB);
    startMemoryMonitoring();
  };

  const stopMonitoring = () => {
    stopMemoryMonitoring();
  };

  return { startMonitoring, stopMonitoring, getMemoryInfo };
}
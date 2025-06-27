/**
 * Filter Debug Utilities
 * Comprehensive debugging tools for filter data flow
 */

import { WorkOrder, FilterSummary } from '../types';

export interface DebugLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

class FilterDebugger {
  private logs: DebugLog[] = [];
  private isEnabled: boolean = import.meta.env.VITE_DEBUG_MODE === 'true' || 
                              localStorage.getItem('debugMode') === 'true';

  constructor() {
    if (this.isEnabled) {
      console.log('🔍 Filter Debugger Enabled');
    }
  }

  private log(level: DebugLog['level'], message: string, data?: any) {
    if (!this.isEnabled) return;

    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    this.logs.push(log);
    
    const style = {
      info: 'color: #2196F3',
      warn: 'color: #FF9800',
      error: 'color: #F44336',
      debug: 'color: #4CAF50'
    };

    console.log(`%c[${level.toUpperCase()}] ${message}`, style[level], data || '');
  }

  /**
   * Validate work order data structure
   */
  validateWorkOrder(workOrder: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.log('debug', 'Validating work order', workOrder);

    // Required fields
    if (!workOrder.workOrderId) {
      errors.push('Missing workOrderId');
    }
    
    if (!workOrder.serviceCode) {
      errors.push('Missing serviceCode');
    } else if (!['2861', '2862', '3002', '3146'].includes(workOrder.serviceCode)) {
      warnings.push(`Unexpected serviceCode: ${workOrder.serviceCode}`);
    }

    if (!workOrder.customerName) {
      warnings.push('Missing customerName');
    }

    if (!workOrder.address && !workOrder.street) {
      warnings.push('Missing address information');
    }

    // Service items validation
    if (!workOrder.serviceItems) {
      errors.push('Missing serviceItems');
    } else if (!Array.isArray(workOrder.serviceItems)) {
      errors.push('serviceItems must be an array');
    } else if (workOrder.serviceItems.length === 0) {
      warnings.push('Empty serviceItems array');
    }

    // Dispensers validation for AccuMeasure services
    if (['2861', '2862', '3002'].includes(workOrder.serviceCode)) {
      if (!workOrder.dispensers) {
        errors.push('Missing dispensers for AccuMeasure service');
      } else if (!Array.isArray(workOrder.dispensers)) {
        errors.push('dispensers must be an array');
      } else if (workOrder.dispensers.length === 0) {
        warnings.push('Empty dispensers array for AccuMeasure service');
      } else {
        // Validate each dispenser
        workOrder.dispensers.forEach((dispenser: any, index: number) => {
          if (!dispenser.dispenserNumber) {
            errors.push(`Dispenser ${index} missing dispenserNumber`);
          }
          if (!dispenser.product) {
            warnings.push(`Dispenser ${index} missing product`);
          }
          if (!dispenser.position) {
            warnings.push(`Dispenser ${index} missing position`);
          }
        });
      }
    }

    const isValid = errors.length === 0;
    this.log(isValid ? 'info' : 'error', 'Work order validation result', { errors, warnings });

    return { isValid, errors, warnings, data: workOrder };
  }

  /**
   * Validate multiple work orders
   */
  validateWorkOrders(workOrders: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validOrders: any[] = [];

    if (!Array.isArray(workOrders)) {
      errors.push('Work orders must be an array');
      return { isValid: false, errors, warnings };
    }

    workOrders.forEach((order, index) => {
      const result = this.validateWorkOrder(order);
      if (!result.isValid) {
        errors.push(`Order ${index} (${order.workOrderId || 'unknown'}): ${result.errors.join(', ')}`);
      } else {
        validOrders.push(order);
      }
      warnings.push(...result.warnings.map(w => `Order ${index}: ${w}`));
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: { total: workOrders.length, valid: validOrders.length }
    };
  }

  /**
   * Test API connectivity
   */
  async testAPIConnectivity(baseURL: string = ''): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const results: any = {};

    this.log('info', 'Testing API connectivity', { baseURL });

    try {
      // Test health endpoint
      const healthResponse = await fetch(`${baseURL}/api/health`);
      results.health = {
        status: healthResponse.status,
        ok: healthResponse.ok
      };

      if (!healthResponse.ok) {
        warnings.push(`Health check returned ${healthResponse.status}`);
      }

      // Test filter endpoint
      const filterResponse = await fetch(`${baseURL}/api/filters/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ workOrders: [] })
      });

      results.filters = {
        status: filterResponse.status,
        ok: filterResponse.ok
      };

      if (filterResponse.status === 401) {
        errors.push('Authentication failed - invalid or missing token');
      } else if (!filterResponse.ok) {
        warnings.push(`Filter endpoint returned ${filterResponse.status}`);
      }

      this.log('info', 'API connectivity test complete', results);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        data: results
      };
    } catch (error) {
      errors.push(`API connectivity test failed: ${error}`);
      this.log('error', 'API connectivity test error', error);
      
      return {
        isValid: false,
        errors,
        warnings,
        data: results
      };
    }
  }

  /**
   * Simulate filter calculation
   */
  simulateFilterCalculation(workOrders: WorkOrder[]): FilterSummary {
    this.log('info', 'Simulating filter calculation', { count: workOrders.length });

    const filterCounts: Record<string, number> = {};
    const processingDetails: any[] = [];

    workOrders.forEach(order => {
      const detail: any = {
        workOrderId: order.workOrderId,
        serviceCode: order.serviceCode,
        dispenserCount: order.dispensers?.length || 0,
        filters: {}
      };

      if (['2861', '2862', '3002'].includes(order.serviceCode)) {
        const dispenserCount = order.dispensers?.length || 0;
        
        // Standard filters for all AccuMeasure services
        detail.filters['Regular Filter'] = dispenserCount;
        detail.filters['DEF Filter'] = Math.ceil(dispenserCount / 2);
        
        filterCounts['Regular Filter'] = (filterCounts['Regular Filter'] || 0) + dispenserCount;
        filterCounts['DEF Filter'] = (filterCounts['DEF Filter'] || 0) + Math.ceil(dispenserCount / 2);

        // Additional filters for specific products
        order.dispensers?.forEach(dispenser => {
          if (dispenser.product?.toLowerCase().includes('diesel')) {
            detail.filters['Diesel Filter'] = (detail.filters['Diesel Filter'] || 0) + 1;
            filterCounts['Diesel Filter'] = (filterCounts['Diesel Filter'] || 0) + 1;
          }
          if (dispenser.product?.toLowerCase().includes('e85')) {
            detail.filters['E85 Filter'] = (detail.filters['E85 Filter'] || 0) + 1;
            filterCounts['E85 Filter'] = (filterCounts['E85 Filter'] || 0) + 1;
          }
        });
      } else if (order.serviceCode === '3146') {
        // Open Neck Prover
        detail.filters['Special Filter'] = 1;
        filterCounts['Special Filter'] = (filterCounts['Special Filter'] || 0) + 1;
      }

      processingDetails.push(detail);
    });

    const summary: FilterSummary = {
      filters: Object.entries(filterCounts).map(([type, quantity]) => ({
        filterType: type,
        quantity,
        partNumber: this.getPartNumber(type),
        lastUpdated: new Date().toISOString()
      })),
      totalWorkOrders: workOrders.length,
      lastCalculated: new Date().toISOString(),
      processingDetails
    };

    this.log('info', 'Filter calculation simulation complete', summary);
    return summary;
  }

  private getPartNumber(filterType: string): string {
    const partNumbers: Record<string, string> = {
      'Regular Filter': 'RF-001',
      'DEF Filter': 'DF-002',
      'Diesel Filter': 'DSL-003',
      'E85 Filter': 'E85-004',
      'Special Filter': 'SP-005'
    };
    return partNumbers[filterType] || 'UNKNOWN';
  }

  /**
   * Inspect data at specific step
   */
  inspectData(step: string, data: any): void {
    this.log('debug', `Data inspection at step: ${step}`, data);
    
    // Store in sessionStorage for inspection
    const inspectionKey = `filterDebug_${step}_${Date.now()}`;
    try {
      sessionStorage.setItem(inspectionKey, JSON.stringify(data));
      this.log('info', `Data stored for inspection: ${inspectionKey}`);
    } catch (error) {
      this.log('warn', 'Failed to store inspection data', error);
    }
  }

  /**
   * Get all debug logs
   */
  getLogs(): DebugLog[] {
    return [...this.logs];
  }

  /**
   * Clear debug logs
   */
  clearLogs(): void {
    this.logs = [];
    this.log('info', 'Debug logs cleared');
  }

  /**
   * Export debug data
   */
  exportDebugData(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      logs: this.logs,
      environment: {
        userAgent: navigator.userAgent,
        debugMode: this.isEnabled,
        baseURL: window.location.origin
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('debugMode', enabled.toString());
    this.log('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.isEnabled;
  }
}

// Create singleton instance
export const filterDebugger = new FilterDebugger();

// Export helper functions
export const validateWorkOrder = (workOrder: any) => filterDebugger.validateWorkOrder(workOrder);
export const validateWorkOrders = (workOrders: any[]) => filterDebugger.validateWorkOrders(workOrders);
export const testAPIConnectivity = (baseURL?: string) => filterDebugger.testAPIConnectivity(baseURL);
export const simulateFilterCalculation = (workOrders: WorkOrder[]) => filterDebugger.simulateFilterCalculation(workOrders);
export const inspectData = (step: string, data: any) => filterDebugger.inspectData(step, data);
export const getDebugLogs = () => filterDebugger.getLogs();
export const clearDebugLogs = () => filterDebugger.clearLogs();
export const exportDebugData = () => filterDebugger.exportDebugData();
export const setDebugMode = (enabled: boolean) => filterDebugger.setDebugMode(enabled);
export const isDebugEnabled = () => filterDebugger.isDebugEnabled();
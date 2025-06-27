import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  filterDebugger, 
  validateWorkOrder, 
  validateWorkOrders, 
  simulateFilterCalculation,
  setDebugMode,
  clearDebugLogs
} from '../filterDebug';

describe('FilterDebugger', () => {
  beforeEach(() => {
    setDebugMode(true);
    clearDebugLogs();
  });

  afterEach(() => {
    setDebugMode(false);
    clearDebugLogs();
  });

  describe('validateWorkOrder', () => {
    it('should validate a complete work order', () => {
      const workOrder = {
        workOrderId: 'W-123456',
        serviceCode: '2861',
        customerName: '7-Eleven Store #1234',
        address: '123 Main St',
        serviceItems: ['AccuMeasure'],
        dispensers: [
          {
            dispenserNumber: '1',
            product: 'Regular Unleaded',
            position: 'A'
          }
        ]
      };

      const result = validateWorkOrder(workOrder);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify missing required fields', () => {
      const workOrder = {
        // Missing workOrderId and serviceCode
        customerName: '7-Eleven Store #1234'
      };

      const result = validateWorkOrder(workOrder);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing workOrderId');
      expect(result.errors).toContain('Missing serviceCode');
    });

    it('should warn about AccuMeasure services without dispensers', () => {
      const workOrder = {
        workOrderId: 'W-123456',
        serviceCode: '2861', // AccuMeasure
        dispensers: [] // Empty dispensers
      };

      const result = validateWorkOrder(workOrder);
      
      expect(result.errors).toContain('AccuMeasure service missing dispensers');
    });

    it('should handle unknown service codes', () => {
      const workOrder = {
        workOrderId: 'W-123456',
        serviceCode: '9999', // Unknown service code
        dispensers: []
      };

      const result = validateWorkOrder(workOrder);
      
      expect(result.warnings).toContain('Unexpected serviceCode: 9999');
    });
  });

  describe('validateWorkOrders', () => {
    it('should validate multiple work orders', () => {
      const workOrders = [
        {
          workOrderId: 'W-123456',
          serviceCode: '2861',
          dispensers: [{ dispenserNumber: '1', product: 'Regular' }]
        },
        {
          workOrderId: 'W-789012',
          serviceCode: '3146',
          dispensers: []
        }
      ];

      const result = validateWorkOrders(workOrders);
      
      expect(result.isValid).toBe(true);
      expect(result.data.total).toBe(2);
      expect(result.data.valid).toBe(2);
    });

    it('should handle non-array input', () => {
      const result = validateWorkOrders({} as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Work orders must be an array');
    });
  });

  describe('simulateFilterCalculation', () => {
    it('should calculate filters for AccuMeasure services', () => {
      const workOrders = [
        {
          workOrderId: 'W-123456',
          serviceCode: '2861',
          dispensers: [
            { product: 'Regular Unleaded' },
            { product: 'Premium Unleaded' },
            { product: 'Diesel' }
          ]
        }
      ];

      const result = simulateFilterCalculation(workOrders as any);
      
      expect(result.filters).toBeDefined();
      expect(result.totalWorkOrders).toBe(1);
      
      const regularFilter = result.filters.find(f => f.filterType === 'Regular Filter');
      expect(regularFilter?.quantity).toBe(3);
      
      const dieselFilter = result.filters.find(f => f.filterType === 'Diesel Filter');
      expect(dieselFilter?.quantity).toBe(1);
    });

    it('should calculate filters for Open Neck Prover', () => {
      const workOrders = [
        {
          workOrderId: 'W-123456',
          serviceCode: '3146',
          dispensers: []
        }
      ];

      const result = simulateFilterCalculation(workOrders as any);
      
      const specialFilter = result.filters.find(f => f.filterType === 'Special Filter');
      expect(specialFilter?.quantity).toBe(1);
    });

    it('should handle empty work orders', () => {
      const result = simulateFilterCalculation([]);
      
      expect(result.filters).toHaveLength(0);
      expect(result.totalWorkOrders).toBe(0);
    });

    it('should detect E85 filters', () => {
      const workOrders = [
        {
          workOrderId: 'W-123456',
          serviceCode: '2861',
          dispensers: [
            { product: 'E85 Ethanol' },
            { product: 'Regular Unleaded' }
          ]
        }
      ];

      const result = simulateFilterCalculation(workOrders as any);
      
      const e85Filter = result.filters.find(f => f.filterType === 'E85 Filter');
      expect(e85Filter?.quantity).toBe(1);
    });
  });

  describe('debug logging', () => {
    it('should log debug information when enabled', () => {
      setDebugMode(true);
      
      const workOrder = {
        workOrderId: 'W-123456',
        serviceCode: '2861',
        dispensers: []
      };

      validateWorkOrder(workOrder);
      
      const logs = filterDebugger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      const debugLogs = logs.filter(log => log.level === 'debug');
      expect(debugLogs.length).toBeGreaterThan(0);
    });

    it('should not log when debug mode is disabled', () => {
      setDebugMode(false);
      
      const workOrder = {
        workOrderId: 'W-123456',
        serviceCode: '2861',
        dispensers: []
      };

      validateWorkOrder(workOrder);
      
      const logs = filterDebugger.getLogs();
      expect(logs.length).toBe(0);
    });
  });
});
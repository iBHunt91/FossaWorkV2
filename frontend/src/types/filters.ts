// Filter-related type definitions

// Use the existing WorkOrder type from api.ts but extend it for filter-specific fields
import { WorkOrder as BaseWorkOrder, Dispenser as BaseDispenser } from '../services/api';

export interface FilterWorkOrder extends BaseWorkOrder {
  jobId?: string; // Mapping from external_id
  storeNumber?: string; // Extracted from site_name or address
  storeName?: string; // Alias for site_name
  customerName?: string; // Extracted from customer info
  isMultiDay?: boolean;
  dayNumber?: number;
}

export interface FilterDispenser extends BaseDispenser {
  storeNumber?: string;
  position?: string;
  meterType?: string; // meter_type mapping
  fuelGrades?: FuelGrade[];
  lastUpdated?: string;
}

export interface FuelGrade {
  position: number;
  grade: string;
  productType: string;
  isBlend?: boolean;
}

export interface FilterSummary {
  partNumber: string;
  description: string;
  quantity: number;
  boxes: number;
  storeCount: number;
  filterType: 'gas' | 'diesel' | 'def' | 'other';
}

export interface FilterWarning {
  id: string;
  severity: number; // 1-10
  type: 'missing_data' | 'unknown_grade' | 'multi_day' | 'calculation_error' | 'config_issue' | 'info';
  message: string;
  affectedJobs: string[];
  suggestions?: string[];
  timestamp: string;
}

export interface FilterDetail {
  jobId: string;
  storeNumber: string;
  storeName: string;
  scheduledDate: string;
  customerName: string;
  serviceCode: string;
  serviceName?: string;
  address?: string;
  filters: {
    [partNumber: string]: {
      quantity: number;
      description: string;
      filterType: string;
      isEdited?: boolean;
      originalQuantity?: number;
    };
  };
  warnings?: string[];
  dispenserCount?: number;
  dispensers?: FilterDispenser[];
}

export interface FilterCalculationResult {
  summary: FilterSummary[];
  details: FilterDetail[];
  warnings: FilterWarning[];
  totalFilters: number;
  totalBoxes: number;
  metadata: {
    calculatedAt: string;
    weekStart: string;
    weekEnd: string;
    jobCount: number;
    storeCount: number;
  };
}

export interface FilterConfiguration {
  storeChains: {
    [chainName: string]: {
      filters: {
        gas: {
          [meterType: string]: string; // part number
        };
        diesel: string;
        dieselHighFlow?: string;
        def?: string;
      };
      boxSizes: {
        standard: number;
        def: number;
      };
    };
  };
  fuelGradeRules: {
    alwaysFilter: string[];
    neverFilter: string[];
    conditionalFilter: {
      [grade: string]: (grades: string[]) => boolean;
    };
  };
  specialCodes: {
    [code: string]: {
      name: string;
      requiresFilters: boolean;
      parseInstructions: boolean;
    };
  };
}

export interface FilterOverride {
  jobId: string;
  filterType: string;
  originalValue: number;
  newValue: number;
  reason?: string;
  timestamp: string;
  userId: string;
}
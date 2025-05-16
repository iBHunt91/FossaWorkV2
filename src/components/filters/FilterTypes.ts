import { WorkOrder, FilterNeed, FilterWarning } from '../../types';

/**
 * Interface defining the date ranges for work weeks
 * Used for date filtering and calculations
 */
export interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

/**
 * Data type for filter inventory items
 * Used in visualization and detail components
 */
export interface FilterDataType {
  id: string;
  type: 'GAS' | 'DIESEL' | 'DEF';
  quantity: number;
  visitDate: Date;
  store: string;
  visitId: string;
}

/**
 * Extended FilterNeed interface with additional properties
 * Extends the base FilterNeed with order/store-specific information
 */
export interface ExtendedFilterNeed extends FilterNeed {
  orderId: string;
  visitId: string;
  visitDate: string;
  storeName: string;
  stationType?: string;
  hasCompleteDispenserInfo?: boolean;
  warnings?: string[];
  hasWarnings?: boolean; // Flag for items that appear due to warnings
  isDefaulted?: boolean; // Flag for items using default values due to calculation issues
  isEdited?: boolean;    // Flag for items that have been manually edited
  isReverted?: boolean;  // Flag for items that have been reverted to original values
}

/**
 * Extended FilterWarning interface with additional properties
 * Extends the base FilterWarning with order/store-specific information
 */
export interface ExtendedFilterWarning extends FilterWarning {
  partNumber?: string;
  message?: string;
  severity?: number;
  orderId?: string;
  storeName?: string;
  visitDate?: string; // Added for date display
  grades?: string[]; // Array of specific grades with issues
}

/**
 * CSV export format for filter summary data
 * Used in the CSV download functionality
 */
export interface CSVFilterSummary {
  'Part Number': string;
  'Quantity': number | string;
  'Boxes Needed': number | string;
  'Stores': string;
  'Visit ID'?: string;
  'Date'?: string;
}

/**
 * Interface for dispenser information
 * Used in dispenser modal displays
 */
export interface Dispenser {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: Record<string, string>;
  html?: string;
}

/**
 * Sort configuration interface for tables
 * Used in the FilterDetailsPanel for sorting functionality
 */
export interface SortConfig {
  key: 'visitId' | 'store' | 'date';
  direction: 'asc' | 'desc';
}
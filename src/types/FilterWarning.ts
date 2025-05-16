// Basic filter warning interface from filterCalculation.ts
export interface FilterWarning {
  partNumber?: string;
  message?: string;
  severity?: number;
}

// Extended interface for filter warnings with additional properties we need
export interface ExtendedFilterWarning extends FilterWarning {
  orderId?: string;
  storeName?: string;
  missingDispenserData?: boolean;
}

// Updated UnifiedAutomationStatus interface with all required properties
export interface UnifiedAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  completedVisits?: number;
  totalVisits?: number;
  
  // Add missing properties that were causing TypeScript errors
  currentVisit?: string | null;
  visitName?: string;
  currentVisitName?: string;
  currentVisitStatus?: string;
  dispenserCount?: number;
  dispenserCurrent?: number;
  fuelType?: string; 
  fuelCurrent?: number;
  fuelTotal?: number;
  
  // Additional properties for completeness
  currentVisitFuelType?: string;
  currentVisitFuelCurrent?: number;
  currentVisitFuelTotal?: number;
  isBatch?: boolean;
  storeInfo?: {
    name: string;
    id?: string;
  };
  
  // User identification to prevent cross-user data access
  userId?: string | null;
  
  // Detailed dispenser progress information
  dispenserProgress?: {
    workOrderId?: string;
    dispensers: Array<{
      dispenserTitle: string;
      dispenserNumber?: string;
      formNumber: number;
      totalForms: number;
      status: 'pending' | 'processing' | 'completed' | 'error';
      fuelGrades: Array<{
        grade: string;
        status: 'pending' | 'processing' | 'completed' | 'error';
        prover?: string;
        meter?: string;
        message?: string;
      }>;
      currentAction?: string;
    }>;
  };
}

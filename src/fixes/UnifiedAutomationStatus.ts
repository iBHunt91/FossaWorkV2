// Add this to your types file or directly where the UnifiedAutomationStatus interface is defined

interface UnifiedAutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  completedVisits?: number;
  totalVisits?: number;
  
  // Add these missing properties that are causing TS errors
  currentVisit?: string | null;
  visitName?: string;
  currentVisitName?: string;
  currentVisitStatus?: string;
  dispenserCount?: number;
  dispenserCurrent?: number;
  fuelType?: string; 
  fuelCurrent?: number;
  fuelTotal?: number;
  
  // Add these for completeness (used elsewhere in your code)
  currentVisitFuelType?: string;
  currentVisitFuelCurrent?: number;
  currentVisitFuelTotal?: number;
  isBatch?: boolean;
  storeInfo?: {
    name: string;
    id?: string;
  };
}

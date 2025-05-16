export interface WorkOrder {
  id: string;
  type?: string; // FOSSA, ServiceChannel, etc.
  status?: string; // Open, In Progress, Completed, etc.
  priority?: string; // Low, Medium, High, Urgent
  trade?: string; // e.g., 'Fuel Systems'
  category?: string; // e.g., 'Repair'
  tutorial?: boolean; // Flag for tutorial data
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
      intersection?: string;
      cityState: string;
      county?: string;
    };
    storeUrl?: string; // Added for compatibility
  };
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  asset?: { // Details of the equipment or site asset
    id?: string;
    name?: string;
    type?: string;
    location?: string;
  };
  services: Array<{
    type: string; // e.g., Meter Calibration, Filter Change
    description?: string;
    quantity: number;
    code?: string; // Service code, if any
    notes?: string;
  }>;
  visits: {
    // Using a flexible structure for visits as it can vary
    // nextVisit is common, but past visits or scheduled visits might differ
    [key: string]: any; 
    // Example structure for nextVisit, adjust as needed based on actual data
    nextVisit?: {
      date: string; // "MM/DD/YYYY"
      time?: string; // "HH:MM AM/PM"
      technician?: string;
      visitId?: string;
    };
    scheduledDate?: string; // Could be here or top level
  };
  instructions?: string; // Special instructions for the job
  description?: string; // General description of the work order
  notes?: Array<{
    text: string;
    author?: string;
    timestamp?: string;
  }>;
  attachments?: Array<{
    fileName: string;
    url: string;
    type?: string; // e.g., 'image/jpeg', 'application/pdf'
  }>;
  financials?: {
    nte?: number; // Not to Exceed amount
    poNumber?: string;
    totalCost?: number;
    currency?: string;
  };
  // Timestamps
  createdDate?: string;
  receivedDate?: string; // When it was received/imported
  scheduledDate?: string; // If different from nextVisit.date
  completedDate?: string;
  lastUpdated?: string;

  // Optional fields from various sources or for internal use
  rawHtml?: string; // If sourced from HTML content
  sourceId?: string; // Original ID from the source system
  isPreventativeMaintenance?: boolean;
  isEmergency?: boolean;
  dispensers?: Array<{ // Added optional dispensers array
    title: string;
    serial?: string;
    make?: string;
    model?: string;
    fields?: {[key: string]: string};
    html?: string;
  }>;
  
  // Filter quantities information
  filterQuantities?: {
    gas?: number;
    diesel?: number;
    def?: number;
  };
} 
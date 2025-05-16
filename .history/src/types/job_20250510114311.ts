export interface Job {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  clientName: string;
  clientId: string;
  
  // Additional fields from WorkOrder
  storeNumber?: string;
  serviceTypes?: string[];
  instructions?: string;
  visitId?: string;
  dispensers?: Array<{ // Updated to detailed type, title now optional
    title?: string; // Changed to optional to match DispenserData from service
    serial?: string;
    make?: string;
    model?: string;
    fields?: {[key: string]: string};
    html?: string;
  }>;
  dispenserCount?: number; // Added dispenser count
  
  // Fields needed for map functionality
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface GeocodedJob extends Job {
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// Type to convert WorkOrder to Job
export interface WorkOrderData {
  id: string;
  workOrderId?: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
      intersection?: string;
      cityState: string;
      county?: string;
    };
    storeUrl?: string;
  };
  services?: Array<{
    type: string;
    quantity: number;
    description?: string;
    code?: string;
  }>;
  visits: {
    nextVisit?: {
      visitId?: string;
      date?: string;
      time?: string;
      url?: string;
      technician?: string;
    };
  };
  instructions?: string;
  rawHtml?: string;
  dispensers?: any[];
  scheduledDate?: string;
  nextVisitDate?: string;
  visitDate?: string;
  date?: string;
} 
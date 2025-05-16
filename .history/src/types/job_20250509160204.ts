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
  dispensers?: any[]; // Array of dispensers
  
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
    description: string;
    code: string;
  }>;
  visits: {
    nextVisit: {
      visitId: string;
      date: string;
      time: string;
      url: string;
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
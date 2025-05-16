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
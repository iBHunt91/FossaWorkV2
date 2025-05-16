import { Job, GeocodedJob, WorkOrderData } from '../types/job';
import mapboxgl from 'mapbox-gl';
import MapboxClient from '@mapbox/mapbox-sdk/lib/classes/mapi-client';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { getWorkOrders } from './scrapeService';
import { loadWorkOrders } from '../utils/dataLoader';

// Define types for geocoding service if not already defined
type GeocodingService = ReturnType<typeof MapboxGeocoding>;

// Replace with your Mapbox access token
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// Initialize Mapbox - only if token is provided
let mapboxClient: MapboxClient | undefined;
let geocodingService: GeocodingService | undefined;

try {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn('Mapbox access token not provided. Map functionality will be limited.');
  } else {
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    mapboxClient = new MapboxClient({ accessToken: MAPBOX_ACCESS_TOKEN });
    geocodingService = MapboxGeocoding(mapboxClient);
  }
} catch (error) {
  console.error('Error initializing Mapbox:', error);
}

// Mock data for testing - will be used as fallback if real data can't be loaded
const mockJobs: Job[] = [
  {
    id: '1',
    title: 'Maintenance Check',
    description: 'Regular maintenance check for HVAC system',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    scheduledDate: '2025-05-15',
    startTime: '09:00',
    endTime: '11:00',
    status: 'scheduled',
    clientName: 'ABC Corporation',
    clientId: 'abc123'
  },
  {
    id: '2',
    title: 'Repair Work',
    description: 'Fix broken window',
    address: '456 Park Ave',
    city: 'Boston',
    state: 'MA',
    zipCode: '02108',
    scheduledDate: '2025-05-16',
    startTime: '13:00',
    endTime: '15:00',
    status: 'scheduled',
    clientName: 'XYZ Company',
    clientId: 'xyz456'
  },
  {
    id: '3',
    title: 'Installation',
    description: 'Install new security system',
    address: '789 Oak St',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
    scheduledDate: '2025-05-17',
    startTime: '10:00',
    endTime: '14:00',
    status: 'scheduled',
    clientName: 'Security Plus',
    clientId: 'sec789'
  },
  {
    id: '4',
    title: 'Emergency Service',
    description: 'Water leak in basement',
    address: '101 Pine St',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94111',
    scheduledDate: '2025-05-15',
    startTime: '15:00',
    endTime: '17:00',
    status: 'scheduled',
    clientName: 'Coastal Properties',
    clientId: 'cp101'
  },
  {
    id: '5',
    title: 'Annual Inspection',
    description: 'Fire safety inspection',
    address: '202 Maple Ave',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98101',
    scheduledDate: '2025-05-22',
    startTime: '11:00',
    endTime: '13:00',
    status: 'scheduled',
    clientName: 'Northwest Building',
    clientId: 'nw202'
  }
];

/**
 * Convert WorkOrder to Job format
 */
const convertWorkOrderToJob = (workOrder: WorkOrderData): Job => {
  // Parse city and state from cityState
  let city = '';
  let state = '';
  let zipCode = '';
  
  // Handle cityState format which might be "City, State Zip" or "City, State"
  if (workOrder.customer.address.cityState) {
    // Try more comprehensive regex that can capture zip code as well
    const fullAddressMatch = workOrder.customer.address.cityState.match(/([^,]+),\s*(\w{2})\s*(\d{5})?/);
    
    if (fullAddressMatch) {
      city = fullAddressMatch[1].trim();
      state = fullAddressMatch[2].trim();
      zipCode = fullAddressMatch[3] ? fullAddressMatch[3].trim() : '';
    } else {
      // Fallback to basic parsing if the regex doesn't match
      const parts = workOrder.customer.address.cityState.split(',');
      if (parts.length >= 2) {
        city = parts[0].trim();
        
        // The second part might contain "State Zip"
        const stateZipParts = parts[1].trim().split(/\s+/);
        state = stateZipParts[0];
        if (stateZipParts.length > 1) {
          zipCode = stateZipParts[1];
        }
      }
    }
  }
  
  // Extract service types
  const serviceTypes = workOrder.services?.map(service => service.type) || [];
  
  // Extract time from visit data or default to a range
  const time = workOrder.visits?.nextVisit?.time || '';
  const [startTime, endTime] = time.includes('-') 
    ? time.split('-').map(t => t.trim()) 
    : [time, ''];
  
  // Get date
  const scheduledDate = workOrder.visits?.nextVisit?.date || 
    workOrder.scheduledDate || 
    workOrder.nextVisitDate || 
    workOrder.visitDate || 
    workOrder.date || 
    new Date().toISOString().split('T')[0];
  
  // Create a standardized job object
  return {
    id: workOrder.id,
    title: serviceTypes.length > 0 ? serviceTypes[0] : 'Service Visit',
    description: workOrder.services?.map(s => s.description).join(', ') || 'Work order service',
    address: workOrder.customer.address.street,
    city,
    state,
    zipCode,
    scheduledDate,
    startTime: startTime || '9:00',
    endTime: endTime || '17:00',
    status: 'scheduled', // Default to scheduled
    clientName: workOrder.customer.name,
    clientId: workOrder.customer.storeNumber,
    storeNumber: workOrder.customer.storeNumber,
    serviceTypes,
    instructions: workOrder.instructions,
    visitId: workOrder.visits?.nextVisit?.visitId
  };
};

/**
 * Geocode a job address to get coordinates
 */
export const geocodeJob = async (job: Job): Promise<Job> => {
  try {
    const fullAddress = `${job.address}, ${job.city}, ${job.state} ${job.zipCode}`;
    
    // Check if geocoding service is available
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn(`Geocoding service not available. Coordinates will be undefined for: ${fullAddress}`);
      return {
        ...job,
        coordinates: undefined // Ensure coordinates are undefined if token is missing
      };
    }
    
    // Use fetch directly instead of the Mapbox SDK to avoid client errors
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      
      return {
        ...job,
        coordinates: {
          latitude,
          longitude
        }
      };
    }
    
    throw new Error(`Could not geocode address: ${fullAddress}`);
  } catch (error) {
    console.error('Geocoding error:', error);
    // Return original job without coordinates if geocoding fails
    return {
      ...job,
      coordinates: undefined // Ensure coordinates are undefined on failure
    };
  }
};

/**
 * Fetch all jobs and geocode their addresses
 */
export const fetchJobs = async (): Promise<Job[]> => {
  try {
    let jobs: Job[] = [];
    
    // Try to fetch from scrapeService first
    try {
      const response = await getWorkOrders();
      if (response && response.workOrders && Array.isArray(response.workOrders)) {
        console.log('Successfully loaded work orders from API:', response.workOrders.length);
        jobs = response.workOrders.map(convertWorkOrderToJob);
      }
    } catch (apiError) {
      console.warn('Could not fetch from API, trying dataLoader...', apiError);
      
      // Try to fetch from dataLoader as fallback
      try {
        const workOrders = await loadWorkOrders();
        if (workOrders && Array.isArray(workOrders)) {
          console.log('Successfully loaded work orders from dataLoader:', workOrders.length);
          jobs = workOrders.map(convertWorkOrderToJob);
        }
      } catch (loaderError) {
        console.warn('Could not fetch from dataLoader, using mock data...', loaderError);
        // Fall back to mock data
        jobs = mockJobs;
      }
    }
    
    if (jobs.length === 0) {
      console.warn('No jobs found from API or dataLoader, using mock data.');
      jobs = mockJobs;
    }
    
    // Geocode all job addresses
    const geocodedJobs = await Promise.all(
      jobs.map(job => geocodeJob(job))
    );
    
    return geocodedJobs;
  } catch (error) {
    console.error('Error fetching jobs:', error);
    throw error;
  }
};

/**
 * Calculate route between two points
 */
export const getRoute = async (
  start: [number, number],
  end: [number, number]
): Promise<any> => {
  try {
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox access token not provided. Cannot calculate route.');
      throw new Error('Mapbox access token not provided');
    }
    
    const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`;
    
    const response = await fetch(query);
    const data = await response.json();
    
    if (data.code !== 'Ok') {
      throw new Error(`Direction API error: ${data.code}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error getting route:', error);
    throw error;
  }
};

/**
 * Calculate optimized route for multiple jobs
 */
export const getOptimizedRoute = async (jobs: GeocodedJob[]): Promise<any> => {
  try {
    if (jobs.length < 2) {
      throw new Error('At least 2 jobs are required to calculate a route');
    }

    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox access token not provided. Cannot calculate optimized route.');
      throw new Error('Mapbox access token not provided');
    }

    // Format coordinates for the API
    const coordinates = jobs.map(job => 
      `${job.coordinates.longitude},${job.coordinates.latitude}`
    ).join(';');

    const query = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?roundtrip=true&source=first&destination=last&steps=true&geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`;
    
    const response = await fetch(query);
    const data = await response.json();
    
    if (data.code !== 'Ok') {
      throw new Error(`Optimization API error: ${data.code}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error getting optimized route:', error);
    throw error;
  }
}; 
import { Job, GeocodedJob } from '../types/job';
import mapboxgl from 'mapbox-gl';
import MapboxClient from '@mapbox/mapbox-sdk/lib/classes/mapi-client';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

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

// Mock data for testing - replace with actual API call
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
 * Geocode a job address to get coordinates
 */
export const geocodeJob = async (job: Job): Promise<GeocodedJob> => {
  try {
    const fullAddress = `${job.address}, ${job.city}, ${job.state} ${job.zipCode}`;
    
    // Check if geocoding service is available
    if (!geocodingService || !MAPBOX_ACCESS_TOKEN) {
      console.warn(`Geocoding service not available. Using default coordinates for: ${fullAddress}`);
      return {
        ...job,
        coordinates: {
          // Default coordinates if geocoding fails
          latitude: 39.8283 + (Math.random() * 10 - 5), // Add some random spread for visual purposes
          longitude: -98.5795 + (Math.random() * 10 - 5)
        }
      };
    }
    
    const response = await geocodingService.forwardGeocode({
      query: fullAddress,
      limit: 1
    }).send();
    
    if (response && response.body && response.body.features && response.body.features.length > 0) {
      const [longitude, latitude] = response.body.features[0].center;
      
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
    // Return original job with default coordinates as fallback
    return {
      ...job,
      coordinates: {
        // Default to center of US if geocoding fails plus a random offset to visually separate jobs
        latitude: 39.8283 + (Math.random() * 10 - 5),
        longitude: -98.5795 + (Math.random() * 10 - 5)
      }
    };
  }
};

/**
 * Fetch all jobs and geocode their addresses
 */
export const fetchJobs = async (): Promise<GeocodedJob[]> => {
  try {
    // In a real application, you would fetch jobs from your API
    // const response = await fetch('/api/jobs');
    // const jobs = await response.json();
    
    // For now, use mock data
    const jobs = mockJobs;
    
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
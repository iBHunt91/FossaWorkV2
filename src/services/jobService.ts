import { Job, GeocodedJob } from '../types/job';
import { WorkOrder } from '../types/workOrder';
import mapboxgl from 'mapbox-gl';
import MapboxClient from '@mapbox/mapbox-sdk/lib/classes/mapi-client';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { getWorkOrders as getWorkOrdersFromScrapeService } from './scrapeService';
import { loadWorkOrders } from '../utils/dataLoader';
import { getDispensersForWorkOrder, DispenserData as ActualDispenserData } from './dispenserService';

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
const convertWorkOrderToJob = async (workOrder: WorkOrder): Promise<Job> => {
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
  
  // Get date - aligned with WorkOrder type from src/types/workOrder.ts
  const scheduledJobDate = workOrder.visits?.nextVisit?.date || 
    workOrder.scheduledDate || 
    new Date().toISOString().split('T')[0]; // Fallback to today if no other date is found
  
  // Fetch dispenser data
  let jobDispensers: ActualDispenserData['dispensers'] | undefined = undefined;
  let jobDispenserCount: number | undefined = undefined;

  try {
    const dispenserDataResult = await getDispensersForWorkOrder(workOrder.id);
    if (dispenserDataResult && dispenserDataResult.dispensers) {
      jobDispensers = dispenserDataResult.dispensers;
      jobDispenserCount = dispenserDataResult.dispensers.length;
    }
  } catch (error) {
    console.error(`Error fetching dispenser data for WO ${workOrder.id}:`, error);
    // Keep jobDispensers and jobDispenserCount as undefined
  }
  
  // Create a standardized job object
  return {
    id: workOrder.id,
    title: serviceTypes.length > 0 ? serviceTypes[0] : 'Service Visit',
    description: workOrder.services?.map(s => s.description).join(', ') || 'Work order service',
    address: workOrder.customer.address.street,
    city,
    state,
    zipCode,
    scheduledDate: scheduledJobDate, // Use the derived date
    startTime: startTime || '9:00',
    endTime: endTime || '17:00',
    status: 'scheduled', // Default to scheduled
    clientName: workOrder.customer.name,
    clientId: workOrder.customer.storeNumber,
    storeNumber: workOrder.customer.storeNumber,
    serviceTypes,
    instructions: workOrder.instructions,
    visitId: workOrder.visits?.nextVisit?.visitId,
    dispensers: jobDispensers, 
    dispenserCount: jobDispenserCount 
  };
};

/**
 * Clean and standardize an address to improve geocoding accuracy
 */
const cleanAddress = (address: string): string => {
  let cleaned = address;
  
  // Normalize multiple spaces and commas
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/,+/g, ',');
  cleaned = cleaned.replace(/\s+,/g, ',');
  cleaned = cleaned.replace(/,\s+/g, ', ');
  
  // Extract structured address components
  // This helps prevent issues with mixed or repeated parts
  const stateZipRegex = /\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i;
  const cityStateZipMatch = stateZipRegex.exec(cleaned);
  
  let cityClean = '', stateClean = '', zipClean = ''; // Renamed to avoid conflict with outer scope city, state, zipCode
  if (cityStateZipMatch) {
    // Find the city by looking for text before the state/zip
    const beforeStateZip = cleaned.substring(0, cityStateZipMatch.index).trim();
    const cityParts = beforeStateZip.split(',');
    if (cityParts.length > 0) {
      cityClean = cityParts[cityParts.length - 1].trim();
    }
    
    stateClean = cityStateZipMatch[1];
    zipClean = cityStateZipMatch[2];
    
    // Remove the state/zip and city from the string to clean the street address separately
    const streetPart = beforeStateZip.substring(0, beforeStateZip.length - cityClean.length).trim();
    cleaned = cleanStreetAddress(streetPart) + `, ${cityClean}, ${stateClean} ${zipClean}`;
  } else {
    // If we can't extract structured components, clean the whole string
    cleaned = cleanStreetAddress(cleaned);
  }
  
  return cleaned;
};

// Helper to clean just the street address portion
const cleanStreetAddress = (streetAddress: string): string => {
  let cleaned = streetAddress;
  
  // Remove duplicate street names and segments
  const segments = cleaned.split(/\s+/).filter(Boolean);
  const uniqueSegmentsList: string[] = [];
  const seenPhrases = new Set<string>();
  
  // Process segments to remove duplicated phrases
  for (let i = 0; i < segments.length; i++) {
    // Look for multi-word duplications (up to 4 words)
    let isDuplicate = false;
    for (let phraseLength = 1; phraseLength <= 4; phraseLength++) {
      if (i + phraseLength <= segments.length) {
        const phrase = segments.slice(i, i + phraseLength).join(' ').toLowerCase();
        if (seenPhrases.has(phrase)) {
          isDuplicate = true;
          break; // Skip this segment as it's part of a duplicate phrase
        }
        
        if (phraseLength === 1) { // Only add single words to seen phrases
          seenPhrases.add(phrase);
        }
      }
    }
    
    if (!isDuplicate) {
      uniqueSegmentsList.push(segments[i]);
    }
  }
  
  cleaned = uniqueSegmentsList.join(' ');
  
  // Replace @ with "and" or "at"
  cleaned = cleaned.replace(/@/g, 'and');
  
  // Remove any trailing commas or extra whitespace
  cleaned = cleaned.replace(/,+$/g, '').trim();
  
  // Handle common address formatting issues
  cleaned = cleaned
    .replace(/(\d+)\s*th/gi, '$1th') // Join numbers with suffixes (19 th -> 19th)
    .replace(/\b(N|S|E|W)\.?\s*(North|South|East|West)\b/gi, '$2') // Normalize N. North -> North
    .replace(/\bSt(reet)?\b/gi, 'Street')
    .replace(/\bAve(nue)?\b/gi, 'Avenue')
    .replace(/\bRd\b/gi, 'Road')
    .replace(/\bBlvd\b/gi, 'Boulevard');
    
  // Handle repeated directionals (North East repeated)
  const directionals = ['North', 'South', 'East', 'West', 'NE', 'NW', 'SE', 'SW'];
  directionals.forEach(dir => {
    // Find repeated directionals like "North East North East"
    const dirRegex = new RegExp(`\\b(${dir})\\b.*\\b\\1\\b`, 'gi');
    if (dirRegex.test(cleaned)) {
      // Keep only the first occurrence
      const firstIdx = cleaned.toLowerCase().indexOf(dir.toLowerCase());
      const modifiedStr = cleaned.substring(0, firstIdx + dir.length);
      const remainingStr = cleaned.substring(firstIdx + dir.length);
      // Remove subsequent occurrences
      cleaned = modifiedStr + remainingStr.replace(new RegExp(`\\b${dir}\\b`, 'gi'), '');
    }
  });
  
  // Final cleanup of any resulting multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Geocode a job address to get coordinates
 */
export const geocodeJob = async (job: Job): Promise<Job> => {
  try {
    // Check if geocoding service is available
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn(`Geocoding service not available. Coordinates will be undefined for: ${job.address}`);
      return {
        ...job,
        coordinates: undefined
      };
    }
    
    // Clean and standardize the full address
    let rawAddress = '';
    
    // Special case for Ruskin addresses that have issues
    if (job.address.includes('Ruskin FL') || 
        (job.city?.toLowerCase() === 'ruskin' && job.state?.toLowerCase() === 'fl')) {
      console.log('Using extra careful cleaning for Ruskin, FL address...');
      
      // Special case for the exact problematic format we identified
      if (job.address.includes('@30th St North East Ruskin FL')) {
        console.log('Found problematic Ruskin address format with @30th St - applying special handling');
        // Manually format the address for this specific case
        rawAddress = '3017 19th Avenue North East, Ruskin, FL 33570';
      } else {
        // Extract the core street address and reconstruct carefully
        const ruskinMatch = job.address.match(/(\d+.*?)(Ruskin FL \d+)/i);
        if (ruskinMatch) {
          const streetPart = ruskinMatch[1].trim();
          const cleanedStreet = cleanStreetAddress(streetPart);
          // Force a better format for Ruskin addresses
          rawAddress = `${cleanedStreet}, Ruskin, FL ${job.zipCode}`;
        } else {
          rawAddress = `${job.address}, ${job.city || ''}, ${job.state || ''} ${job.zipCode || ''}`;
        }
      }
    } else {
      // Normal case
      rawAddress = `${job.address}, ${job.city || ''}, ${job.state || ''} ${job.zipCode || ''}`;
    }
    
    const fullAddress = cleanAddress(rawAddress);
    
    // Add special logging for troublesome addresses
    if (rawAddress !== fullAddress) {
      console.log(`Geocoding CLEANED address: ${fullAddress}`);
      console.log(`Original address was: ${rawAddress}`);
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
    let workOrdersToProcess: WorkOrder[] = [];
    
    try {
      const response = await getWorkOrdersFromScrapeService();
      if (response && response.workOrders && Array.isArray(response.workOrders)) {
        console.log('Successfully loaded work orders from API (scrapeService):', response.workOrders.length);
        workOrdersToProcess = response.workOrders;
      }
    } catch (apiError) {
      console.warn('Could not fetch from API (scrapeService), trying dataLoader...', apiError);
      try {
        workOrdersToProcess = await loadWorkOrders();
        if (workOrdersToProcess && Array.isArray(workOrdersToProcess)) {
          console.log('Successfully loaded work orders from dataLoader:', workOrdersToProcess.length);
        }
      } catch (loaderError) {
        console.warn('Could not fetch from dataLoader, using mock jobs (converted to WorkOrder like structure for processing)...', loaderError);
        // Fall back to mock data if other sources fail. We need to adapt mockJobs to WorkOrder like structure for convertWorkOrderToJob
        // This is a simplification; ideally, mockJobs would already be WorkOrder[] or have a separate conversion.
        workOrdersToProcess = mockJobs.map(mj => ({...mj, customer: {name: mj.clientName, storeNumber: mj.clientId, address: {street: mj.address, cityState: `${mj.city}, ${mj.state} ${mj.zipCode}`}}, services: [{type: mj.title, quantity:1, description: mj.description}], visits: {nextVisit: {date: mj.scheduledDate, time: `${mj.startTime}-${mj.endTime}`}} })) as WorkOrder[];
      }
    }
    
    if (workOrdersToProcess.length === 0) {
      console.warn('No work orders found from any source, using mock jobs (converted).');
      workOrdersToProcess = mockJobs.map(mj => ({...mj, customer: {name: mj.clientName, storeNumber: mj.clientId, address: {street: mj.address, cityState: `${mj.city}, ${mj.state} ${mj.zipCode}`}}, services: [{type: mj.title, quantity:1, description: mj.description}], visits: {nextVisit: {date: mj.scheduledDate, time: `${mj.startTime}-${mj.endTime}`}} })) as WorkOrder[];
    }

    // Convert WorkOrder[] to Job[] with dispenser data
    const jobsWithDispenserDataPromises = workOrdersToProcess.map(convertWorkOrderToJob);
    let jobs: Job[] = await Promise.all(jobsWithDispenserDataPromises);
    
    // Geocode all job addresses
    // Note: If geocoding is very slow or rate-limited, consider geocoding only when a job is selected
    // or doing it in batches / on demand.
    const geocodedJobsPromises = jobs.map(job => geocodeJob(job));
    jobs = await Promise.all(geocodedJobsPromises);
    
    return jobs;
  } catch (error) {
    console.error('Error fetching jobs:', error);
    throw error; // Re-throw to allow JobMapView to catch and display an error state
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
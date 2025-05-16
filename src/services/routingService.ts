import { GeocodedJob } from '../types/job';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResponse {
  duration: number; // seconds
  distance: number; // meters
  geometry?: any;   // route geometry if needed for displaying the route
}

/**
 * Interface for custom map locations with all required fields
 * All properties must be serializable for storage
 */
export interface CustomLocation {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  // Prevent non-serializable properties from being added
  [key: string]: string | number | boolean | Coordinates | undefined;
}

// Helper to safely serialize any CustomLocation object
export const serializeLocation = (location: CustomLocation): string => {
  try {
    return JSON.stringify({
      id: String(location.id || ''),
      name: String(location.name || ''),
      address: String(location.address || ''),
      coordinates: {
        latitude: Number(location.coordinates?.latitude || 0),
        longitude: Number(location.coordinates?.longitude || 0)
      }
    });
  } catch (error) {
    console.error('Error serializing location:', error);
    return '{}';
  }
};

// Helper to safely deserialize a location string
export const deserializeLocation = (json: string): CustomLocation | null => {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    
    return {
      id: String(parsed.id || ''),
      name: String(parsed.name || ''),
      address: String(parsed.address || ''),
      coordinates: {
        latitude: Number(parsed.coordinates?.latitude || 0),
        longitude: Number(parsed.coordinates?.longitude || 0)
      }
    };
  } catch (error) {
    console.error('Error deserializing location:', error);
    return null;
  }
};

/**
 * A service for calculating routes and drive times between job locations
 * using the Mapbox Directions API.
 */
export const routingService = {
  /**
   * Calculate the estimated drive time between two job locations
   * 
   * @param origin The starting job location
   * @param destination The ending job location
   * @returns Promise with route information including duration and distance
   */
  calculateDriveTime: async (
    origin: GeocodedJob | CustomLocation,
    destination: GeocodedJob | CustomLocation
  ): Promise<RouteResponse> => {
    try {
      if (!origin.coordinates || !destination.coordinates) {
        throw new Error('Missing coordinates for origin or destination');
      }

      const { longitude: originLng, latitude: originLat } = origin.coordinates;
      const { longitude: destLng, latitude: destLat } = destination.coordinates;

      // Make sure coordinates are valid
      if (
        !isFinite(originLng) || !isFinite(originLat) ||
        !isFinite(destLng) || !isFinite(destLat) ||
        originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180 ||
        originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90
      ) {
        throw new Error('Invalid coordinates for route calculation');
      }

      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        throw new Error('Mapbox token is missing');
      }

      // Format coordinates for Mapbox Directions API
      const coordinates = `${originLng},${originLat};${destLng},${destLat}`;
      
      // Call Mapbox Directions API with driving profile
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `access_token=${mapboxToken}&` +
        `geometries=geojson&` +
        `overview=simplified`
      );

      if (!response.ok) {
        throw new Error(`Directions API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found between locations');
      }

      const route = data.routes[0];
      return {
        duration: route.duration, // seconds
        distance: route.distance, // meters
        geometry: route.geometry  // GeoJSON LineString
      };
    } catch (error) {
      console.error('Error calculating drive time:', error);
      throw error;
    }
  },
  
  /**
   * Calculate route with multiple stops between locations
   * 
   * @param stops Array of locations to visit in order
   * @returns Promise with combined route information
   */
  calculateMultiStopRoute: async (
    stops: Array<GeocodedJob | CustomLocation>
  ): Promise<RouteResponse> => {
    try {
      if (stops.length < 2) {
        throw new Error('At least two stops are required for a route');
      }

      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        throw new Error('Mapbox token is missing');
      }

      // Extract valid coordinates from all stops
      const validStops = stops.filter(stop => 
        stop.coordinates && 
        isFinite(stop.coordinates.longitude) && 
        isFinite(stop.coordinates.latitude) &&
        stop.coordinates.longitude >= -180 && 
        stop.coordinates.longitude <= 180 &&
        stop.coordinates.latitude >= -90 && 
        stop.coordinates.latitude <= 90
      );

      if (validStops.length < 2) {
        throw new Error('At least two valid locations are required');
      }

      // Format coordinates for Mapbox Directions API as semicolon-separated list
      const coordinates = validStops
        .map(stop => `${stop.coordinates.longitude},${stop.coordinates.latitude}`)
        .join(';');
      
      // Call Mapbox Directions API with driving profile
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
        `access_token=${mapboxToken}&` +
        `geometries=geojson&` +
        `steps=true&` +
        `overview=full`
      );

      if (!response.ok) {
        throw new Error(`Directions API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found for these locations');
      }

      const route = data.routes[0];
      return {
        duration: route.duration,
        distance: route.distance,
        geometry: route.geometry
      };
    } catch (error) {
      console.error('Error calculating multi-stop route:', error);
      throw error;
    }
  },

  /**
   * Geocode an address to coordinates using Mapbox
   * 
   * @param address Address to geocode
   * @returns Promise with coordinates
   */
  geocodeAddress: async (address: string): Promise<Coordinates> => {
    try {
      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        throw new Error('Mapbox token is missing');
      }

      // URL encode the address
      const encodedAddress = encodeURIComponent(address);
      
      // Call Mapbox Geocoding API
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
        `access_token=${mapboxToken}&` +
        `limit=1&` + // Limit to one result
        `types=address,poi,place` // Focus on addresses, points of interest, and places
      );

      if (!response.ok) {
        throw new Error(`Geocoding API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        throw new Error('No results found for this address');
      }

      // Get coordinates from first result [longitude, latitude]
      const [longitude, latitude] = data.features[0].center;
      
      return {
        latitude,
        longitude
      };
    } catch (error) {
      console.error('Error geocoding address:', error);
      throw error;
    }
  },

  /**
   * Calculate drive times between multiple jobs
   * 
   * @param jobs Array of jobs to calculate routes between
   * @returns Matrix of drive times between jobs
   */
  calculateDriveTimeMatrix: async (
    jobs: GeocodedJob[]
  ): Promise<{ [originId: string]: { [destinationId: string]: RouteResponse } }> => {
    const matrix: { [originId: string]: { [destinationId: string]: RouteResponse } } = {};
    
    // Only process jobs with valid coordinates
    const validJobs = jobs.filter(job => 
      job.coordinates && 
      isFinite(job.coordinates.latitude) && 
      isFinite(job.coordinates.longitude)
    );

    // Calculate drive times between each pair of jobs
    // This is a naive implementation that makes N² API calls
    // For production, consider using Mapbox Matrix API instead
    for (const origin of validJobs) {
      matrix[origin.id] = {};
      
      for (const destination of validJobs) {
        // Skip calculating route to self
        if (origin.id === destination.id) {
          matrix[origin.id][destination.id] = { 
            duration: 0, 
            distance: 0 
          };
          continue;
        }
        
        try {
          // Calculate route between this pair
          const route = await routingService.calculateDriveTime(origin, destination);
          matrix[origin.id][destination.id] = route;
        } catch (error) {
          console.error(`Error calculating route from ${origin.id} to ${destination.id}:`, error);
          // Set a fallback value
          matrix[origin.id][destination.id] = { 
            duration: -1, // -1 indicates calculation failed
            distance: -1 
          };
        }
      }
    }
    
    return matrix;
  },
  
  /**
   * Create a custom location from an address
   * 
   * @param name Name for the location
   * @param address Address string to geocode
   * @returns Promise with a CustomLocation object
   */
  createCustomLocation: async (name: string, address: string): Promise<CustomLocation> => {
    const coordinates = await routingService.geocodeAddress(address);
    const id = `custom-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    
    return {
      id,
      name,
      address,
      coordinates
    };
  },

  /**
   * Format drive time in a human-readable format
   * 
   * @param seconds Duration in seconds
   * @returns Formatted string (e.g., "1 hr 25 min" or "35 min")
   */
  formatDriveTime: (seconds: number): string => {
    if (seconds < 0) return 'N/A';
    if (seconds === 0) return '0 min';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60); // Rounding up to nearest minute
    
    if (hours > 0) {
      return `${hours} hr ${minutes > 0 ? `${minutes} min` : ''}`;
    }
    return `${minutes} min`;
  },
  
  /**
   * Format distance in a human-readable format
   * 
   * @param meters Distance in meters
   * @returns Formatted string (e.g., "42 miles" or "500 feet")
   */
  formatDistance: (meters: number): string => {
    if (meters < 0) return 'N/A';
    if (meters === 0) return '0 miles';
    
    // Convert to miles (1609.34 meters per mile)
    const miles = meters / 1609.34;
    
    if (miles < 0.1) {
      // For very short distances, show in feet
      const feet = Math.round(meters * 3.28084);
      return `${feet} feet`;
    } else if (miles < 10) {
      // For shorter distances, show with decimal
      return `${miles.toFixed(1)} miles`;
    } else {
      // For longer distances, round to whole number
      return `${Math.round(miles)} miles`;
    }
  }
};

export default routingService; 
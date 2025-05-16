import { GeocodedJob } from '../types/job';

interface RouteResponse {
  duration: number; // seconds
  distance: number; // meters
  geometry?: any;   // route geometry if needed for displaying the route
}

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
    origin: GeocodedJob,
    destination: GeocodedJob
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
  }
};

export default routingService; 
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeocodedJob } from '../../types/job';
import { FiMapPin } from 'react-icons/fi';
import routingService, { CustomLocation, RouteResponse } from '../../services/routingService';

interface JobMapProps {
  jobs: GeocodedJob[];
  selectedJob: GeocodedJob | null;
  onSelectJob: (job: GeocodedJob, source: 'map') => void;
  enableFlyTo: boolean;
}

export interface JobMapRef {
  triggerResize: () => void;
  fitToAllMarkers: () => void;
  showRouteBetweenJobs: (
    originJob: GeocodedJob | CustomLocation, 
    destinationJob: GeocodedJob | CustomLocation
  ) => Promise<string | null>;
  showMultiPointRoute: (
    waypoints: Array<GeocodedJob | CustomLocation>,
    routeResponse: RouteResponse
  ) => Promise<void>;
  clearRoute: () => void;
}

const JobMap = forwardRef<JobMapRef, JobMapProps>(({ jobs, selectedJob, onSelectJob, enableFlyTo }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ duration: number; distance: number } | null>(null);
  
  const prevSelectedJobIdRef = useRef<string | null>(null);

  // Define default marker styles at a higher scope
  const defaultMarkerStyle = {
    width: '30px',
    height: '30px',
    backgroundColor: '#0891b2', // Cyan-600
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
    border: '2px solid white',
    transition: 'transform 0.15s ease-out, boxShadow 0.15s ease-out',
    innerHTML: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    transform: '' // For hover reset
  };
  
  // Helper function to safely remove layers and sources
  const removeLayersAndSources = (mapInstance: mapboxgl.Map) => {
    // First remove all layers
    const layersToRemove = ['selected-job-highlight', 'selected-job-pulse', 'selected-job-outer', 'route-line'];
    layersToRemove.forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
    });
    
    // Then remove the sources after ensuring all layers are removed
    const sourcesToRemove = ['selected-job-point', 'route'];
    sourcesToRemove.forEach(sourceId => {
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    });
  };
  
  // Helper to remove just route related layers and sources
  const removeRouteDisplay = (mapInstance: mapboxgl.Map) => {
    // Remove route layer if it exists
    if (mapInstance.getLayer('route-line')) {
      mapInstance.removeLayer('route-line');
    }
    
    // Then remove route source
    if (mapInstance.getSource('route')) {
      mapInstance.removeSource('route');
    }
    
    // Clear route info state
    setRouteInfo(null);
  };
  
  useImperativeHandle(ref, () => ({
    triggerResize: () => {
      if (map.current && mapLoaded) {
        console.log('JobMap: Resizing map programmatically');
        map.current.resize();
      }
    },
    fitToAllMarkers: () => {
      const mapInstance = map.current;
      if (!mapInstance || !mapLoaded) {
        console.warn('JobMap: fitToAllMarkers called before map is ready.');
        return;
      }

      // Safely remove layers and sources
      removeLayersAndSources(mapInstance);

      if (jobs.length === 0) {
        console.log('JobMap: No jobs to fit bounds to. Setting default view.');
        mapInstance.flyTo({
          center: [-98.5795, 39.8283], // Center of US
          zoom: 3,
          essential: true,
        });
        return;
      }

      const bounds = new mapboxgl.LngLatBounds();
      let hasValidJobLocations = false;
      jobs.forEach(job => {
        if (job.coordinates) {
          const { longitude, latitude } = job.coordinates;
          if (isFinite(longitude) && isFinite(latitude) &&
              longitude >= -180 && longitude <= 180 &&
              latitude >= -90 && latitude <= 90) {
            bounds.extend([longitude, latitude]);
            hasValidJobLocations = true;
          } else {
            console.warn(`JobMap: Invalid coordinates for job ${job.id} in fitToAllMarkers.`);
          }
        }
      });

      if (hasValidJobLocations) {
        console.log('JobMap: Fitting map to all markers via fitToAllMarkers.');
        mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
      } else {
        console.warn('JobMap: No valid job locations to fit bounds to in fitToAllMarkers.');
         mapInstance.flyTo({ // Fallback if no valid jobs to bound
          center: [-98.5795, 39.8283],
          zoom: 3,
          essential: true
        });
      }
    },
    showRouteBetweenJobs: async (
      originJob: GeocodedJob | CustomLocation, 
      destinationJob: GeocodedJob | CustomLocation
    ) => {
      const mapInstance = map.current;
      if (!mapInstance || !mapLoaded) {
        console.warn('JobMap: showRouteBetweenJobs called before map is ready.');
        return null;
      }
      
      try {
        // First remove any existing route
        removeRouteDisplay(mapInstance);
        
        // Calculate the route between jobs
        const route = await routingService.calculateDriveTime(originJob, destinationJob);
        
        // Store route info for display
        setRouteInfo({
          duration: route.duration,
          distance: route.distance
        });
        
        // Add the route to the map if geometry is available
        if (route.geometry) {
          // Add a new source for the route
          mapInstance.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });
          
          // Add a new layer to display the route
          mapInstance.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#0066FF',
              'line-width': 5,
              'line-opacity': 0.75
            }
          });
          
          // Create bounds that include both job locations
          const bounds = new mapboxgl.LngLatBounds();
          
          if (originJob.coordinates && destinationJob.coordinates) {
            bounds.extend([originJob.coordinates.longitude, originJob.coordinates.latitude]);
            bounds.extend([destinationJob.coordinates.longitude, destinationJob.coordinates.latitude]);
            
            // Fit the map to the route
            mapInstance.fitBounds(bounds, { 
              padding: 100, 
              maxZoom: 15,
              duration: 1000 
            });
          }
          
          // Format and return the drive time as a string
          return `${routingService.formatDriveTime(route.duration)} (${routingService.formatDistance(route.distance)})`;
        }
        
        return routingService.formatDriveTime(route.duration);
      } catch (error) {
        console.error('Error showing route between jobs:', error);
        removeRouteDisplay(mapInstance);
        return null;
      }
    },
    showMultiPointRoute: async (
      waypoints: Array<GeocodedJob | CustomLocation>, 
      routeResponse: RouteResponse
    ) => {
      const mapInstance = map.current;
      if (!mapInstance || !mapLoaded) {
        console.warn('JobMap: showMultiPointRoute called before map is ready.');
        return;
      }
      
      try {
        // First remove any existing route
        removeRouteDisplay(mapInstance);
        
        // Store route info for display
        setRouteInfo({
          duration: routeResponse.duration,
          distance: routeResponse.distance
        });
        
        // Add the route to the map if geometry is available
        if (routeResponse.geometry) {
          // Add a new source for the route
          mapInstance.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: routeResponse.geometry
            }
          });
          
          // Add a new layer to display the route
          mapInstance.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#0066FF',
              'line-width': 5,
              'line-opacity': 0.75
            }
          });
          
          // Create bounds that include all waypoints
          const bounds = new mapboxgl.LngLatBounds();
          
          // Validate and add all waypoints to the bounds
          waypoints.forEach(waypoint => {
            if (waypoint && waypoint.coordinates) {
              const { longitude, latitude } = waypoint.coordinates;
              if (isFinite(longitude) && isFinite(latitude) &&
                  longitude >= -180 && longitude <= 180 &&
                  latitude >= -90 && latitude <= 90) {
                bounds.extend([longitude, latitude]);
              }
            }
          });
          
          // Fit the map to the route if we have valid bounds
          if (!bounds.isEmpty()) {
            mapInstance.fitBounds(bounds, { 
              padding: 100, 
              maxZoom: 15,
              duration: 1000 
            });
          }
        }
      } catch (error) {
        console.error('Error showing multi-point route:', error);
        removeRouteDisplay(mapInstance);
      }
    },
    clearRoute: () => {
      const mapInstance = map.current;
      if (!mapInstance || !mapLoaded) {
        console.warn('JobMap: clearRoute called before map is ready.');
        return;
      }
      
      // Remove route display from map
      removeRouteDisplay(mapInstance);
    }
  }));
  
  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainer.current) {
      console.error("Map container ref is not available");
      return;
    }
    
    // Skip if map is already initialized
    if (map.current) return;
    
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token is not provided. Please add VITE_MAPBOX_ACCESS_TOKEN to your environment variables.');
      setMapError("Missing Mapbox access token");
      return;
    }

    console.log("Initializing map with token:", mapboxToken.substring(0, 8) + "...");
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      console.log("Creating map instance");
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        attributionControl: false, // Remove attribution
        localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif",
        transformRequest: (url, resourceType) => {
          // Disable caching for tile requests to prevent CacheStorage errors
          if (resourceType === 'Tile') {
            return {
              url: url,
              headers: {
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
              }
            };
          }
        }
      });
      
      map.current = mapInstance;
      
      // Add navigation controls
      mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Set up custom error handler for map
      const mapErrorHandler = (e: ErrorEvent) => {
        // Filter out known CacheStorage errors that don't affect functionality
        if (e.error && (
            e.error.message.includes('CacheStorage') || 
            e.error.message.includes('cache') ||
            e.error.message.includes('Failed to fetch')
        )) {
          console.warn("Non-critical map error (caching related):", e.error.message);
          // Don't set map error state for cache issues
          return;
        }
        
        console.error("Mapbox error:", e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
      };
      
      // Set up tile error handler to silently fail on tile loading issues
      const tileErrorHandler = (e: any) => {
        if (e && e.tile) {
          console.warn("Tile load error. Will try to continue without this tile.");
          // Don't set map error state for tile loading issues
          // The map will just show empty areas where tiles fail to load
        }
      };
      
      mapInstance.on('error', mapErrorHandler);
      mapInstance.on('tileerror', tileErrorHandler);
      
      mapInstance.on('load', () => {
        console.log("Map loaded successfully");
        setMapLoaded(true);
      });
    } catch (error) {
      console.error("Error creating map:", error);
      setMapError(`Error initializing map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return () => {
      // Clean up on unmount
      console.log("Cleaning up map");
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Effect to handle selected job changes (highlighting and map movement)
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) {
      return;
    }

    // Safely remove existing layers and sources
    removeLayersAndSources(mapInstance);

    // If no job is selected, we're done
    if (!selectedJob || !selectedJob.coordinates) {
      return;
    }

    // Validate coordinates
    const { longitude, latitude } = selectedJob.coordinates;
    if (typeof longitude !== 'number' || typeof latitude !== 'number' ||
        !isFinite(longitude) || !isFinite(latitude) ||
        longitude < -180 || longitude > 180 ||
        latitude < -90 || latitude > 90) {
      console.error('JobMap: Invalid coordinates for selection highlight', selectedJob.coordinates);
      return;
    }

    // Add a GeoJSON source for the selected point
    mapInstance.addSource('selected-job-point', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        properties: {}
      }
    });

    // Add outer highlight circle first (this will be underneath)
    mapInstance.addLayer({
      id: 'selected-job-outer',
      type: 'circle',
      source: 'selected-job-point',
      paint: {
        'circle-radius': 30,
        'circle-color': '#FF0000',
        'circle-opacity': 0.3,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-opacity': 0.6
      }
    });

    // Add an inner highlight circle (more solid)
    mapInstance.addLayer({
      id: 'selected-job-highlight',
      type: 'circle',
      source: 'selected-job-point',
      paint: {
        'circle-radius': 15, 
        'circle-color': '#FF0000',
        'circle-opacity': 0.7,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-opacity': 0.9
      }
    });

    // Fly to the selected marker if enabled
    if (enableFlyTo) {
      console.log(`JobMap: Attempting flyTo with coordinates: [${longitude}, ${latitude}]`);
      mapInstance.flyTo({
        center: [longitude, latitude],
        zoom: 14,
        essential: true,
        duration: 1200
      });
    } else {
      console.log('JobMap: flyTo is disabled for this selection.');
    }

    // Update previous selected job ID
    prevSelectedJobIdRef.current = selectedJob.id;

  }, [selectedJob, mapLoaded, enableFlyTo]);
  
  // Add markers when jobs change or map loads
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) {
      console.log("Skipping marker update:", { 
        hasMap: !!mapInstance, 
        isMapLoaded: mapLoaded, 
        jobCount: jobs.length 
      });
      return;
    }
    
    console.log(`Adding ${jobs.length} markers to map`);
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Safely remove existing layers and sources
    removeLayersAndSources(mapInstance);
    
    // Create bounds to fit all markers
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;
    
    // If no jobs, set a default view and skip marker creation
    if (jobs.length === 0) {
      console.log("No jobs available, setting default view");
      mapInstance.flyTo({
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        essential: true
      });
      return;
    }
    
    // Add new markers for each job
    jobs.forEach(job => {
      if (!job.coordinates) {
        console.warn(`Job ${job.id} missing coordinates`);
        return;
      }
      
      // Validate coordinates are within reasonable bounds
      const { longitude, latitude } = job.coordinates;
      if (!isFinite(longitude) || !isFinite(latitude) || 
          longitude < -180 || longitude > 180 || 
          latitude < -90 || latitude > 90) {
        console.warn(`Job ${job.id} has invalid coordinates: (${latitude}, ${longitude})`);
        return;
      }
      
      try {
        // Create marker element
        const markerEl = document.createElement('div');
        
        // Apply default styles
        Object.assign(markerEl.style, {
          width: defaultMarkerStyle.width,
          height: defaultMarkerStyle.height,
          backgroundColor: defaultMarkerStyle.backgroundColor,
          borderRadius: defaultMarkerStyle.borderRadius,
          display: defaultMarkerStyle.display,
          alignItems: defaultMarkerStyle.alignItems,
          justifyContent: defaultMarkerStyle.justifyContent,
          cursor: defaultMarkerStyle.cursor,
          boxShadow: defaultMarkerStyle.boxShadow,
          border: defaultMarkerStyle.border,
          transition: defaultMarkerStyle.transition,
        });
        markerEl.innerHTML = defaultMarkerStyle.innerHTML;

        // Hover effects for non-selected markers
        markerEl.addEventListener('mouseenter', () => {
          if (selectedJob?.id !== job.id) { 
            markerEl.style.transform = 'scale(1.2)';
            markerEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
          }
        });

        markerEl.addEventListener('mouseleave', () => {
          if (selectedJob?.id !== job.id) { 
            markerEl.style.transform = defaultMarkerStyle.transform; // Reset to empty or specific default scale
            markerEl.style.boxShadow = defaultMarkerStyle.boxShadow;
          }
        });
        
        // Get store info for popup
        const storeName = job.clientName || 'Unknown Store';
        const storeNumber = job.storeNumber || 'N/A';
        const visitNumber = job.visitId || 'N/A';
        
        // Debug the dispensers data
        console.log(`Job ${job.id} full data:`, job);
        
        let dispenserCount = 'N/A';

        // Option 0: Prioritize direct dispenser data if available
        if (job.dispensers && Array.isArray(job.dispensers) && job.dispensers.length > 0) {
          dispenserCount = String(job.dispensers.length);
          console.log(`Job ${job.id} using dispenser count from job.dispensers: ${dispenserCount}`);
        } else {
          // Since dispensers field is undefined or empty, try to get dispenser count from serviceTypes
          console.log(`Job ${job.id} job.dispensers not available or empty, falling back to other methods.`);
          // Option 1: Try to find it in serviceTypes
          if (job.serviceTypes && Array.isArray(job.serviceTypes)) {
            // Look for service types that might indicate dispensers
            const dispenserServiceRegex = /dispenser|pump|fuel/i;
            const dispenserServices = job.serviceTypes.filter(service => 
              dispenserServiceRegex.test(service)
            );
            
            if (dispenserServices.length > 0) {
              dispenserCount = String(dispenserServices.length);
              console.log(`Found ${dispenserServices.length} dispenser services in serviceTypes:`, dispenserServices);
            }
          }
          
          // Option 2: Look for count in other properties or the description
          if (dispenserCount === 'N/A' && job.description) {
            const dispenserMatch = job.description.match(/(\d+)\s*dispenser/i);
            if (dispenserMatch && dispenserMatch[1]) {
              dispenserCount = dispenserMatch[1];
              console.log(`Found dispenser count in description: ${dispenserCount}`);
            }
          }
          
          // Option 3: Look for count in the instruction field
          if (dispenserCount === 'N/A' && job.instructions) {
            const dispenserMatch = job.instructions.match(/(\d+)\s*dispenser/i);
            if (dispenserMatch && dispenserMatch[1]) {
              dispenserCount = dispenserMatch[1];
              console.log(`Found dispenser count in instructions: ${dispenserCount}`);
            }
          }
        }
        
        // If still N/A after all other checks, consider if a default is truly needed
        // The original code had a hardcoded '4' for demo/testing.
        // This should be evaluated if it's necessary for production or if 'N/A' is acceptable.
        // For now, let's retain a fallback if all else fails, but log it clearly.
        if (dispenserCount === 'N/A') {
          // Consider if this fallback is appropriate or should be 'N/A' or 0
          dispenserCount = '0'; // Fallback to 0 if no other source found
          console.warn(`Job ${job.id}: Dispenser count not found through any method. Defaulting to ${dispenserCount}. Review job data if this is unexpected.`);
        }
        
        console.log(`Job ${job.id} final dispenser count:`, dispenserCount);
        
        // Create and store marker WITHOUT a popup
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([job.coordinates.longitude, job.coordinates.latitude])
          .addTo(mapInstance);
        
        // Store marker reference for later cleanup
        markersRef.current[job.id] = marker;
        
        // Add click event to marker
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            onSelectJob(job, 'map');
          });
        }
        
        // Extend bounds to include this marker
        bounds.extend([job.coordinates.longitude, job.coordinates.latitude]);
        hasValidBounds = true;
      } catch (error) {
        console.error(`Error adding marker for job ${job.id}:`, error);
      }
    });
    
    // Fit map to bounds with padding if there are markers
    if (hasValidBounds) {
      console.log("Fitting map to bounds");
      mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
    } else {
      console.warn("No valid bounds created from markers");
      
      // Fallback to default view when no valid bounds
      mapInstance.flyTo({
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        essential: true
      });
      
      // Add a small notice that disappears after 5 seconds
      const noticeEl = document.createElement('div');
      noticeEl.innerHTML = `
        <div style="position: absolute; top: 10px; left: 50%; transform: translateX(-50%); 
                    background-color: rgba(0,0,0,0.7); color: white; padding: 10px 20px;
                    border-radius: 20px; font-size: 14px; z-index: 999;">
          No job locations to display on map
        </div>
      `;
      mapContainer.current?.appendChild(noticeEl);
      
      // Remove the notice after 5 seconds
      setTimeout(() => {
        if (noticeEl && noticeEl.parentNode) {
          noticeEl.parentNode.removeChild(noticeEl);
        }
      }, 5000);
    }
  }, [jobs, mapLoaded]);
  
  // JSX for the component
  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Loading overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <FiMapPin className="w-10 h-10 mx-auto mb-2 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Map Error</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{mapError}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Please check your Mapbox access token and internet connection.
              The job list is still available for your reference.
            </p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {mapLoaded && !mapError && jobs.length === 0 && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
          <div className="text-center p-4">
            <FiMapPin className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-300">No locations to display</p>
          </div>
        </div>
      )}
      
      {/* Route information overlay */}
      {routeInfo && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10">
          <div className="text-center">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Drive Time</h4>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {routingService.formatDriveTime(routeInfo.duration)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(routeInfo.distance / 1609.34)} mi • {routingService.formatDriveTime(routeInfo.duration)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default JobMap; 
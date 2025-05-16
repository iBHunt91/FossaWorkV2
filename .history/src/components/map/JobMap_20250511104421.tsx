import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeocodedJob } from '../../types/job';
import { FiMapPin } from 'react-icons/fi';

interface JobMapProps {
  jobs: GeocodedJob[];
  selectedJob: GeocodedJob | null;
  onSelectJob: (job: GeocodedJob) => void;
}

export interface JobMapRef {
  triggerResize: () => void;
}

const JobMap = forwardRef<JobMapRef, JobMapProps>(({ jobs, selectedJob, onSelectJob }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // Keep track of previous selected job to avoid unnecessary updates
  const prevSelectedJobIdRef = useRef<string | null>(null);
  
  useImperativeHandle(ref, () => ({
    triggerResize: () => {
      if (map.current && mapLoaded) {
        console.log('JobMap: Resizing map programmatically');
        map.current.resize();
      }
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
        attributionControl: false // Remove attribution
      });
      
      map.current = mapInstance;
      
      mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      mapInstance.on('load', () => {
        console.log("Map loaded successfully");
        setMapLoaded(true);
      });
      
      mapInstance.on('error', (e) => {
        console.error("Mapbox error:", e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
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
        
        // Style marker
        markerEl.style.width = '24px';
        markerEl.style.height = '24px';
        markerEl.style.backgroundColor = '#3b82f6'; // Blue default
        markerEl.style.borderRadius = '50%';
        markerEl.style.display = 'flex';
        markerEl.style.alignItems = 'center';
        markerEl.style.justifyContent = 'center';
        markerEl.style.cursor = 'pointer';
        markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
        markerEl.style.border = '2px solid white';
        markerEl.innerHTML = '<span style="color: white; font-size: 12px; font-weight: bold;">●</span>';
        
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
            onSelectJob(job);
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
  
  // Effect to handle selected job changes (highlighting and map movement)
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded || !markersRef.current) {
      return;
    }

    // Reset previously selected marker (if any and it's different from current)
    if (prevSelectedJobIdRef.current && prevSelectedJobIdRef.current !== selectedJob?.id) {
      const prevMarker = markersRef.current[prevSelectedJobIdRef.current];
      if (prevMarker) {
        const prevMarkerEl = prevMarker.getElement();
        // Reset to default style
        prevMarkerEl.style.backgroundColor = '#3b82f6'; // Default blue
        prevMarkerEl.style.border = '2px solid white';
        prevMarkerEl.style.width = '24px';
        prevMarkerEl.style.height = '24px';
        // Reset inner content if it was changed
        prevMarkerEl.innerHTML = '<span style="color: white; font-size: 12px; font-weight: bold;">●</span>';
         // Reset z-index if changed
        prevMarkerEl.style.zIndex = '';
      }
    }

    // Highlight the current selected marker
    if (selectedJob && selectedJob.coordinates) {
      const currentMarker = markersRef.current[selectedJob.id];
      if (currentMarker) {
        const currentMarkerEl = currentMarker.getElement();
        // Apply selected style
        currentMarkerEl.style.backgroundColor = '#f59e0b'; // Amber for selected
        currentMarkerEl.style.border = '2px solid #fff'; // White border
        currentMarkerEl.style.width = '30px'; // Slightly larger
        currentMarkerEl.style.height = '30px';
        currentMarkerEl.innerHTML = '<span style="color: white; font-size: 14px; font-weight: bold;">★</span>'; // Star icon
        currentMarkerEl.style.zIndex = '10'; // Bring to front

        // Pan and zoom to the selected marker
        mapInstance.flyTo({
          center: [selectedJob.coordinates.longitude, selectedJob.coordinates.latitude],
          zoom: 14, // Adjust zoom level as desired
          essential: true,
          duration: 1200
        });
      }
    }

    // Update previous selected job ID
    prevSelectedJobIdRef.current = selectedJob ? selectedJob.id : null;

  }, [selectedJob, mapLoaded]);
  
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
    </div>
  );
});

export default JobMap; 
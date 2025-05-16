import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeocodedJob } from '../../types/job';
import { FiMapPin } from 'react-icons/fi';

interface JobMapProps {
  jobs: GeocodedJob[];
  selectedJob: GeocodedJob | null;
  onSelectJob: (job: GeocodedJob) => void;
}

const JobMap: React.FC<JobMapProps> = ({ jobs, selectedJob, onSelectJob }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // Keep track of previous selected job to avoid unnecessary updates
  const prevSelectedJobRef = useRef<string | null>(null);
  
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
    if (!mapInstance || !mapLoaded || jobs.length === 0) {
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
    
    // Add new markers for each job
    jobs.forEach(job => {
      if (!job.coordinates) {
        console.warn(`Job ${job.id} missing coordinates`);
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
        markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        markerEl.innerHTML = '<span style="color: white; font-size: 12px;">●</span>';
        
        // Get store info for popup
        const storeName = job.clientName || 'Unknown Store';
        const storeNumber = job.storeNumber || 'N/A';
        const visitNumber = job.visitId || 'N/A';
        
        // Improved dispenser count logic
        let dispenserCount = 'N/A';
        if (job.dispensers) {
          if (Array.isArray(job.dispensers)) {
            dispenserCount = String(job.dispensers.length);
          } else if (typeof job.dispensers === 'number') {
            dispenserCount = String(job.dispensers);
          }
        }
        
        // Create popup with job info
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '300px',
          offset: 25
        }).setHTML(`
          <div style="padding: 12px; font-family: system-ui, sans-serif;">
            <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #1e3a8a;">${storeName}</h3>
            <div style="font-size: 14px; color: #4b5563; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 500;">Store Number:</span>
                <span>${storeNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 500;">Visit Number:</span>
                <span>${visitNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 500;">Dispenser Count:</span>
                <span>${dispenserCount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #6b7280;">
                <span style="font-weight: 500;">Address:</span>
                <span style="text-align: right;">${job.address}, ${job.city}, ${job.state}</span>
              </div>
            </div>
          </div>
        `);
        
        // Create and store marker
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([job.coordinates.longitude, job.coordinates.latitude])
          .setPopup(popup)
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
      try {
        mapInstance.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15
        });
      } catch (error) {
        console.error("Error fitting bounds:", error);
      }
    } else {
      console.warn("No valid bounds created from markers");
    }
  }, [jobs, mapLoaded]);
  
  // Update marker when selected job changes
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;
    
    // Skip update if selected job didn't change
    const selectedJobId = selectedJob?.id || null;
    if (prevSelectedJobRef.current === selectedJobId) return;
    
    prevSelectedJobRef.current = selectedJobId;
    
    console.log("Updating selected marker:", selectedJobId);
    
    // Reset all markers to default style and remove popups
    Object.entries(markersRef.current).forEach(([jobId, marker]) => {
      try {
        const element = marker.getElement();
        if (element) {
          element.style.border = 'none';
          element.style.zIndex = '0';
          element.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        }
        
        const popup = marker.getPopup();
        if (popup && popup.isOpen()) {
          popup.remove();
        }
      } catch (error) {
        console.error(`Error resetting marker ${jobId}:`, error);
      }
    });
    
    // Highlight selected marker and show popup
    if (selectedJob && selectedJob.id in markersRef.current) {
      const marker = markersRef.current[selectedJob.id];
      try {
        // Style the selected marker
        const element = marker.getElement();
        if (element) {
          element.style.border = '3px solid white';
          element.style.zIndex = '10';
          element.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5), 0 3px 6px rgba(0,0,0,0.3)';
        }
        
        // Open the popup
        const popup = marker.getPopup();
        if (popup) {
          popup.addTo(mapInstance);
        }
        
        // Pan map to center on selected marker
        mapInstance.flyTo({
          center: [selectedJob.coordinates.longitude, selectedJob.coordinates.latitude],
          zoom: 14,
          essential: true,
          duration: 1000 // Smooth animation
        });
      } catch (error) {
        console.error(`Error highlighting selected marker ${selectedJob.id}:`, error);
      }
    }
  }, [selectedJob, mapLoaded]);
  
  // JSX for the component
  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full" 
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
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
};

export default JobMap; 
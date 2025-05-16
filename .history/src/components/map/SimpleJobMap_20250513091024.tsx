import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FiMapPin } from 'react-icons/fi';

// Define the structure for location objects
interface Location {
  id: string;
  lat: number;
  lng: number;
  title: string;
  storeType?: string;
}

interface SimpleJobMapProps {
  locations: Location[];
  detailedView?: boolean;
}

const SimpleJobMap: React.FC<SimpleJobMapProps> = ({ locations, detailedView = false }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // Debug logging for props
  useEffect(() => {
    console.log('SimpleJobMap: Component received locations:', locations.length);
    if (locations.length > 0) {
      console.log('SimpleJobMap: First location sample:', locations[0]);
    }
  }, [locations]);

  // Initialize map when component mounts
  useEffect(() => {
    // Get Mapbox access token from environment variable
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZm9zc2Ftb25pdG9yIiwiYSI6ImNsbWFmejV6MmMwM3V5MnBueHY3MWNuY3oifQ.bTTJUC2Uth_QzluhUiNKmw';
    
    console.log("SimpleJobMap: Initializing map with token:", mapboxToken.substring(0, 8) + "...");
    
    try {
      // Skip if map is already initialized or container is missing
      if (map.current || !mapContainer.current) {
        console.log("SimpleJobMap: Map already initialized or container missing");
        return;
      }
      
      // Initialize Mapbox
      mapboxgl.accessToken = mapboxToken;
      
      // Verify if token is valid by checking if mapboxgl is properly configured
      if (!mapboxgl.accessToken || mapboxgl.accessToken === '') {
        throw new Error('Invalid Mapbox access token');
      }
      
      // Create map instance with more robust error handling
      console.log("SimpleJobMap: Creating new map instance");
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        attributionControl: false,
        preserveDrawingBuffer: true, // Help with rendering issues
        transformRequest: (url, resourceType) => {
          // Disable caching for tile requests to prevent CacheStorage errors
          if (resourceType === 'Tile') {
            return {
              url: url,
              headers: {
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
              }
            } as any;
          }
          return { url };
        }
      });
      
      map.current = mapInstance;
      
      // Add navigation controls if detailed view
      if (detailedView) {
        mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      }
      
      // Add more robust handling of map initialization events
      mapInstance.on('render', () => {
        if (!mapLoaded && mapInstance.loaded()) {
          console.log("SimpleJobMap: Map rendered and loaded");
        }
      });
      
      // Handle map load event
      mapInstance.on('load', () => {
        console.log("SimpleJobMap: Map loaded successfully");
        setMapLoaded(true);
      });
      
      // Force a resize and rerender after a short delay
      // This helps with scenarios where the container might not be fully sized initially
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
          console.log("SimpleJobMap: Triggered delayed resize");
        }
      }, 200);
      
      // Set up custom error handler for map
      const mapErrorHandler = (e: mapboxgl.ErrorEvent) => {
        // Filter out known non-critical errors
        if (e.error && (
            e.error.message.includes('CacheStorage') || 
            e.error.message.includes('cache') ||
            e.error.message.includes('Failed to fetch')
        )) {
          console.warn("SimpleJobMap: Non-critical map error:", e.error.message);
          return;
        }
        
        console.error("SimpleJobMap: Map error:", e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
      };
      
      // Set up tile error handler
      const tileErrorHandler = (e: any) => {
        if (e && e.tile) {
          console.warn("SimpleJobMap: Tile load error. Will continue without this tile.");
        }
      };
      
      mapInstance.on('error', mapErrorHandler);
      mapInstance.on('tileerror', tileErrorHandler);
      
    } catch (error) {
      console.error("SimpleJobMap: Failed to initialize map:", error);
      setMapError(`Error initializing map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Cleanup on unmount
    return () => {
      console.log("SimpleJobMap: Cleaning up map");
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [detailedView]);
  
  // Update markers when locations or map state changes
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) {
      console.log("SimpleJobMap: Skipping marker update:", { 
        hasMap: !!mapInstance, 
        isMapLoaded: mapLoaded, 
        locationCount: locations.length 
      });
      return;
    }
    
    console.log(`SimpleJobMap: Adding ${locations.length} markers to map`);
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // No locations - show default view
    if (locations.length === 0) {
      console.log("SimpleJobMap: No locations available, setting default view");
      mapInstance.flyTo({
        center: [-98.5795, 39.8283],
        zoom: 3,
        essential: true
      });
      return;
    }
    
    // Add markers for each location and build bounds
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;
    let validMarkersCount = 0;
    
    locations.forEach(location => {
      // Skip invalid locations
      if (!location || !location.id || !isFinite(location.lat) || !isFinite(location.lng)) {
        console.warn(`SimpleJobMap: Skipping invalid location: ${location?.id || 'unknown'}`);
        return;
      }
      
      // Validate coordinates
      if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
        console.warn(`SimpleJobMap: Skipping location with invalid coordinates: ${location.id} (${location.lat}, ${location.lng})`);
        return;
      }
      
      try {
        // Determine if this is likely a real or fallback location
        // If the title contains the word "Order" and coordinates are round numbers, likely fallback
        const isProbablyFallbackLocation = 
          location.title.includes("Order W-") && 
          (Math.abs(location.lat - Math.round(location.lat)) < 0.1 || 
           Math.abs(location.lng - Math.round(location.lng)) < 0.1);
          
        // Create marker element with visual distinction for fallback locations
        const markerEl = document.createElement('div');
        Object.assign(markerEl.style, {
          width: '28px', // Increased size for better visibility
          height: '28px',
          backgroundColor: isProbablyFallbackLocation 
            ? 'rgba(180, 180, 180, 0.8)' // Gray for fallback locations
            : getColorForStoreType(location.storeType),
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: isProbablyFallbackLocation
            ? '0 2px 5px rgba(0,0,0,0.4)' // Less prominent shadow for fallback
            : '0 3px 8px rgba(0,0,0,0.6)', // Enhanced shadow for real locations
          border: isProbablyFallbackLocation
            ? '2px dashed white' // Dashed border for fallback
            : '2.5px solid white', // Thicker border for real locations
          transition: 'transform 0.15s ease-out',
          zIndex: '10', // Ensure markers are above map layers
        });
        
        // Add pin icon inside marker with different style based on location authenticity
        markerEl.innerHTML = isProbablyFallbackLocation
          ? '<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
          : '<svg viewBox="0 0 24 24" width="16" height="16" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        
        // Add hover effects
        markerEl.addEventListener('mouseenter', () => {
          markerEl.style.transform = 'scale(1.2)';
        });
        
        markerEl.addEventListener('mouseleave', () => {
          markerEl.style.transform = '';
        });
        
        // Explicitly log the marker coordinates we're trying to add
        console.log(`SimpleJobMap: Adding marker at [${location.lng}, ${location.lat}] for ${location.id} (${location.title})${isProbablyFallbackLocation ? ' - FALLBACK LOCATION' : ''}`);
        
        // Create and add the marker
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([location.lng, location.lat])
          .addTo(mapInstance);
        
        // Add popup if in detailed view
        if (detailedView) {
          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: true,
            offset: 25
          }).setHTML(`<div class="p-2"><strong>${location.title}</strong></div>`);
          
          marker.setPopup(popup);
          
          // Show popup on hover
          markerEl.addEventListener('mouseenter', () => {
            marker.togglePopup();
          });
        }
        
        // Store marker for cleanup
        markersRef.current[location.id] = marker;
        validMarkersCount++;
        
        // Extend bounds
        bounds.extend([location.lng, location.lat]);
        hasValidBounds = true;
      } catch (error) {
        console.error(`SimpleJobMap: Error adding marker for location ${location.id}:`, error);
      }
    });
    
    console.log(`SimpleJobMap: Successfully added ${validMarkersCount} markers`);
    
    // Fit map to bounds if we have valid locations
    if (hasValidBounds) {
      console.log("SimpleJobMap: Fitting map to bounds");
      mapInstance.fitBounds(bounds, { 
        padding: detailedView ? 60 : 40, 
        maxZoom: detailedView ? 15 : 12, 
        duration: 1000 
      });
    } else {
      console.warn("SimpleJobMap: No valid bounds created from markers");
      
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
  }, [locations, mapLoaded, detailedView]);
  
  // Get color based on store type
  const getColorForStoreType = (storeType?: string): string => {
    if (!storeType) return '#3b82f6'; // blue-500
    
    switch (storeType.toLowerCase()) {
      case 'circle-k':
        return '#ef4444'; // red-500
      case '7-eleven':
        return '#22c55e'; // green-500
      case 'wawa':
        return '#f59e0b'; // amber-500
      default:
        return '#6366f1'; // indigo-500
    }
  };
  
  return (
    <div className="relative w-full h-full">
      {/* Apply inline styles to ensure the container has proper dimensions */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0" 
        style={{ width: '100%', height: '100%', minHeight: '250px' }}
      />
      
      {/* Loading state */}
      {(!mapLoaded || !map.current) && !mapError && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <FiMapPin className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Map Error</h3>
            <p className="text-gray-600 dark:text-gray-300">{mapError}</p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {mapLoaded && !mapError && locations.length === 0 && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
          <div className="text-center p-4">
            <FiMapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-300">No locations to display</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleJobMap; 
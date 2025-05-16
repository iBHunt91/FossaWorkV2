import React, { useRef, useEffect, useState } from 'react';
import mapboxgl, { RequestParameters } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FiMapPin } from 'react-icons/fi';

// Define the Location interface that matches what Home.tsx provides
interface Location {
  id: string;
  lat: number;
  lng: number;
  title: string;
  storeType?: string;
  isFallback?: boolean;
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

  // Define marker styles
  const getMarkerStyle = (storeType: string = 'other') => {
    // Use the same store color scheme as in Home.tsx
    switch (storeType.toLowerCase()) {
      case 'circle-k':
        return { color: '#ef4444', size: detailedView ? '32px' : '28px' }; // red-500
      case '7-eleven':
        return { color: '#22c55e', size: detailedView ? '32px' : '28px' }; // green-500
      case 'wawa':
        return { color: '#f59e0b', size: detailedView ? '32px' : '28px' }; // amber-500
      default:
        return { color: '#3b82f6', size: detailedView ? '32px' : '28px' }; // blue-500
    }
  };

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token is not provided. Please add VITE_MAPBOX_ACCESS_TOKEN to your environment variables.');
      setMapError("Missing Mapbox access token");
      return;
    }
    
    console.log("SimpleJobMap: Initializing map");
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        attributionControl: false,
        transformRequest: (url, resourceType) => {
          // Disable caching for tile requests to prevent CacheStorage errors
          if (resourceType === 'Tile') {
            return {
              url: url,
              headers: {
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
              }
            } as RequestParameters;
          }
          return { url };
        }
      });
      
      map.current = mapInstance;
      
      // Add navigation controls
      mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Handle map errors
      mapInstance.on('error', (e: mapboxgl.ErrorEvent) => {
        // Filter out non-critical errors
        if (e.error && (
            e.error.message.includes('CacheStorage') || 
            e.error.message.includes('cache') ||
            e.error.message.includes('Failed to fetch')
        )) {
          console.warn("SimpleJobMap: Non-critical map error (caching related):", e.error.message);
          return;
        }
        
        console.error("SimpleJobMap: Mapbox error:", e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
      });
      
      mapInstance.on('load', () => {
        console.log("SimpleJobMap: Map loaded successfully");
        setMapLoaded(true);
      });
    } catch (error) {
      console.error("SimpleJobMap: Error creating map:", error);
      setMapError(`Error initializing map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return () => {
      // Clean up on unmount
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Add markers when locations change or map loads
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) {
      console.log("SimpleJobMap: Skipping marker update, map not ready");
      return;
    }
    
    console.log(`SimpleJobMap: Adding ${locations.length} markers to map`);
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // Create bounds to fit all markers
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;
    
    // If no locations, set a default view
    if (locations.length === 0) {
      console.log("SimpleJobMap: No locations available, setting default view");
      mapInstance.flyTo({
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        essential: true
      });
      return;
    }
    
    // Add markers for each location
    locations.forEach(location => {
      if (!location || !location.id) {
        console.warn('SimpleJobMap: Skipping invalid location (missing location object or ID)');
        return;
      }
      
      // Validate coordinates are within reasonable bounds
      const { lng, lat } = location;
      if (!isFinite(lng) || !isFinite(lat) || 
          lng < -180 || lng > 180 || 
          lat < -90 || lat > 90) {
        console.warn(`SimpleJobMap: Location ${location.id} has invalid coordinates: (${lat}, ${lng})`);
        return;
      }
      
      try {
        // Get marker style based on store type
        const { color, size } = getMarkerStyle(location.storeType);
        
        // Create marker element
        const markerEl = document.createElement('div');
        
        // Apply styles
        Object.assign(markerEl.style, {
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          border: '2px solid white',
          transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
        });
        
        // Add pin icon
        markerEl.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        
        // Add hover effects
        markerEl.addEventListener('mouseenter', () => {
          markerEl.style.transform = 'scale(1.1)';
          markerEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        });
        
        markerEl.addEventListener('mouseleave', () => {
          markerEl.style.transform = '';
          markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
        });
        
        // Create a popup if detailed view is enabled
        let popup = null;
        if (detailedView) {
          popup = new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-2 max-w-xs">
                <h3 class="font-semibold text-sm mb-1">${location.title}</h3>
                ${location.isFallback ? '<p class="text-xs text-amber-600">Using estimated location</p>' : ''}
              </div>
            `);
        }
        
        // Create and add the marker to the map
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([lng, lat]);
          
        // Add popup if available
        if (popup) {
          marker.setPopup(popup);
        }
        
        // Add to map
        marker.addTo(mapInstance);
        
        // Store marker reference for later cleanup
        markersRef.current[location.id] = marker;
        
        // Add click event to show popup
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.addEventListener('click', () => {
            if (popup) {
              // Open popup when clicked
              popup.addTo(mapInstance);
            }
          });
        }
        
        // Extend bounds to include this marker
        bounds.extend([lng, lat]);
        hasValidBounds = true;
      } catch (error) {
        console.error(`SimpleJobMap: Error adding marker for location ${location.id}:`, error);
      }
    });
    
    // Fit map to bounds with padding if there are markers
    if (hasValidBounds) {
      console.log("SimpleJobMap: Fitting map to bounds");
      mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
    } else {
      console.warn("SimpleJobMap: No valid bounds created from markers");
      
      // Fallback to default view
      mapInstance.flyTo({
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        essential: true
      });
    }
  }, [locations, mapLoaded, detailedView]);
  
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
            </p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {mapLoaded && !mapError && locations.length === 0 && (
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

export default SimpleJobMap; 
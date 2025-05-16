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

  // Initialize map when component mounts
  useEffect(() => {
    // Get Mapbox access token from environment variable
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZm9zc2FhcHAiLCJhIjoiY2xqMXl6NngyMDUzNzNnbzV1cms3bDRtbyJ9.UJlE2thLWoRKyRpU6Jvgxw';
    
    try {
      // Skip if map is already initialized or container is missing
      if (map.current || !mapContainer.current) return;
      
      // Initialize Mapbox
      mapboxgl.accessToken = mapboxToken;
      
      // Create map instance
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
        attributionControl: false,
      });
      
      map.current = mapInstance;
      
      // Add navigation controls if detailed view
      if (detailedView) {
        mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      }
      
      // Handle map load event
      mapInstance.on('load', () => {
        setMapLoaded(true);
      });
      
      // Handle map errors
      mapInstance.on('error', (e) => {
        console.error("Map error:", e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
      });
      
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setMapError(`Error initializing map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [detailedView]);
  
  // Update markers when locations or map state changes
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // No locations - show default view
    if (locations.length === 0) {
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
    
    locations.forEach(location => {
      // Skip invalid locations
      if (!location || !location.id || !isFinite(location.lat) || !isFinite(location.lng)) {
        return;
      }
      
      // Validate coordinates
      if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
        return;
      }
      
      try {
        // Create marker element
        const markerEl = document.createElement('div');
        Object.assign(markerEl.style, {
          width: '24px',
          height: '24px',
          backgroundColor: getColorForStoreType(location.storeType),
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          border: '2px solid white',
          transition: 'transform 0.15s ease-out',
        });
        
        // Add pin icon inside marker
        markerEl.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        
        // Add hover effects
        markerEl.addEventListener('mouseenter', () => {
          markerEl.style.transform = 'scale(1.2)';
        });
        
        markerEl.addEventListener('mouseleave', () => {
          markerEl.style.transform = '';
        });
        
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
        
        // Extend bounds
        bounds.extend([location.lng, location.lat]);
        hasValidBounds = true;
      } catch (error) {
        console.error(`Error adding marker for location ${location.id}:`, error);
      }
    });
    
    // Fit map to bounds if we have valid locations
    if (hasValidBounds) {
      mapInstance.fitBounds(bounds, { 
        padding: detailedView ? 60 : 30, 
        maxZoom: detailedView ? 15 : 12, 
        duration: 1000 
      });
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
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Loading state */}
      {!mapLoaded && !mapError && (
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
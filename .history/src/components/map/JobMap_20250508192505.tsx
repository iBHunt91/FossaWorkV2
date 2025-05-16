import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeocodedJob } from '../../types/job';
import { format } from 'date-fns';
import { FiClock, FiMapPin, FiCalendar, FiUser } from 'react-icons/fi';

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
  
  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainer.current) return;
    
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token is not provided. Please add VITE_MAPBOX_ACCESS_TOKEN to your environment variables.');
      return;
    }
    
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 3
    });
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    map.current.on('load', () => {
      setMapLoaded(true);
    });
    
    return () => {
      // Clean up on unmount
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Add/update markers when jobs change
  useEffect(() => {
    if (!map.current || !mapLoaded || jobs.length === 0) return;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // Create bounds to fit all markers
    const bounds = new mapboxgl.LngLatBounds();
    
    // Add new markers for each job
    jobs.forEach(job => {
      if (!job.coordinates) return;
      
      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'rounded-full w-6 h-6 flex items-center justify-center cursor-pointer';
      
      // Style based on job status
      let bgColor = 'bg-blue-500';
      switch (job.status) {
        case 'in-progress':
          bgColor = 'bg-amber-500';
          break;
        case 'completed':
          bgColor = 'bg-green-500';
          break;
        case 'cancelled':
          bgColor = 'bg-red-500';
          break;
      }
      
      markerEl.className = `${markerEl.className} ${bgColor}`;
      markerEl.innerHTML = '<span class="text-white text-xs">●</span>';
      
      // Create popup with job info
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 25
      }).setHTML(`
        <div class="p-2 max-w-[240px]">
          <h3 class="font-medium text-sm">${job.clientName}</h3>
          <div class="text-xs text-gray-600 mt-1">
            <div class="flex items-center mb-1">
              <span class="mr-1"><i class="fi fi-map-pin"></i></span>
              <span class="truncate">${job.address}, ${job.city}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>${format(new Date(job.scheduledDate), 'MMM d, yyyy')}</span>
              <span>${job.startTime}</span>
            </div>
          </div>
        </div>
      `);
      
      // Create and store marker
      if (map.current) {
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([job.coordinates.longitude, job.coordinates.latitude])
          .setPopup(popup)
          .addTo(map.current);
        
        // Highlight the marker if it's the selected job
        if (selectedJob && job.id === selectedJob.id) {
          marker.getElement().classList.add('ring-2', 'ring-white');
          marker.togglePopup(); // Show popup for selected job
        }
        
        // Add click event to marker
        marker.getElement().addEventListener('click', () => {
          onSelectJob(job);
        });
        
        // Store marker reference for later cleanup
        markersRef.current[job.id] = marker;
        
        // Extend bounds to include this marker
        bounds.extend([job.coordinates.longitude, job.coordinates.latitude]);
      }
    });
    
    // Fit map to bounds with padding
    if (!bounds.isEmpty() && map.current) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  }, [jobs, mapLoaded, selectedJob, onSelectJob]);
  
  // Update marker when selected job changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // Reset all markers to default style
    Object.entries(markersRef.current).forEach(([jobId, marker]) => {
      marker.getElement().classList.remove('ring-2', 'ring-white');
      marker.getPopup().remove();
    });
    
    // Highlight selected marker and show popup
    if (selectedJob && selectedJob.id in markersRef.current && map.current) {
      const marker = markersRef.current[selectedJob.id];
      marker.getElement().classList.add('ring-2', 'ring-white');
      marker.togglePopup();
      
      // Pan map to center on selected marker
      map.current.flyTo({
        center: [selectedJob.coordinates.longitude, selectedJob.coordinates.latitude],
        zoom: 12,
        essential: true
      });
    }
  }, [selectedJob, mapLoaded]);
  
  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {mapLoaded && jobs.length === 0 && (
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
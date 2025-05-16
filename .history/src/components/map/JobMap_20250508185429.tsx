import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeocodedJob, Job } from '../../types/job';
import { getRoute } from '../../services/jobService';

interface JobMapProps {
  jobs: Job[];
  selectedJob: Job | null;
  onSelectJob: (job: Job) => void;
}

const JobMap: React.FC<JobMapProps> = ({ jobs, selectedJob, onSelectJob }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [routeVisible, setRouteVisible] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Initialize map when component mounts
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-98.5795, 39.8283], // Center of US as default
      zoom: 3
    });
    
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocate control
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    
    map.addControl(geolocateControl);
    
    // Store user's location when they use the geolocate control
    geolocateControl.on('geolocate', (e: any) => {
      const { longitude, latitude } = e.coords;
      setUserLocation([longitude, latitude]);
    });
    
    // Save map instance
    mapRef.current = map;
    
    // Clean up on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      // Clear all markers
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
    };
  }, []);
  
  // Add markers for jobs
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Wait for map to load
    map.on('load', () => {
      // Remove any existing route layers
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
      
      // Clear existing markers
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
      
      // Skip if there are no jobs
      if (!jobs.length) return;
      
      // Create new markers for jobs
      const newMarkers: { [key: string]: mapboxgl.Marker } = {};
      const bounds = new mapboxgl.LngLatBounds();
      
      jobs.forEach(job => {
        if (!job.coordinates) return;
        
        // Create HTML element for marker
        const el = document.createElement('div');
        el.className = 'job-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = job.id === selectedJob?.id ? '#ff6b6b' : '#4dabf7';
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';
        
        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <h3>${job.title}</h3>
          <p>${job.address}, ${job.city}, ${job.state} ${job.zipCode}</p>
          <p>Date: ${new Date(job.scheduledDate).toLocaleDateString()}</p>
          <p>Time: ${job.startTime} - ${job.endTime}</p>
          <p>Client: ${job.clientName}</p>
        `);
        
        // Create marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([job.coordinates.longitude, job.coordinates.latitude])
          .setPopup(popup)
          .addTo(map);
          
        // Add click event to marker
        marker.getElement().addEventListener('click', () => {
          onSelectJob(job);
        });
        
        // Store marker reference
        newMarkers[job.id] = marker;
        
        // Add coordinates to bounds
        bounds.extend([job.coordinates.longitude, job.coordinates.latitude]);
      });
      
      // Update markers ref
      markersRef.current = newMarkers;
      
      // Fit map to bounds
      if (jobs.length > 1) {
        map.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
      } else if (jobs.length === 1 && jobs[0].coordinates) {
        map.flyTo({
          center: [jobs[0].coordinates.longitude, jobs[0].coordinates.latitude],
          zoom: 14
        });
      }
    });
  }, [jobs, onSelectJob]);
  
  // Update map when selected job changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedJob || !selectedJob.coordinates) return;
    
    // Update marker color
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement();
      el.style.backgroundColor = id === selectedJob.id ? '#ff6b6b' : '#4dabf7';
      
      // If this is the selected marker, open its popup
      if (id === selectedJob.id) {
        marker.togglePopup();
      }
    });
    
    // Fly to selected job
    map.flyTo({
      center: [selectedJob.coordinates.longitude, selectedJob.coordinates.latitude],
      zoom: 14
    });
  }, [selectedJob]);
  
  // Display route to selected job from user location
  const handleShowRoute = async () => {
    const map = mapRef.current;
    if (!map || !selectedJob || !selectedJob.coordinates || !userLocation) return;
    
    try {
      const routeData = await getRoute(
        userLocation,
        [selectedJob.coordinates.longitude, selectedJob.coordinates.latitude]
      );
      
      const route = routeData.routes[0].geometry.coordinates;
      
      // Remove existing route layer and source
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
      
      // Add route source and layer
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route
          }
        }
      });
      
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });
      
      // Fit map to show the entire route
      const bounds = new mapboxgl.LngLatBounds();
      route.forEach((coord: [number, number]) => {
        bounds.extend(coord);
      });
      
      map.fitBounds(bounds, {
        padding: 50
      });
      
      setRouteVisible(true);
    } catch (error) {
      console.error('Error showing route:', error);
      alert('Could not calculate route. Please try again.');
    }
  };
  
  // Clear displayed route
  const handleClearRoute = () => {
    const map = mapRef.current;
    if (!map) return;
    
    if (map.getLayer('route')) {
      map.removeLayer('route');
    }
    if (map.getSource('route')) {
      map.removeSource('route');
    }
    
    setRouteVisible(false);
  };
  
  return (
    <div className="job-map">
      <div ref={mapContainerRef} className="job-map-container" style={{ height: '600px' }} />
      
      {selectedJob && userLocation && (
        <div className="job-map-controls">
          {!routeVisible ? (
            <button onClick={handleShowRoute} className="show-route-btn">
              Show Route to Job
            </button>
          ) : (
            <button onClick={handleClearRoute} className="clear-route-btn">
              Clear Route
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default JobMap; 
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeocodedJob } from '../../types/job';
import { FiMapPin, FiCalendar, FiX } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>(jobs);
  const [activeFilter, setActiveFilter] = useState<'day' | 'week' | 'all'>('all');
  
  // Helper functions for date calculations
  const getWeekStart = (date: Date = new Date()): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  
  const getWeekEnd = (date: Date = new Date()): Date => {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  };
  
  const formatWeekRange = (date: Date = new Date()): string => {
    const weekStart = getWeekStart(date);
    const weekEnd = getWeekEnd(date);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };
  
  const moveWeek = (weeks: number) => {
    const currentDate = dateFilter || new Date();
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setDateFilter(newDate);
    setActiveFilter('week');
  };
  
  // Apply date filter to jobs
  useEffect(() => {
    if (!dateFilter) {
      setFilteredJobs(jobs);
      return;
    }
    
    let filtered: GeocodedJob[];
    
    if (activeFilter === 'day') {
      // Filter by specific day
      const filterDate = new Date(dateFilter);
      // Reset time to start of day for comparison
      filterDate.setHours(0, 0, 0, 0);
      
      filtered = jobs.filter(job => {
        if (!job.scheduledDate) return false;
        
        const jobDate = new Date(job.scheduledDate);
        jobDate.setHours(0, 0, 0, 0);
        
        return jobDate.getTime() === filterDate.getTime();
      });
    } else if (activeFilter === 'week') {
      // Filter by week
      const weekStart = getWeekStart(dateFilter);
      const weekEnd = getWeekEnd(dateFilter);
      
      filtered = jobs.filter(job => {
        if (!job.scheduledDate) return false;
        
        const jobDate = new Date(job.scheduledDate);
        return jobDate >= weekStart && jobDate <= weekEnd;
      });
    } else {
      // Show all jobs
      filtered = jobs;
    }
    
    setFilteredJobs(filtered);
    console.log(`Filtered jobs from ${jobs.length} to ${filtered.length} for ${activeFilter} filter`);
  }, [jobs, dateFilter, activeFilter]);
  
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
        jobCount: filteredJobs.length 
      });
      return;
    }
    
    console.log(`Adding ${filteredJobs.length} markers to map`);
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    
    // Create bounds to fit all markers
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;
    
    // Add new markers for each job
    filteredJobs.forEach(job => {
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
        markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
        markerEl.style.border = '2px solid white';
        markerEl.innerHTML = '<span style="color: white; font-size: 12px; font-weight: bold;">●</span>';
        
        // Get store info for popup
        const storeName = job.clientName || 'Unknown Store';
        const storeNumber = job.storeNumber || 'N/A';
        const visitNumber = job.visitId || 'N/A';
        
        // Debug the dispensers data
        console.log(`Job ${job.id} full data:`, job);
        
        // Since dispensers field is undefined, try to get dispenser count from serviceTypes
        let dispenserCount = 'N/A';
        
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
        
        // If still N/A and we have a specific value to default to for demos/testing
        if (dispenserCount === 'N/A') {
          // For testing/demo purposes only - REMOVE IN PRODUCTION
          dispenserCount = '4'; // Default to 4 dispensers for demo
          console.log(`Using default dispenser count for job ${job.id}`);
        }
        
        console.log(`Job ${job.id} final dispenser count:`, dispenserCount);
        
        // Create popup with job info
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '350px',
          offset: 25,
          className: 'custom-popup' // Add class for potential CSS targeting
        }).setHTML(`
          <div style="padding: 18px; font-family: system-ui, sans-serif; background-color: white; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 0 2px rgba(0,0,0,0.1); border: 2px solid #3b82f6;">
            <h3 style="font-weight: 700; font-size: 20px; margin-bottom: 16px; color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; text-shadow: 0 1px 0 rgba(255,255,255,0.7);">${storeName}</h3>
            <div style="font-size: 15px; color: #1f2937; margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding: 6px 0; align-items: center;">
                <span style="font-weight: 600; color: #1f2937; min-width: 130px;">Store Number:</span>
                <span style="font-weight: 500; background-color: #f3f4f6; padding: 4px 10px; border-radius: 6px; border: 1px solid #d1d5db; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">${storeNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding: 6px 0; align-items: center;">
                <span style="font-weight: 600; color: #1f2937; min-width: 130px;">Visit Number:</span>
                <span style="font-weight: 500; background-color: #f3f4f6; padding: 4px 10px; border-radius: 6px; border: 1px solid #d1d5db; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">${visitNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding: 6px 0; align-items: center;">
                <span style="font-weight: 600; color: #1f2937; min-width: 130px;">Dispenser Count:</span>
                <span style="font-weight: 600; background-color: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 6px; border: 1px solid #93c5fd; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${dispenserCount}</span>
              </div>
              <div style="margin-top: 16px; font-size: 14px; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; line-height: 1.6; font-weight: 500; color: #374151;">${job.address}, ${job.city}, ${job.state}</p>
              </div>
            </div>
          </div>
        `);
        
        // Add custom CSS to the popup DOM element once it's created
        const popupEl = popup.getElement();
        if (popupEl) {
          // This runs when popup is added to the DOM
          popup.on('open', () => {
            try {
              const popupContent = popupEl.querySelector('.mapboxgl-popup-content') as HTMLElement;
              if (popupContent) {
                popupContent.style.padding = '0';
                popupContent.style.overflow = 'hidden';
                popupContent.style.borderRadius = '10px';
              }
              
              const closeButton = popupEl.querySelector('.mapboxgl-popup-close-button') as HTMLElement;
              if (closeButton) {
                closeButton.style.fontSize = '22px';
                closeButton.style.color = '#4b5563';
                closeButton.style.fontWeight = 'bold';
                closeButton.style.padding = '8px 12px';
                closeButton.style.zIndex = '10';
                closeButton.style.backgroundColor = 'rgba(255,255,255,0.8)';
                closeButton.style.borderRadius = '0 8px 0 8px';
              }
              
              // Add subtle animation
              if (popupContent) {
                popupContent.style.opacity = '0';
                popupContent.style.transform = 'translateY(10px)';
                popupContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                
                // Trigger animation on next frame
                setTimeout(() => {
                  popupContent.style.opacity = '1';
                  popupContent.style.transform = 'translateY(0)';
                }, 50);
              }
            } catch (error) {
              console.error('Error styling popup:', error);
            }
          });
        }
        
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
  }, [filteredJobs, mapLoaded]);
  
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
          element.style.border = '2px solid white';
          element.style.zIndex = '0';
          element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
          element.style.backgroundColor = '#3b82f6'; // Blue default
          element.style.width = '24px';
          element.style.height = '24px';
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
          element.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.8), 0 3px 8px rgba(0,0,0,0.5)';
          element.style.backgroundColor = '#ea580c'; // Orange highlight
          element.style.width = '30px';
          element.style.height = '30px';
          element.style.transform = 'scale(1.1)';
          element.style.transition = 'all 0.2s ease-in-out';
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
      
      {/* Date filter - Enhanced version */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center">
              <FiCalendar className="w-4 h-4 mr-2" />
              Date Filter
            </h3>
            {activeFilter !== 'all' && (
              <button 
                onClick={() => {
                  setDateFilter(null);
                  setActiveFilter('all');
                }}
                className="text-xs text-gray-500 hover:text-red-500 flex items-center"
              >
                <FiX className="w-3 h-3 mr-1" /> Clear
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button 
              className={`text-xs px-2 py-1.5 rounded ${activeFilter === 'day' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setDateFilter(dateFilter || new Date());
                setActiveFilter('day');
              }}
            >
              Day
            </button>
            <button 
              className={`text-xs px-2 py-1.5 rounded ${activeFilter === 'week' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setDateFilter(dateFilter || new Date());
                setActiveFilter('week');
              }}
            >
              Week
            </button>
            <button 
              className={`text-xs px-2 py-1.5 rounded ${activeFilter === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setDateFilter(null);
                setActiveFilter('all');
              }}
            >
              All Jobs
            </button>
          </div>
          
          {/* Week navigation */}
          {activeFilter === 'week' && (
            <div className="flex items-center justify-between mb-3 bg-gray-50 dark:bg-gray-700 p-2 rounded">
              <button 
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => moveWeek(-1)}
              >
                &#9664; Prev
              </button>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {dateFilter ? formatWeekRange(dateFilter) : formatWeekRange(new Date())}
              </span>
              <button 
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => moveWeek(1)}
              >
                Next &#9654;
              </button>
            </div>
          )}
          
          {/* Date Picker */}
          <div 
            className="cursor-pointer text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded text-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            onClick={() => setShowDateFilter(!showDateFilter)}
          >
            {activeFilter === 'day' && dateFilter 
              ? `Selected: ${dateFilter.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}`
              : 'Select Specific Date'}
          </div>
          
          {showDateFilter && (
            <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2">
              <DatePicker
                inline
                selected={dateFilter || new Date()}
                onChange={(date: Date | null) => {
                  setDateFilter(date);
                  setShowDateFilter(false);
                  setActiveFilter('day');
                }}
                highlightDates={jobs.map(job => job.scheduledDate ? new Date(job.scheduledDate) : null).filter(Boolean) as Date[]}
                calendarClassName="bg-white dark:bg-gray-800 border-0"
                dayClassName={date => {
                  // Highlight days that have jobs
                  const hasJobs = jobs.some(job => {
                    if (!job.scheduledDate) return false;
                    const jobDate = new Date(job.scheduledDate);
                    return jobDate.toDateString() === date.toDateString();
                  });
                  return hasJobs ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" : undefined;
                }}
              />
            </div>
          )}
        </div>
      </div>
      
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
      
      {/* Filter indicators */}
      {activeFilter !== 'all' && filteredJobs.length !== jobs.length && (
        <div className="absolute bottom-3 left-3 right-3 bg-white/90 dark:bg-gray-800/90 p-2 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {filteredJobs.length} of {jobs.length} jobs 
              {activeFilter === 'day' && dateFilter ? ` for ${dateFilter.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}` : ''}
              {activeFilter === 'week' && dateFilter ? ` for week of ${getWeekStart(dateFilter).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}` : ''}
            </span>
            <button 
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => {
                setDateFilter(null);
                setActiveFilter('all');
              }}
            >
              Clear Filter
            </button>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {mapLoaded && !mapError && filteredJobs.length === 0 && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
          <div className="text-center p-4">
            <FiMapPin className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-300">
              {dateFilter 
                ? `No locations to display for ${dateFilter.toLocaleDateString()}`
                : 'No locations to display'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobMap; 
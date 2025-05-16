import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiMapPin, FiFilter, FiRefreshCw, FiList, FiMap, FiX, FiCalendar, FiMaximize, FiNavigation, FiArrowRight, FiLoader, FiHome, FiPlus, FiMoreHorizontal } from 'react-icons/fi';
import JobMap, { JobMapRef } from '../components/map/JobMap';
import JobList from '../components/map/JobList';
import JobDetailsPane from '../components/map/JobDetailsPane';
import { fetchJobs } from '../services/jobService';
import { GeocodedJob, Job } from '../types/job';
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import routingService, { CustomLocation } from '../services/routingService';
import LocationManager from '../components/LocationManager';
import locationStorageService from '../services/locationStorageService';

interface AddressSuggestion {
  place_name: string;
  center: [number, number]; // [longitude, latitude]
  id: string;
}

// Local storage key for custom locations
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';

const JobMapView: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<GeocodedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<GeocodedJob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [displayedDate, setDisplayedDate] = useState<Date>(new Date());
  const jobMapRef = useRef<JobMapRef>(null);
  const [flyToEnabled, setFlyToEnabled] = useState<boolean>(true);
  const [isViewAllMode, setIsViewAllMode] = useState<boolean>(false);
  
  // Routing mode state
  const [isRoutingMode, setIsRoutingMode] = useState<boolean>(false);
  const [routeWaypoints, setRouteWaypoints] = useState<Array<GeocodedJob | CustomLocation | null>>([]);
  const [routeCalculating, setRouteCalculating] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<{duration: number; distance: number} | null>(null);
  
  // Custom location state
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [showAddLocationForm, setShowAddLocationForm] = useState<{ index: number | null }>({ index: null });
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationAddress, setNewLocationAddress] = useState<string>('');
  const [isAddingLocation, setIsAddingLocation] = useState<boolean>(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const addressInputTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Add state for editing locations
  const [editingLocation, setEditingLocation] = useState<{id: string, name: string, address: string} | null>(null);

  // Location Manager Modal State
  const [showLocationManager, setShowLocationManager] = useState<boolean>(false);

  // Helper to format date range for display
  const formatDateRange = (start: Date, end: Date): string => {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const currentWeekStart = startOfWeek(displayedDate, { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(displayedDate, { weekStartsOn: 0 });

  // Determine if the displayed week is the actual current week
  const today = new Date();
  const actualCurrentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const isViewingActualCurrentWeek = currentWeekStart.toDateString() === actualCurrentWeekStart.toDateString();

  const todayButtonText = isViewingActualCurrentWeek ? "Current Week" : "Go to Current Week";
  const todayButtonTitle = isViewingActualCurrentWeek ? "Viewing Current Week" : "Go to Current Week";

  const handlePreviousWeek = () => {
    setDisplayedDate(prevDate => subDays(prevDate, 7));
  };

  const handleNextWeek = () => {
    setDisplayedDate(prevDate => addDays(prevDate, 7));
  };

  const handleToday = () => {
    setDisplayedDate(new Date());
  };

  // Fetch jobs on component mount
  useEffect(() => {
    const getJobs = async () => {
      try {
        setIsLoading(true);
        const jobData = await fetchJobs();
        setJobs(jobData);
        // We'll filter the jobs in the applyFilters effect
      } catch (err) {
        setError('Failed to fetch job data. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    getJobs();
  }, []);

  // Refresh jobs data
  const refreshJobs = async () => {
    try {
      setIsRefreshing(true);
      const jobData = await fetchJobs();
      setJobs(jobData);
      // The applyFilters effect will update filteredJobs
    } catch (err) {
      setError('Failed to refresh job data. Please try again later.');
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter jobs based on week
  const applyFilters = useCallback(() => {
    if (!jobs.length) return;
    
    // Filter jobs for the currently displayed week
    const weekStart = startOfWeek(displayedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(displayedDate, { weekStartsOn: 0 });
    
    // First filter by date, then ensure we only include jobs with coordinates (GeocodedJob)
    const filtered = jobs
      .filter(job => {
        const jobDate = new Date(job.scheduledDate);
        return jobDate >= weekStart && jobDate <= weekEnd;
      })
      .filter((job): job is GeocodedJob => 
        job.coordinates !== undefined && 
        typeof job.coordinates.latitude === 'number' && 
        typeof job.coordinates.longitude === 'number'
      );
    
    setFilteredJobs(filtered);
    
    // Auto-select first job if available and none is selected
    if (filtered.length > 0 && !selectedJob) {
      setSelectedJob(filtered[0]);
      setRouteWaypoints([filtered[0]]);
    }
    
    // Reset routing if jobs have changed significantly
    setRouteWaypoints([]);
    setRouteInfo(null);
    
    setFlyToEnabled(true); // Re-enable flyTo when filters change
  }, [jobs, displayedDate]);

  // Apply filter when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Get address suggestions as user types
  const getAddressSuggestions = async (query: string) => {
    if (query.length < 1) {
      setAddressSuggestions([]);
      return;
    }
    
    try {
      setIsLoadingSuggestions(true);
      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      
      // Call Mapbox Geocoding API for suggestions
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxToken}&` +
        `types=address,poi,place&` + // Focus on addresses, points of interest, and places
        `limit=5` // Limit results
      );
      
      if (response.ok) {
        const data = await response.json();
        setAddressSuggestions(data.features);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle address input with debounce
  const handleAddressInput = (address: string) => {
    setNewLocationAddress(address);
    
    // Clear any existing timeout
    if (addressInputTimeout.current) {
      clearTimeout(addressInputTimeout.current);
    }
    
    // Set a new timeout to fetch suggestions
    addressInputTimeout.current = setTimeout(() => {
      getAddressSuggestions(address);
    }, 300); // 300ms debounce
  };

  // Load saved locations on component mount
  useEffect(() => {
    const loadSavedLocations = async () => {
      try {
        // Use locationStorageService instead of direct localStorage access
        const savedLocations = await locationStorageService.loadLocations();
        if (savedLocations && savedLocations.length > 0) {
          setCustomLocations(savedLocations);
          console.log(`Loaded ${savedLocations.length} saved locations using locationStorageService`);
        } else {
          console.log('No saved locations found');
        }
      } catch (error) {
        console.error('Error loading custom locations:', error);
        
        // Fallback to direct localStorage access
        try {
          const savedLocationsJson = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
          if (savedLocationsJson) {
            const savedLocations = JSON.parse(savedLocationsJson);
            if (Array.isArray(savedLocations) && savedLocations.length > 0) {
              setCustomLocations(savedLocations);
              console.log(`Loaded ${savedLocations.length} saved locations from direct localStorage access (fallback)`);
            }
          }
        } catch (fallbackError) {
          console.error('Error using fallback loading method:', fallbackError);
        }
      }
    };
    
    loadSavedLocations();
  }, []);
  
  // Save locations whenever they change
  useEffect(() => {
    // Skip saving on initial render when customLocations is empty
    if (customLocations.length > 0 || document.readyState === 'complete') {
      try {
        // Use locationStorageService instead of direct localStorage access
        locationStorageService.saveLocations(customLocations)
          .then(() => console.log(`Saved ${customLocations.length} locations using locationStorageService`))
          .catch(err => {
            console.error('Error saving with locationStorageService:', err);
            // Fallback to direct localStorage access
            localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, JSON.stringify(customLocations));
            console.log(`Saved ${customLocations.length} locations directly to localStorage (fallback)`);
          });
      } catch (error) {
        console.error('Error saving custom locations:', error);
      }
    }
  }, [customLocations]);

  // Handle adding a custom location
  const handleAddCustomLocation = async (selectedSuggestion?: AddressSuggestion) => {
    if (!newLocationName.trim()) {
      setAddressError('Please enter a name for this location');
      return;
    }
    
    if (!selectedSuggestion && !newLocationAddress.trim()) {
      setAddressError('Please enter an address or select a suggestion');
      return;
    }
    
    try {
      setIsAddingLocation(true);
      setAddressError(null);
      
      let newLocation: CustomLocation;
      
      if (selectedSuggestion) {
        // Use the selected suggestion's coordinates
        const [longitude, latitude] = selectedSuggestion.center;
        const id = `custom-${Date.now()}-${Math.round(Math.random() * 1000)}`;
        
        newLocation = {
          id,
          name: newLocationName.trim(),
          address: selectedSuggestion.place_name,
          coordinates: {
            latitude,
            longitude
          }
        };
      } else {
        // Use the entered address and geocode it
        newLocation = await routingService.createCustomLocation(
          newLocationName.trim(),
          newLocationAddress.trim()
        );
      }
      
      // Update state (this will trigger the effect to save to localStorage)
      setCustomLocations(prevLocations => [...prevLocations, newLocation]);
      
      // Add to route waypoints at the specified index
      if (showAddLocationForm.index !== null) {
        const newWaypoints = [...routeWaypoints];
        newWaypoints[showAddLocationForm.index] = newLocation;
        setRouteWaypoints(newWaypoints);
      } else {
        setRouteWaypoints([...routeWaypoints, newLocation]);
      }
      
      // Reset the form
      setNewLocationName('');
      setNewLocationAddress('');
      setAddressSuggestions([]);
      setShowAddLocationForm({ index: null });
      setRouteInfo(null); // Clear route info for recalculation
    } catch (error) {
      console.error('Error adding custom location:', error);
      setAddressError('Could not geocode this address. Please check and try again.');
    } finally {
      setIsAddingLocation(false);
    }
  };

  // Calculate route between waypoints
  const calculateRoute = useCallback(async () => {
    // Filter out null values and ensure we have at least 2 valid waypoints
    const validWaypoints = routeWaypoints.filter((wp): wp is GeocodedJob | CustomLocation => wp !== null);
    
    if (validWaypoints.length < 2 || !jobMapRef.current) return;
    
    try {
      setRouteCalculating(true);
      
      // For multi-stop routes
      if (validWaypoints.length > 2) {
        // Use multi-stop routing
        const route = await routingService.calculateMultiStopRoute(validWaypoints);
        
        // Show the route on map
        await jobMapRef.current.showMultiPointRoute(validWaypoints, route);
        
        setRouteInfo({
          duration: route.duration,
          distance: route.distance
        });
      } else {
        // For simple 2-point routes, use the existing method
        const [origin, destination] = validWaypoints;
        const driveTime = await jobMapRef.current.showRouteBetweenJobs(origin, destination);
        
        if (driveTime) {
          const routeDetails = await routingService.calculateDriveTime(origin, destination);
          setRouteInfo({
            duration: routeDetails.duration,
            distance: routeDetails.distance
          });
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    } finally {
      setRouteCalculating(false);
    }
  }, [routeWaypoints]);

  // Effect to calculate route when waypoints change
  useEffect(() => {
    if (isRoutingMode && routeWaypoints.length >= 2) {
      // Check if we have at least two distinct locations (excluding null values)
      const validWaypoints = routeWaypoints.filter(wp => wp !== null);
      const locationIds = new Set(validWaypoints.map(wp => wp.id));
      
      if (validWaypoints.length >= 2 && locationIds.size >= 2) {
        calculateRoute();
      }
    }
  }, [isRoutingMode, routeWaypoints, calculateRoute]);

  // Handle job selection (either from map or list)
  const handleJobSelect = useCallback((job: GeocodedJob, source: 'list' | 'map') => {
    setSelectedJob(job);
    
    // In routing mode, add job to waypoints if clicking on map
    if (isRoutingMode && source === 'map') {
      // Find first empty slot or add to end
      const emptyIndex = routeWaypoints.findIndex(wp => wp === undefined);
      
      if (emptyIndex >= 0) {
        const newWaypoints = [...routeWaypoints];
        newWaypoints[emptyIndex] = job;
        setRouteWaypoints(newWaypoints);
      } else {
        setRouteWaypoints([...routeWaypoints, job]);
      }
    }
    
    if (source === 'map') {
      setFlyToEnabled(true); // Always enable flyTo when a map marker is clicked
      setIsViewAllMode(false); // Exit view all mode when selecting directly from map
    }
    // If source is 'list', flyToEnabled remains as it was (respecting a prior 'View All' click)
  }, [isRoutingMode, routeWaypoints]);

  // Toggle routing mode on/off
  const toggleRoutingMode = () => {
    const newRoutingMode = !isRoutingMode;
    setIsRoutingMode(newRoutingMode);
    
    if (newRoutingMode) {
      // When entering routing mode, set the current selected job as the first waypoint
      if (selectedJob) {
        setRouteWaypoints([selectedJob]);
      } else {
        setRouteWaypoints([]);
      }
      setRouteInfo(null);
    } else {
      // When exiting routing mode, clear any routes from the map
      if (jobMapRef.current) {
        jobMapRef.current.clearRoute();
      }
      // Reset forms
      setShowAddLocationForm({ index: null });
      setNewLocationName('');
      setNewLocationAddress('');
      setAddressSuggestions([]);
      setAddressError(null);
      setRouteWaypoints([]);
    }
  };

  // Clear the current route
  const clearRoute = () => {
    setRouteWaypoints([]);
    setRouteInfo(null);
    // Clear the route from map
    if (jobMapRef.current) {
      jobMapRef.current.clearRoute();
    }
  };

  // Swap two waypoints
  const swapWaypoints = (index1: number, index2: number) => {
    if (index1 >= 0 && index1 < routeWaypoints.length && index2 >= 0 && index2 < routeWaypoints.length) {
      const newWaypoints = [...routeWaypoints];
      const temp = newWaypoints[index1];
      newWaypoints[index1] = newWaypoints[index2];
      newWaypoints[index2] = temp;
      setRouteWaypoints(newWaypoints);
      setRouteInfo(null); // Route will be recalculated via effect
    }
  };
  
  // Add new waypoint slot
  const addWaypointSlot = () => {
    setRouteWaypoints([...routeWaypoints, null]);
  };
  
  // Remove waypoint at index
  const removeWaypoint = (index: number) => {
    const newWaypoints = [...routeWaypoints];
    newWaypoints.splice(index, 1);
    setRouteWaypoints(newWaypoints);
    setRouteInfo(null); // Route will be recalculated via effect
  };

  // Memoize jobs for the map, ensuring they have coordinates
  const jobsForMap = useMemo(() => {
    return filteredJobs;
  }, [filteredJobs]);

  // Toggle view mode
  const toggleViewMode = (mode: 'split' | 'map' | 'list') => {
    setViewMode(mode);
    // If switching to map or split view, ensure map resizes and re-enable flyTo
    if (mode === 'map' || mode === 'split') {
      setFlyToEnabled(true);
      setIsViewAllMode(false);
      setTimeout(() => {
        jobMapRef.current?.triggerResize();
      }, 100); // Delay to allow layout to update
    }
  };

  // Effect to resize map when viewMode changes, ensuring it resizes correctly
  // This is particularly important when the map container might change size or visibility
  useEffect(() => {
    if (viewMode === 'map' || viewMode === 'split') {
        // Using a timeout ensures that the resize call happens after the DOM has updated
        // and the map container has its final dimensions for the new view mode.
        const timer = setTimeout(() => {
            console.log(`JobMapView: viewMode changed to ${viewMode}, attempting to resize map.`);
            jobMapRef.current?.triggerResize();
        }, 150); // A slightly longer delay might be needed for complex layouts
        return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // Handle editing a location
  const startEditingLocation = (location: CustomLocation) => {
    setEditingLocation({
      id: location.id,
      name: location.name,
      address: location.address
    });
    setNewLocationName(location.name);
    setNewLocationAddress(location.address);
    // Get fresh suggestions for the address
    handleAddressInput(location.address);
  };

  // Save edited location
  const saveEditedLocation = async (selectedSuggestion?: AddressSuggestion) => {
    if (!editingLocation) return;
    
    if (!newLocationName.trim()) {
      setAddressError('Please enter a name for this location');
      return;
    }
    
    try {
      setIsAddingLocation(true);
      setAddressError(null);
      
      let updatedLocation: CustomLocation;
      
      if (selectedSuggestion) {
        // Use the selected suggestion's coordinates
        const [longitude, latitude] = selectedSuggestion.center;
        
        updatedLocation = {
          id: editingLocation.id,
          name: newLocationName.trim(),
          address: selectedSuggestion.place_name,
          coordinates: { latitude, longitude }
        };
      } else if (newLocationAddress !== editingLocation.address) {
        // Address changed, need to geocode
        const geocodedLocation = await routingService.createCustomLocation(
          newLocationName.trim(),
          newLocationAddress.trim()
        );
        
        updatedLocation = {
          ...geocodedLocation,
          id: editingLocation.id // Keep original ID
        };
      } else {
        // Only name changed, keep original coordinates
        const originalLocation = customLocations.find(loc => loc.id === editingLocation.id);
        if (!originalLocation) {
          throw new Error('Could not find original location');
        }
        
        updatedLocation = {
          ...originalLocation,
          name: newLocationName.trim()
        };
      }
      
      // Update the location in the array (this will trigger the effect to save to localStorage)
      setCustomLocations(prevLocations => 
        prevLocations.map(loc => 
          loc.id === editingLocation.id ? updatedLocation : loc
        )
      );
      
      // Update any waypoints using this location
      setRouteWaypoints(prevWaypoints =>
        prevWaypoints.map(wp =>
          wp?.id === editingLocation.id ? updatedLocation : wp
        )
      );
      
      // Reset the form
      setNewLocationName('');
      setNewLocationAddress('');
      setAddressSuggestions([]);
      setEditingLocation(null);
      setRouteInfo(null); // Recalculate route if this location was used
    } catch (error) {
      console.error('Error updating location:', error);
      setAddressError('Could not update this location. Please check the address and try again.');
    } finally {
      setIsAddingLocation(false);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setNewLocationAddress('');
    setAddressSuggestions([]);
    setAddressError(null);
  };

  // Delete a custom location
  const deleteLocation = (locationId: string) => {
    // Remove from custom locations array (will trigger save to localStorage)
    setCustomLocations(prevLocations => prevLocations.filter(loc => loc.id !== locationId));
    
    // If this location is used in the route, remove it
    setRouteWaypoints(routeWaypoints.filter(wp => wp?.id !== locationId));
  };

  // Add new function to toggle the location manager modal
  const toggleLocationManager = () => {
    setShowLocationManager(!showLocationManager);
  };
  
  // Handle location selection from location manager
  const handleLocationSelected = (location: CustomLocation) => {
    // When a location is selected in the manager, add it to the route waypoints
    // if in routing mode
    console.log('Location selected from manager:', location);
    
    if (isRoutingMode) {
      // Find first empty slot or add to end
      const emptyIndex = routeWaypoints.findIndex(wp => wp === null);
      
      if (emptyIndex >= 0) {
        const newWaypoints = [...routeWaypoints];
        newWaypoints[emptyIndex] = location;
        setRouteWaypoints(newWaypoints);
      } else {
        setRouteWaypoints([...routeWaypoints, location]);
      }
      console.log('Added location to waypoints:', location.name);
    }
    
    // And make sure the location exists in our customLocations state if it doesn't already
    if (!customLocations.some(loc => loc.id === location.id)) {
      setCustomLocations(prevLocations => [...prevLocations, location]);
      console.log('Added new location to customLocations:', location.name);
    }
    
    setShowLocationManager(false); // Close the modal after selection
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FiRefreshCw className="h-10 w-10 mx-auto mb-4 text-primary-500 animate-spin" />
            <p className="text-gray-700 dark:text-gray-300">Loading job map...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <FiRefreshCw className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="mb-4">{error}</p>
          <button 
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
            onClick={refreshJobs}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between p-3 gap-2">
          <div className="flex items-baseline gap-2 min-w-0 shrink">
            <FiMapPin className="text-primary-400 h-5 w-5 self-center" />
            <h1 className="text-lg font-semibold min-w-0">Job Map</h1>
            <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-md ml-2 mt-px">
              {filteredJobs.length} jobs
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {/* Week Navigation Controls */}
            <div className="flex items-center gap-1 bg-[#2d3c55] p-1 rounded-md">
              <button
                onClick={handlePreviousWeek}
                className="px-2 py-1 text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title="Previous Week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 text-sm text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title={todayButtonTitle}
              >
                {todayButtonText}
              </button>
              <button
                onClick={handleNextWeek}
                className="px-2 py-1 text-gray-300 hover:bg-[#3a4a66] rounded-md"
                title="Next Week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="text-sm text-gray-300">
              {formatDateRange(currentWeekStart, currentWeekEnd)}
            </div>
            
            <div className="flex rounded-md overflow-hidden border border-gray-700">
              <button 
                className={`px-3 py-1.5 flex items-center gap-1 ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'}`}
                onClick={() => toggleViewMode('split')}
                title="Split View"
              >
                <FiList className="h-4 w-4" />
                <FiMap className="h-4 w-4" />
              </button>
              <button 
                className={`px-3 py-1.5 flex items-center gap-1 ${viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'}`}
                onClick={() => toggleViewMode('map')}
                title="Map View"
              >
                <FiMap className="h-4 w-4" />
              </button>
              <button 
                className={`px-3 py-1.5 flex items-center gap-1 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'}`}
                onClick={() => toggleViewMode('list')}
                title="List View"
              >
                <FiList className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => {
                if (isViewAllMode) {
                  // Switch to "Focus Selected" mode
                  setFlyToEnabled(true);
                  setIsViewAllMode(false);
                  if (selectedJob) {
                    // Use setTimeout to ensure state updates first
                    setTimeout(() => {
                      // Fake a selection event to trigger focusing on the selected job
                      handleJobSelect(selectedJob, 'map');
                    }, 50);
                  }
                } else {
                  // Switch to "View All" mode
                  jobMapRef.current?.fitToAllMarkers();
                  setFlyToEnabled(false); // Disable flyTo when viewing all
                  setIsViewAllMode(true); // Set view all mode
                }
              }}
              className={`px-3 py-1.5 flex items-center gap-1 rounded-md ${
                isViewAllMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isViewAllMode ? "Focus on Selected Job" : "View All Jobs on Map"}
            >
              {isViewAllMode ? (
                <>
                  <FiMapPin className="h-4 w-4" />
                  <span>Focus Selected</span>
                </>
              ) : (
                <>
                  <FiMaximize className="h-4 w-4" />
                  <span>View All</span>
                </>
              )}
            </button>

            <button
              onClick={toggleRoutingMode}
              className={`px-3 py-1.5 flex items-center gap-1 rounded-md ${
                isRoutingMode 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isRoutingMode ? "Exit Routing Mode" : "Enter Routing Mode"}
            >
              <FiNavigation className="h-4 w-4" />
              <span>Routing</span>
            </button>

            <button
              onClick={refreshJobs}
              className="px-3 py-1.5 flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
              disabled={isRefreshing}
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* New scrollable container for content below header */}
      <div className="flex-1 overflow-y-auto">
        {/* Location Manager Modal */}
        {showLocationManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div 
              className="relative max-w-lg w-full mx-4" 
              onClick={(e) => e.stopPropagation()}
            >
              <LocationManager 
                onClose={() => setShowLocationManager(false)}
                onLocationSelected={handleLocationSelected}
                mode="manage" 
              />
            </div>
          </div>
        )}
        
        {/* Routing Panel - Only visible in routing mode */}
        {isRoutingMode && (
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
                <FiNavigation className="mr-2 text-green-600 dark:text-green-400" />
                Route Planning
              </h3>
            </div>
            <div className="p-4">
              {/* Add Manage Locations button */}
              <div className="mb-4">
                <button
                  onClick={toggleLocationManager}
                  className="flex items-center justify-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors w-full"
                >
                  <FiHome className="h-4 w-4 mr-2" />
                  Manage Saved Locations
                </button>
              </div>
              
              {/* Waypoint inputs */}
              <div className="space-y-4">
                {routeWaypoints.map((waypoint, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-grow">
                      {/* Numbered waypoint indicator */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-medium">
                          {index + 1}
                        </div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {index === 0 ? 'Start' : index === routeWaypoints.length - 1 ? 'End' : 'Stop'}
                        </label>
                      </div>
                      
                      {showAddLocationForm.index === index ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Location Name (e.g., Home)"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                            disabled={isAddingLocation}
                          />
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Start typing an address..."
                              value={newLocationAddress}
                              onChange={(e) => handleAddressInput(e.target.value)}
                              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                              disabled={isAddingLocation}
                            />
                            
                            {/* Address suggestions dropdown */}
                            {addressSuggestions.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                                {addressSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                                    onClick={() => handleAddCustomLocation(suggestion)}
                                  >
                                    {suggestion.place_name}
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            {/* Loading indicator for suggestions */}
                            {isLoadingSuggestions && (
                              <div className="absolute right-2 top-2">
                                <FiLoader className="h-4 w-4 text-gray-400 animate-spin" />
                              </div>
                            )}
                          </div>
                          {addressError && (
                            <div className="text-red-500 text-xs mt-1">{addressError}</div>
                          )}
                          <div className="flex space-x-2 pt-1">
                            <button
                              onClick={() => handleAddCustomLocation()}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-sm flex items-center justify-center"
                              disabled={isAddingLocation}
                            >
                              {isAddingLocation ? (
                                <FiLoader className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <FiPlus className="h-4 w-4 mr-1" />
                              )}
                              <span>Add</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowAddLocationForm({ index: null });
                                setNewLocationName('');
                                setNewLocationAddress('');
                                setAddressSuggestions([]);
                                setAddressError(null);
                              }}
                              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-300 py-1 px-2 rounded text-sm"
                              disabled={isAddingLocation}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={waypoint?.id || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "add-custom") {
                              setShowAddLocationForm({ index });
                            } else {
                              const selectedJob = filteredJobs.find(job => job.id === value);
                              const customLocation = customLocations.find(loc => loc.id === value);
                              
                              // Debug which location was found
                              if (selectedJob) {
                                console.log(`Selected job: ${selectedJob.id} - ${selectedJob.clientName}`);
                              } else if (customLocation) {
                                console.log(`Selected custom location: ${customLocation.id} - ${customLocation.name}`);
                              } else {
                                console.warn(`No location found for ID: ${value}`);
                              }
                              
                              const newWaypoints = [...routeWaypoints];
                              newWaypoints[index] = selectedJob || customLocation || null;
                              setRouteWaypoints(newWaypoints);
                              setRouteInfo(null); // Clear route info when waypoint changes
                            }
                          }}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                        >
                          <option value="">Select a location...</option>
                          
                          {/* Custom locations group - add debug logging */}
                          {(() => {
                            if (customLocations.length > 0) {
                              console.log(`Rendering ${customLocations.length} custom locations in dropdown`);
                              return (
                                <optgroup label={`Custom Locations (${customLocations.length})`}>
                                  {customLocations.map(location => {
                                    // Debug to make sure we're rendering each location correctly
                                    console.log(`Rendering custom location option: ${location.id} - ${location.name}`);
                                    return (
                                      <option key={location.id} value={location.id}>
                                        {location.name}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              );
                            } else {
                              console.log('No custom locations available for dropdown');
                              return null;
                            }
                          })()}
                          
                          {/* Jobs group */}
                          {filteredJobs.length > 0 && (
                            <optgroup label="Jobs">
                              {filteredJobs.map(job => (
                                <option key={job.id} value={job.id}>
                                  {job.clientName} {job.storeNumber ? `(${job.storeNumber})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          
                          <optgroup label="Actions">
                            <option value="add-custom">+ Add custom location</option>
                          </optgroup>
                        </select>
                      )}
                    </div>
                    
                    {/* Waypoint actions */}
                    <div className="flex flex-col gap-1 pt-6">
                      {/* Move up */}
                      {index > 0 && (
                        <button
                          onClick={() => swapWaypoints(index, index - 1)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                      )}
                      
                      {/* Move down */}
                      {index < routeWaypoints.length - 1 && (
                        <button
                          onClick={() => swapWaypoints(index, index + 1)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                      )}
                      
                      {/* Remove */}
                      {routeWaypoints.length > 2 && (
                        <button
                          onClick={() => removeWaypoint(index)}
                          className="text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Remove waypoint"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Add waypoint button */}
                <button 
                  onClick={addWaypointSlot}
                  className="flex items-center justify-center w-full py-2 px-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <FiPlus className="h-4 w-4 mr-2" />
                  Add another stop
                </button>
              </div>
              
              {/* Route info display */}
              <div className="mt-4">
                {routeCalculating ? (
                  <div className="h-full flex items-center justify-center py-4">
                    <div className="animate-pulse flex items-center">
                      <FiLoader className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin mr-2" />
                      <span className="text-gray-600 dark:text-gray-300">Calculating route...</span>
                    </div>
                  </div>
                ) : routeInfo ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {routingService.formatDriveTime(routeInfo.duration)}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      {routingService.formatDistance(routeInfo.distance)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <span className="text-gray-500 dark:text-gray-400 text-sm italic">
                      {routeWaypoints.length >= 2 ? 
                        'Calculating route...' : 
                        'Select at least a starting point and destination'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Custom locations management */}
              {customLocations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center mb-2">
                    <FiHome className="mr-2 text-amber-500" />
                    Saved Locations
                  </h4>

                  {/* Location edit form */}
                  {editingLocation ? (
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                      <h5 className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">Edit Location</h5>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Location Name"
                          value={newLocationName}
                          onChange={(e) => setNewLocationName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                          disabled={isAddingLocation}
                        />
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Address"
                            value={newLocationAddress}
                            onChange={(e) => handleAddressInput(e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-3 text-sm"
                            disabled={isAddingLocation}
                          />
                          
                          {/* Address suggestions dropdown */}
                          {addressSuggestions.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                              {addressSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.id}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                                  onClick={() => saveEditedLocation(suggestion)}
                                >
                                  {suggestion.place_name}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Loading indicator for suggestions */}
                          {isLoadingSuggestions && (
                            <div className="absolute right-2 top-2">
                              <FiLoader className="h-4 w-4 text-gray-400 animate-spin" />
                            </div>
                          )}
                        </div>
                        {addressError && (
                          <div className="text-red-500 text-xs mt-1">{addressError}</div>
                        )}
                        <div className="flex space-x-2 pt-1">
                          <button
                            onClick={() => saveEditedLocation()}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-sm flex items-center justify-center"
                            disabled={isAddingLocation}
                          >
                            {isAddingLocation ? (
                              <FiLoader className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path></svg>
                            )}
                            <span>Save</span>
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-300 py-1 px-2 rounded text-sm"
                            disabled={isAddingLocation}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {customLocations.map(location => (
                        <div 
                          key={location.id}
                          className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full pl-3 pr-1 py-1"
                        >
                          <span className="text-xs text-gray-700 dark:text-gray-300 mr-1" title={location.address}>
                            {location.name}
                          </span>
                          <div className="flex">
                            {/* Edit button */}
                            <button
                              onClick={() => startEditingLocation(location)}
                              className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded-full p-1"
                              title="Edit location"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            {/* Delete button */}
                            <button
                              onClick={() => deleteLocation(location.id)}
                              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-full p-1"
                              title="Remove location"
                            >
                              <FiX className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Clear route button */}
              {routeWaypoints.length > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={clearRoute}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Clear route
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top section: Main content (List and Map) - removed flex-grow */}
        <div className={`grid grid-cols-1 ${viewMode === 'split' ? 'lg:grid-cols-3 gap-6' : 'gap-0'} mb-6`}>
          {(viewMode === 'split' || viewMode === 'list') && (
            <div className={`${viewMode === 'split' ? 'lg:col-span-1' : 'w-full'} flex flex-col gap-6`}>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex-1">
                <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    <FiList className="mr-2 text-primary-500" />
                    Job List
                  </h3>
                </div>
                
                <div className="overflow-y-auto max-h-[600px]">
                  <JobList 
                    jobs={filteredJobs}
                    selectedJob={selectedJob}
                    onSelectJob={(job) => handleJobSelect(job, 'list')}
                  />
                </div>
              </div>
            </div>
          )}
          
          {(viewMode === 'split' || viewMode === 'map') && (
            <div className={`${viewMode === 'split' ? 'lg:col-span-2' : 'w-full'} bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden`}>
              <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <FiMapPin className="mr-2 text-primary-500" />
                  Map View
                </h3>
              </div>
              
              <div className="h-[700px] relative">
                <JobMap 
                  ref={jobMapRef}
                  jobs={jobsForMap} 
                  selectedJob={selectedJob}
                  onSelectJob={(job) => handleJobSelect(job, 'map')}
                  enableFlyTo={flyToEnabled}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom section: Job Details Pane - Only shown when not in routing mode */}
        {!isRoutingMode && (
          <div className="mt-0"> {/* Ensure no extra top margin if the top section has mb-6 */}
            <JobDetailsPane 
              selectedJob={selectedJob} 
              jobs={filteredJobs}
              jobMapRef={jobMapRef}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default JobMapView; 
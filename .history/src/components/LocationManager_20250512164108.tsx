import React, { useState, useEffect, useRef } from 'react';
import { CustomLocation, serializeLocation, deserializeLocation } from '../services/routingService';
import locationStorageService from '../services/locationStorageService';

// Flag to completely disable Electron storage attempts during debugging
// Set to true to completely bypass Electron and use only localStorage
const BYPASS_ELECTRON_STORAGE = false;

interface LocationManagerProps {
  onLocationSelected?: (location: CustomLocation) => void;
  onClose?: () => void;
  mode?: 'select' | 'manage';
}

/**
 * LocationManager component
 * Allows users to manage custom locations (add, edit, delete)
 */
const LocationManager: React.FC<LocationManagerProps> = ({ 
  onLocationSelected,
  onClose,
  mode = 'manage'
}) => {
  const [locations, setLocations] = useState<CustomLocation[]>([]);
  const [newLocation, setNewLocation] = useState<{
    name: string;
    address: string;
  }>({ name: '', address: '' });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [storageErrors, setStorageErrors] = useState<number>(0);
  
  // On component mount, check if we need to bypass Electron
  useEffect(() => {
    if (BYPASS_ELECTRON_STORAGE) {
      // Manually disable Electron storage if flag is set
      locationStorageService.disableElectronStorage();
      console.log('Manually disabled Electron storage due to BYPASS_ELECTRON_STORAGE flag');
    }
  }, []);
  
  // Address suggestion state
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{
    place_name: string;
    center: [number, number]; // [longitude, latitude]
    id: string;
  }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const addressInputTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add a location directly to localStorage as a fallback if main storage fails
  const saveLocationToLocalStorageFallback = (updatedLocations: CustomLocation[]) => {
    try {
      // Sanitize each location using our dedicated helpers
      const sanitizedJson = JSON.stringify(
        updatedLocations.map(loc => {
          // Serialize and then deserialize to ensure clean objects
          const serialized = serializeLocation(loc);
          const deserialized = deserializeLocation(serialized);
          return deserialized || {
            id: String(loc.id || `fallback_${Date.now()}`),
            name: String(loc.name || 'Fallback Location'),
            address: String(loc.address || ''),
            coordinates: {
              latitude: Number(loc.coordinates?.latitude || 0),
              longitude: Number(loc.coordinates?.longitude || 0)
            }
          };
        })
      );
      
      localStorage.setItem('mapview_custom_locations', sanitizedJson);
      console.log('Saved locations directly to localStorage as fallback');
      return true;
    } catch (err) {
      console.error('Failed to save to localStorage fallback:', err);
      return false;
    }
  };

  // Direct load from localStorage, bypassing the service
  const loadDirectlyFromLocalStorage = (): CustomLocation[] => {
    try {
      const data = localStorage.getItem('mapview_custom_locations');
      if (!data) {
        console.log('No locations found in localStorage');
        return [];
      }
      
      // Clean the data and parse it
      const cleanData = data.replace(/[^\x20-\x7E]/g, '');
      const parsed = JSON.parse(cleanData);
      
      if (!Array.isArray(parsed)) {
        console.warn('Invalid location data format in localStorage');
        return [];
      }
      
      // Sanitize each location
      return parsed.map(item => {
        try {
          // Use serialization/deserialization for maximum safety
          const serialized = serializeLocation(item);
          const deserialized = deserializeLocation(serialized);
          
          if (deserialized) return deserialized;
          
          // Fallback if deserialization fails
          return {
            id: String(item.id || `loc_${Date.now()}_${Math.random()}`),
            name: String(item.name || 'Unnamed Location'),
            address: String(item.address || ''),
            coordinates: {
              latitude: Number(item.coordinates?.latitude || 0),
              longitude: Number(item.coordinates?.longitude || 0)
            }
          };
        } catch (err) {
          console.error('Error processing location item:', err);
          return {
            id: `error_${Date.now()}_${Math.random()}`,
            name: 'Error Location',
            address: '',
            coordinates: { latitude: 0, longitude: 0 }
          };
        }
      });
    } catch (err) {
      console.error('Error reading from localStorage directly:', err);
      return [];
    }
  };

  // Load saved locations on component mount
  useEffect(() => {
    const loadSavedLocations = async () => {
      setIsLoading(true);
      
      try {
        // Track if retrying with localStorage only
        let isRetry = false;
        let savedLocations: CustomLocation[] = [];
        
        // First attempt: Try the regular method through service
        try {
          savedLocations = await locationStorageService.loadLocations();
          console.log('Successfully loaded locations:', savedLocations.length);
        } catch (serviceError) {
          console.error('Service error during location load:', serviceError);
          
          // Update error counter and potentially trigger a direct localStorage load
          setStorageErrors(prev => {
            const newCount = prev + 1;
            if (newCount >= 3) {
              // After 3 errors, manually disable Electron for all future operations
              locationStorageService.disableElectronStorage();
              console.warn('Too many errors, disabled Electron storage');
            }
            return newCount;
          });
          
          // Flag that we're retrying with direct localStorage
          isRetry = true;
          
          // Try direct localStorage access
          savedLocations = loadDirectlyFromLocalStorage();
        }
        
        // Only update state if we have valid data
        if (Array.isArray(savedLocations)) {
          // Make one final check to ensure all locations are properly sanitized
          const sanitizedLocations = savedLocations.map(loc => {
            // Use the serialize/deserialize helpers for maximum safety
            const serialized = serializeLocation(loc);
            const deserialized = deserializeLocation(serialized);
            return deserialized || {
              id: String(loc.id || `loc_${Date.now()}_${Math.random()}`),
              name: String(loc.name || 'Unnamed Location'),
              address: String(loc.address || ''),
              coordinates: {
                latitude: Number(loc.coordinates?.latitude || 0), 
                longitude: Number(loc.coordinates?.longitude || 0)
              }
            };
          });
          
          setLocations(sanitizedLocations);
          setError(null);
          
          // If this was a retry that worked, update UI to notify user
          if (isRetry && sanitizedLocations.length > 0) {
            console.log('Successfully recovered data using alternate method');
          }
        } else {
          // If data is still invalid, set an empty array
          console.warn('Invalid location data format, using empty array');
          setLocations([]);
        }
      } catch (err) {
        console.error('Failed to load locations:', err);
        setError('Failed to load saved locations. Please try again.');
        // Still need to set locations to empty array to prevent undefined errors
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedLocations();
    
    // Add the effect dependency on electronStorageDisabled to reload if it changes
  }, [locationStorageService.isElectronStorageDisabled()]);

  // Get address suggestions as user types with debounce
  const getAddressSuggestions = async (query: string) => {
    if (query.length < 1) {
      setAddressSuggestions([]);
      return;
    }
    
    try {
      setIsLoadingSuggestions(true);
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('Mapbox access token not found');
      }
      
      // Call Mapbox Geocoding API for suggestions
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${accessToken}&` +
        `types=address,poi,place&` + // Focus on addresses, points of interest, and places
        `limit=5` // Limit results
      );
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAddressSuggestions(data.features || []);
    } catch (err) {
      console.error('Error fetching address suggestions:', err);
      setAddressSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle address input with debounce
  const handleAddressInput = (address: string) => {
    setNewLocation({...newLocation, address});
    
    // Clear any existing timeout
    if (addressInputTimeout.current) {
      clearTimeout(addressInputTimeout.current);
    }
    
    // Set a new timeout to fetch suggestions
    addressInputTimeout.current = setTimeout(() => {
      getAddressSuggestions(address);
    }, 300); // 300ms debounce
  };

  // Geocode an address to get coordinates
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    setIsGeocoding(true);
    setError(null);
    
    try {
      // Use Mapbox Geocoding API
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('Mapbox access token not found');
      }
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${accessToken}`
      );
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        setError('Address not found. Please check and try again.');
        return null;
      }
      
      // Get the first result
      const [longitude, latitude] = data.features[0].center;
      
      return { lat: latitude, lng: longitude };
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Failed to geocode the address. Please try a different address.');
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle selecting a suggestion from the dropdown
  const handleSelectSuggestion = async (suggestion: { place_name: string; center: [number, number]; id: string }) => {
    setNewLocation({...newLocation, address: suggestion.place_name});
    setAddressSuggestions([]);
  };

  // Handle adding a new location
  const handleAddLocation = async () => {
    if (!newLocation.name.trim() || !newLocation.address.trim()) {
      setError('Name and address are required');
      return;
    }

    try {
      const coordinates = await geocodeAddress(newLocation.address);
      if (!coordinates) {
        return; // Error already set by geocodeAddress
      }

      const newLocationData: CustomLocation = {
        id: `loc_${Date.now()}`,
        name: newLocation.name.trim(),
        address: newLocation.address.trim(),
        coordinates: {
          latitude: coordinates.lat,
          longitude: coordinates.lng
        }
      };

      // First update local state to ensure UI updates immediately
      const updatedLocations = [...locations, newLocationData];
      setLocations(updatedLocations);
      
      // Try to save via service (which now handles fallbacks internally)
      try {
        await locationStorageService.saveLocations(updatedLocations);
      } catch (saveError) {
        console.error('Error saving locations:', saveError);
        
        // Increment error counter and try direct localStorage as a last resort
        setStorageErrors(prev => prev + 1);
        
        // If service completely failed, try direct localStorage
        if (!saveLocationToLocalStorageFallback(updatedLocations)) {
          // If both methods fail, show a user-facing error
          setError('Failed to save location. Your changes may not persist if you leave the page.');
        }
      }
      
      // Reset form
      setNewLocation({ name: '', address: '' });
      setAddressSuggestions([]);
      
      // Only clear error if it was a save error (not an address error)
      if (error && error.includes('Failed to save')) {
        setError(null);
      }
    } catch (err) {
      console.error('Error adding location:', err);
      setError('Failed to add location. Please try again.');
    }
  };

  // Handle deleting a location
  const handleDeleteLocation = async (locationId: string) => {
    try {
      // Create a new array without the deleted location
      const updatedLocations = locations.filter(loc => loc.id !== locationId);
      
      // Update state immediately for responsive UI
      setLocations(updatedLocations);
      
      // Try to save via service (which now handles fallbacks internally)
      try {
        await locationStorageService.saveLocations(updatedLocations);
      } catch (deleteError) {
        console.error('Error saving after deletion:', deleteError);
        
        // Increment error counter and try direct localStorage as a last resort
        setStorageErrors(prev => prev + 1);
        
        // If service completely failed, try direct localStorage
        if (!saveLocationToLocalStorageFallback(updatedLocations)) {
          // If both methods fail, show a user-facing error
          setError('Failed to delete location. The item may reappear when you reload the page.');
        }
      }
      
      // Clear any errors
      setError(null);
    } catch (err) {
      console.error('Error deleting location:', err);
      setError('Failed to delete location. Please try again.');
    }
  };

  // Handle location selection
  const handleSelectLocation = (location: CustomLocation) => {
    setSelectedLocationId(location.id);
    if (onLocationSelected) {
      onLocationSelected(location);
    }
  };

  // Clean up any timers when component unmounts
  useEffect(() => {
    return () => {
      if (addressInputTimeout.current) {
        clearTimeout(addressInputTimeout.current);
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 max-w-md w-full max-h-[90vh] flex flex-col z-50">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">{mode === 'select' ? 'Select Location' : 'Manage Locations'}</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 p-3 mb-4 rounded">
          {error}
        </div>
      )}

      {/* Add new location form */}
      <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-medium mb-3 text-gray-800 dark:text-gray-200">Add New Location</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={newLocation.name}
            onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm py-2 px-3 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Home, Work, etc."
          />
        </div>
        <div className="mb-4 relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
          <input
            type="text"
            value={newLocation.address}
            onChange={(e) => handleAddressInput(e.target.value)}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm py-2 px-3 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="123 Main St, City, State"
          />
          
          {/* Loading indicator */}
          {isLoadingSuggestions && (
            <div className="absolute right-3 top-9">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          )}
          
          {/* Address suggestions dropdown */}
          {addressSuggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                        rounded-md shadow-lg max-h-60 overflow-auto py-1">
              {addressSuggestions.map(suggestion => (
                <li 
                  key={suggestion.id}
                  className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 
                          cursor-pointer transition-colors"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  {suggestion.place_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={handleAddLocation}
          disabled={isGeocoding}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 
                   disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {isGeocoding ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
              Finding Location...
            </span>
          ) : 'Add Location'}
        </button>
      </div>

      {/* Saved locations list */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <h3 className="font-medium mb-2 text-gray-800 dark:text-gray-200">Saved Locations</h3>
        {isLoading ? (
          <div className="text-center py-6 flex-1 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">Loading saved locations...</span>
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-6 flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-md">
            <span className="text-gray-500 dark:text-gray-400">No saved locations</span>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto flex-1 -mx-2 px-2">
            {locations.map((location) => (
              <li key={location.id} className="py-3">
                <div className="flex justify-between items-center">
                  <div 
                    className={`flex-grow cursor-pointer ${selectedLocationId === location.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}
                    onClick={() => handleSelectLocation(location)}
                  >
                    <div className="font-medium">{location.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{location.address}</div>
                  </div>
                  {mode === 'manage' && (
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-2 p-1"
                      aria-label="Delete location"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LocationManager; 
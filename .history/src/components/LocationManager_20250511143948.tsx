import React, { useState, useEffect } from 'react';
import { CustomLocation } from '../services/routingService';
import locationStorageService from '../services/locationStorageService';

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

  // Load saved locations on component mount
  useEffect(() => {
    const loadSavedLocations = async () => {
      setIsLoading(true);
      try {
        const savedLocations = await locationStorageService.loadLocations();
        setLocations(savedLocations);
        setError(null);
      } catch (err) {
        console.error('Failed to load locations:', err);
        setError('Failed to load saved locations. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedLocations();
  }, []);

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
        },
        type: 'custom'
      };

      const updatedLocations = [...locations, newLocationData];
      setLocations(updatedLocations);
      
      // Save to storage
      await locationStorageService.saveLocations(updatedLocations);
      
      // Reset form
      setNewLocation({ name: '', address: '' });
      setError(null);
    } catch (err) {
      console.error('Error adding location:', err);
      setError('Failed to add location. Please try again.');
    }
  };

  // Handle deleting a location
  const handleDeleteLocation = async (locationId: string) => {
    try {
      const updatedLocations = locations.filter(loc => loc.id !== locationId);
      setLocations(updatedLocations);
      
      // Save to storage
      await locationStorageService.saveLocations(updatedLocations);
      
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

  return (
    <div className="bg-white rounded-lg shadow p-4 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{mode === 'select' ? 'Select Location' : 'Manage Locations'}</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-2 mb-4">
          {error}
        </div>
      )}

      {/* Add new location form */}
      <div className="mb-4 p-3 border rounded-md">
        <h3 className="font-medium mb-2">Add New Location</h3>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={newLocation.name}
            onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Home, Work, etc."
          />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <input
            type="text"
            value={newLocation.address}
            onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="123 Main St, City, State"
          />
        </div>
        <button
          onClick={handleAddLocation}
          disabled={isGeocoding}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300"
        >
          {isGeocoding ? 'Finding Location...' : 'Add Location'}
        </button>
      </div>

      {/* Saved locations list */}
      <div>
        <h3 className="font-medium mb-2">Saved Locations</h3>
        {isLoading ? (
          <div className="text-center py-4">Loading saved locations...</div>
        ) : locations.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No saved locations</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {locations.map((location) => (
              <li key={location.id} className="py-3">
                <div className="flex justify-between items-center">
                  <div 
                    className={`flex-grow cursor-pointer ${selectedLocationId === location.id ? 'text-blue-600' : ''}`}
                    onClick={() => handleSelectLocation(location)}
                  >
                    <div className="font-medium">{location.name}</div>
                    <div className="text-sm text-gray-500">{location.address}</div>
                  </div>
                  {mode === 'manage' && (
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
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
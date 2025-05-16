import { CustomLocation, serializeLocation, deserializeLocation } from './routingService';
import { ElectronAPI } from '../types/electron';

// Storage key constants
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';

// CRITICAL FIX: Force localStorage only to completely bypass Electron file system
// This completely skips the Electron file system to avoid all structured clone errors
const FORCE_LOCALSTORAGE_ONLY = true;

/**
 * Helper to safely serialize location data
 */
const serializeLocations = (locations: CustomLocation[]): string => {
  try {
    // Sanitize each location
    const sanitizedLocations = locations.map(loc => {
      // Use our serialization helper to ensure clean objects
      const serialized = serializeLocation(loc);
      const deserialized = deserializeLocation(serialized);
      
      if (deserialized) return deserialized;
      
      // Fallback sanitized object if deserialization failed
      return {
        id: String(loc.id || `fallback_${Date.now()}`),
        name: String(loc.name || 'Unnamed'),
        address: String(loc.address || ''),
        coordinates: {
          latitude: Number(loc.coordinates?.latitude || 0),
          longitude: Number(loc.coordinates?.longitude || 0)
        }
      };
    });
    
    // Convert to safe JSON string
    return JSON.stringify(sanitizedLocations);
  } catch (error) {
    console.error('Error serializing locations:', error);
    return '[]'; // Empty array as fallback
  }
};

/**
 * Helper to safely deserialize location data
 */
const deserializeLocations = (data: string | null): CustomLocation[] => {
  if (!data) return [];
  
  try {
    // Clean the data string first
    const cleanData = data.replace(/[^\x20-\x7E]/g, '');
    const parsed = JSON.parse(cleanData);
    
    if (!Array.isArray(parsed)) {
      console.warn('Invalid location data format, not an array');
      return [];
    }
    
    // Process each location with extra safety
    return parsed.map(item => {
      try {
        // Use our deserialization helper
        const locJson = JSON.stringify(item);
        const deserialized = deserializeLocation(locJson);
        
        if (deserialized) return deserialized;
        
        // Manual conversion if deserialization failed
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
        console.error('Error deserializing location item:', err);
        return {
          id: `error_${Date.now()}_${Math.random()}`,
          name: 'Error Location',
          address: '',
          coordinates: { latitude: 0, longitude: 0 }
        };
      }
    });
  } catch (err) {
    console.error('Error deserializing locations:', err);
    return [];
  }
};

/**
 * Location Storage Service
 * 
 * IMPORTANT: This implementation now ONLY uses localStorage for location storage
 * to completely avoid Electron structured clone errors.
 */
const locationStorageService = {
  /**
   * Save custom locations to persistent storage
   * 
   * @param locations Array of custom locations to save
   * @returns Promise that resolves when save is complete
   */
  saveLocations: async (locations: CustomLocation[]): Promise<void> => {
    try {
      // Serialize the locations to a JSON string
      const locationsJson = serializeLocations(locations);
      
      // Save directly to localStorage (bypass Electron completely)
      localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, locationsJson);
      console.log(`Saved ${locations.length} locations to localStorage (Electron bypassed)`);
    } catch (error) {
      console.error('Error saving custom locations:', error);
      throw error;
    }
  },

  /**
   * Load custom locations from persistent storage
   * 
   * @returns Promise that resolves with loaded locations or empty array if none found
   */
  loadLocations: async (): Promise<CustomLocation[]> => {
    try {
      // Load directly from localStorage (bypass Electron completely)
      const locationsData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
      
      if (locationsData) {
        console.log('Retrieved location data from localStorage (Electron bypassed)');
        const locations = deserializeLocations(locationsData);
        console.log(`Loaded ${locations.length} saved locations`);
        return locations;
      } else {
        console.log('No saved locations found in localStorage');
        return [];
      }
    } catch (error) {
      console.error('Error loading custom locations:', error);
      return []; // Return empty array on error
    }
  },
  
  /**
   * Delete all saved custom locations
   * 
   * @returns Promise that resolves when deletion is complete
   */
  clearLocations: async (): Promise<void> => {
    try {
      // Clear directly from localStorage (bypass Electron completely)
      localStorage.removeItem(STORAGE_KEY_CUSTOM_LOCATIONS);
      console.log('Cleared locations from localStorage (Electron bypassed)');
    } catch (error) {
      console.error('Error clearing custom locations:', error);
      throw error;
    }
  },
  
  /**
   * Check if Electron storage is disabled (always returns true now)
   */
  isElectronStorageDisabled: (): boolean => {
    return true; // Always true since we're forcing localStorage only
  },
  
  /**
   * Disable Electron storage (no-op since it's already disabled)
   */
  disableElectronStorage: (): void => {
    console.log('Electron storage is permanently disabled');
  }
};

export default locationStorageService; 
import { CustomLocation, serializeLocation, deserializeLocation } from './routingService';
import { ElectronAPI } from '../types/electron';

// Storage key constants
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';
const USER_DATA_FOLDER = 'userdata';
const LOCATIONS_FILENAME = 'custom-locations.json';

// Helper function to sanitize location data for serialization
const sanitizeLocation = (location: CustomLocation): CustomLocation => {
  try {
    // Use the dedicated serialization/deserialization helpers
    const serialized = serializeLocation(location);
    const deserialized = deserializeLocation(serialized);
    
    // If deserialization fails, return a fallback
    if (!deserialized) {
      return {
        id: String(location.id || `fallback_${Date.now()}`),
        name: String(location.name || 'Error Location'),
        address: String(location.address || ''),
        coordinates: {
          latitude: 0,
          longitude: 0
        }
      };
    }
    
    return deserialized;
  } catch (error) {
    console.error('Error sanitizing location:', error);
    // Return a minimal valid location as fallback
    return {
      id: String(location.id || `fallback_${Date.now()}`),
      name: String(location.name || 'Error Location'),
      address: String(location.address || ''),
      coordinates: {
        latitude: 0,
        longitude: 0
      }
    };
  }
};

// Helper to make serializable locations array (for both Electron and localStorage)
const prepareLocationsForStorage = (locations: CustomLocation[]): string => {
  try {
    // Make sure locations is an array and sanitize each item using our helpers
    const sanitizedLocations = Array.isArray(locations) 
      ? locations.map(loc => {
          // Use serialization/deserialization for safety
          const serialized = serializeLocation(loc);
          const deserialized = deserializeLocation(serialized);
          
          return deserialized || sanitizeLocation(loc);
        })
      : [];
    
    // Convert to JSON with safety measures for non-serializable values
    return JSON.stringify(sanitizedLocations, (key, value) => {
      // Handle potential circular references or non-serializable values
      if (typeof value === 'function' || 
          value instanceof Map || 
          value instanceof Set || 
          value instanceof Error ||
          value instanceof RegExp ||
          value === undefined) {
        return undefined; // Skip non-serializable values
      }
      return value;
    });
  } catch (error) {
    console.error('Error preparing locations for storage:', error);
    // Return empty array as fallback
    return '[]';
  }
};

// Helper to validate and normalize loaded locations
const validateAndNormalizeLocations = (data: any): CustomLocation[] => {
  try {
    // If data is a string, try to parse it
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Ensure it's an array
    if (!Array.isArray(parsedData)) {
      console.warn('Parsed location data is not an array, returning empty array');
      return [];
    }
    
    // Filter out invalid entries and sanitize valid ones
    return parsedData
      .filter(loc => {
        return typeof loc === 'object' && 
               loc !== null && 
               'id' in loc && 
               'name' in loc && 
               'address' in loc && 
               'coordinates' in loc &&
               typeof loc.coordinates === 'object' &&
               loc.coordinates !== null;
      })
      .map(loc => {
        // Use the serialization/deserialization helpers for maximum safety
        try {
          const serialized = serializeLocation(loc);
          const deserialized = deserializeLocation(serialized);
          return deserialized || sanitizeLocation(loc);
        } catch (serializationError) {
          console.error('Error during serialization of location:', serializationError);
          return sanitizeLocation(loc);
        }
      });
  } catch (error) {
    console.error('Error validating locations:', error);
    return [];
  }
};

/**
 * Location Storage Service
 * Handles saving and loading custom locations with Electron-aware storage
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
      // Prepare the locations data for storage
      const locationsJson = prepareLocationsForStorage(locations);
      
      // Check if we're in Electron
      if (window.electron && window.electron.fs) {
        try {
          // Use Electron IPC for file system storage
          // Make sure the userdata directory exists
          const userDataPath = window.electron.fs.join(USER_DATA_FOLDER);
          
          // Check if the directory exists first
          if (!window.electron.fs.exists(userDataPath)) {
            await window.electron.fs.mkdir(userDataPath);
          }
          
          const filePath = window.electron.fs.join(userDataPath, LOCATIONS_FILENAME);
          await window.electron.fs.writeFile(filePath, locationsJson);
          console.log(`Saved ${JSON.parse(locationsJson).length} locations to file system via Electron at ${filePath}`);
        } catch (dirError) {
          console.error('Error saving to Electron filesystem:', dirError);
          throw dirError; // Propagate error to trigger localStorage fallback
        }
      } else {
        // Fall back to localStorage for web browser environment
        localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, locationsJson);
        console.log(`Saved ${JSON.parse(locationsJson).length} locations to localStorage`);
      }
    } catch (error) {
      console.error('Error saving custom locations:', error);
      // If Electron save fails, try localStorage as backup
      if (window.electron) {
        try {
          const locationsJson = prepareLocationsForStorage(locations);
          localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, locationsJson);
          console.log('Fallback to localStorage successful after Electron save failed');
        } catch (backupError) {
          console.error('Backup localStorage save also failed:', backupError);
        }
      }
      // Rethrow the error to let caller handle it (e.g., show user message)
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
      let locationsData: string | null = null;
      
      // Check if we're in Electron
      if (window.electron && window.electron.fs) {
        try {
          // Use Electron IPC for file system access
          const userDataPath = window.electron.fs.join(USER_DATA_FOLDER);
          const filePath = window.electron.fs.join(userDataPath, LOCATIONS_FILENAME);
          
          // Check if the file exists before trying to read it
          if (window.electron.fs.exists(filePath)) {
            // Read the file but catch any cloning errors
            try {
              locationsData = await window.electron.fs.readFile(filePath, 'utf8');
              console.log('Retrieved location data from Electron file system');
            } catch (cloneError) {
              console.error('Error reading file data (likely a structured clone error):', cloneError);
              throw new Error('Structured clone error during Electron file read');
            }
          } else {
            console.log('Locations file does not exist in Electron file system');
          }
        } catch (fsError) {
          console.error('Error accessing Electron filesystem:', fsError);
          // Don't rethrow yet, try localStorage first
        }
      }
      
      // If Electron read failed or we're not in Electron, try localStorage
      if (!locationsData) {
        try {
          locationsData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
          if (locationsData) {
            console.log('Retrieved location data from localStorage');
          } else {
            console.log('No saved locations found in localStorage');
          }
        } catch (lsError) {
          console.error('Error accessing localStorage:', lsError);
        }
      }
      
      // If we still don't have any data, return empty array
      if (!locationsData) {
        console.log('No saved locations found in any storage');
        return [];
      }
      
      // Safely parse and validate the location data
      try {
        // Pre-sanitize the JSON string to remove any problematic characters
        const cleanedData = locationsData.replace(/[^\x20-\x7E]/g, '');
        
        // Validate and normalize the loaded locations
        const validLocations = validateAndNormalizeLocations(cleanedData);
        console.log(`Loaded ${validLocations.length} saved locations`);
        return validLocations;
      } catch (parseError) {
        console.error('Error parsing location data:', parseError);
        return []; // Return empty array as fallback
      }
    } catch (error) {
      console.error('Error loading custom locations:', error);
      
      // Try localStorage as backup if we haven't already
      try {
        const backupData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
        if (backupData) {
          // Extra careful parsing here
          try {
            const cleanData = backupData.replace(/[^\x20-\x7E]/g, '');
            const backupLocations = validateAndNormalizeLocations(cleanData);
            console.log('Fallback to localStorage successful after Electron load failed');
            return backupLocations;
          } catch (parseError) {
            console.error('Failed to parse backup data:', parseError);
          }
        }
      } catch (backupError) {
        console.error('Backup localStorage load also failed:', backupError);
      }
      
      // All attempts failed, return empty array
      return [];
    }
  },
  
  /**
   * Delete all saved custom locations
   * 
   * @returns Promise that resolves when deletion is complete
   */
  clearLocations: async (): Promise<void> => {
    try {
      // Check if we're in Electron
      if (window.electron && window.electron.fs) {
        try {
          // Use Electron fs methods for file deletion
          const userDataPath = window.electron.fs.join(USER_DATA_FOLDER);
          const filePath = window.electron.fs.join(userDataPath, LOCATIONS_FILENAME);
          
          // Check if file exists before trying to delete
          if (window.electron.fs.exists(filePath)) {
            // Since there's no direct delete method, we'll overwrite with empty array
            await window.electron.fs.writeFile(filePath, JSON.stringify([]));
            console.log('Cleared locations file via Electron');
          }
        } catch (fsError) {
          console.error('Error clearing Electron filesystem:', fsError);
          // Continue to clear localStorage regardless of Electron errors
        }
      }
      
      // Always clear localStorage as well
      localStorage.removeItem(STORAGE_KEY_CUSTOM_LOCATIONS);
      console.log('Cleared locations from localStorage');
    } catch (error) {
      console.error('Error clearing custom locations:', error);
      throw error;
    }
  }
};

// The Window interface is already declared in the electron.d.ts file
// No need to redeclare it here

export default locationStorageService; 
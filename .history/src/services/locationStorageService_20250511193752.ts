import { CustomLocation } from './routingService';
import { ElectronAPI } from '../types/electron';

// Storage key constants
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';
const USER_DATA_FOLDER = 'userdata';
const LOCATIONS_FILENAME = 'custom-locations.json';

// Helper function to sanitize location data for serialization
const sanitizeLocation = (location: CustomLocation): CustomLocation => {
  // Create a clean copy with only the required fields
  const sanitized = {
    id: String(location.id || ''),
    name: String(location.name || ''),
    address: String(location.address || ''),
    coordinates: {
      latitude: typeof location.coordinates?.latitude === 'number' 
        ? location.coordinates.latitude 
        : parseFloat(String(location.coordinates?.latitude || 0)),
      longitude: typeof location.coordinates?.longitude === 'number'
        ? location.coordinates.longitude
        : parseFloat(String(location.coordinates?.longitude || 0))
    }
  };
  
  return sanitized;
};

// Helper to make serializable locations array (for both Electron and localStorage)
const prepareLocationsForStorage = (locations: CustomLocation[]): string => {
  try {
    // Make sure locations is an array and sanitize each item
    const sanitizedLocations = Array.isArray(locations) 
      ? locations.map(loc => sanitizeLocation(loc))
      : [];
    
    // Convert to JSON, handle any circular reference errors
    return JSON.stringify(sanitizedLocations, (key, value) => {
      // Handle potential circular references or non-serializable values
      if (typeof value === 'function' || value instanceof Map || value instanceof Set) {
        return undefined; // Skip functions, Maps and Sets
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
      .map(sanitizeLocation);
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
            locationsData = await window.electron.fs.readFile(filePath, 'utf8');
            console.log('Retrieved location data from Electron file system');
          } else {
            console.log('Locations file does not exist in Electron file system');
          }
        } catch (fsError) {
          console.error('Error accessing Electron filesystem:', fsError);
          throw fsError; // Propagate error to trigger localStorage fallback
        }
      } else {
        // Fall back to localStorage for web browser environment
        locationsData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
        console.log('Retrieved location data from localStorage');
      }
      
      if (!locationsData) {
        console.log('No saved locations found');
        return [];
      }
      
      // Validate and normalize the loaded locations
      const validLocations = validateAndNormalizeLocations(locationsData);
      console.log(`Loaded ${validLocations.length} saved locations`);
      return validLocations;
    } catch (error) {
      console.error('Error loading custom locations:', error);
      
      // Try localStorage as backup if Electron load fails
      if (window.electron) {
        try {
          const backupData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
          if (backupData) {
            const backupLocations = validateAndNormalizeLocations(backupData);
            console.log('Fallback to localStorage successful after Electron load failed');
            return backupLocations;
          }
        } catch (backupError) {
          console.error('Backup localStorage load also failed:', backupError);
        }
      }
      
      // Rethrow the error to let caller handle it
      throw error;
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
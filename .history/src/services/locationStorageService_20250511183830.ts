import { CustomLocation } from './routingService';
import { ElectronAPI } from '../types/electron';

// Storage key constants
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';
const USER_DATA_FOLDER = 'userdata';
const LOCATIONS_FILENAME = 'custom-locations.json';

// Helper function to sanitize location data for serialization
const sanitizeLocation = (location: CustomLocation): CustomLocation => {
  // Create a clean copy with only the required fields
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    coordinates: {
      latitude: Number(location.coordinates.latitude),
      longitude: Number(location.coordinates.longitude)
    }
  };
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
      // Sanitize the locations to ensure they are serializable
      const sanitizedLocations = locations.map(sanitizeLocation);
      const locationsJson = JSON.stringify(sanitizedLocations);
      
      // Check if we're in Electron
      if (window.electron && window.electron.fs) {
        // Use Electron IPC for file system storage
        // Make sure the userdata directory exists
        const userDataPath = window.electron.fs.join(USER_DATA_FOLDER);
        
        try {
          // Check if the directory exists first
          if (!window.electron.fs.exists(userDataPath)) {
            await window.electron.fs.mkdir(userDataPath);
          }
        } catch (dirError) {
          console.error('Error creating directory:', dirError);
        }
        
        const filePath = window.electron.fs.join(userDataPath, LOCATIONS_FILENAME);
        await window.electron.fs.writeFile(filePath, locationsJson);
        console.log(`Saved ${sanitizedLocations.length} locations to file system via Electron at ${filePath}`);
      } else {
        // Fall back to localStorage for web browser environment
        localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, locationsJson);
        console.log(`Saved ${sanitizedLocations.length} locations to localStorage`);
      }
    } catch (error) {
      console.error('Error saving custom locations:', error);
      // If Electron save fails, try localStorage as backup
      if (window.electron) {
        try {
          const sanitizedLocations = locations.map(sanitizeLocation);
          localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, JSON.stringify(sanitizedLocations));
          console.log('Fallback to localStorage successful after Electron save failed');
        } catch (backupError) {
          console.error('Backup localStorage save also failed:', backupError);
        }
      }
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
      } else {
        // Fall back to localStorage for web browser environment
        locationsData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
        console.log('Retrieved location data from localStorage');
      }
      
      if (!locationsData) {
        console.log('No saved locations found');
        return [];
      }
      
      let parsedLocations: any[];
      try {
        parsedLocations = JSON.parse(locationsData);
      } catch (parseError) {
        console.error('Error parsing locations data:', parseError);
        return [];
      }
      
      // Validate and sanitize each location
      if (Array.isArray(parsedLocations)) {
        const validLocations: CustomLocation[] = [];
        
        for (const loc of parsedLocations) {
          if (typeof loc === 'object' && 
              loc !== null && 
              'id' in loc && 
              'name' in loc && 
              'address' in loc && 
              'coordinates' in loc &&
              loc.coordinates && 
              'latitude' in loc.coordinates &&
              'longitude' in loc.coordinates) {
            
            // Add a sanitized version to our valid locations
            validLocations.push({
              id: String(loc.id),
              name: String(loc.name),
              address: String(loc.address),
              coordinates: {
                latitude: Number(loc.coordinates.latitude),
                longitude: Number(loc.coordinates.longitude)
              }
            });
          } else {
            console.warn('Invalid location format found, skipping:', loc);
          }
        }
        
        console.log(`Loaded ${validLocations.length} saved locations`);
        return validLocations;
      } else {
        console.warn('Invalid locations data format, returning empty array');
        return [];
      }
    } catch (error) {
      console.error('Error loading custom locations:', error);
      
      // Try localStorage as backup if Electron load fails
      if (window.electron) {
        try {
          const backupData = localStorage.getItem(STORAGE_KEY_CUSTOM_LOCATIONS);
          if (backupData) {
            try {
              const backupLocations = JSON.parse(backupData);
              console.log('Fallback to localStorage successful after Electron load failed');
              
              // Validate and sanitize
              if (Array.isArray(backupLocations)) {
                return backupLocations
                  .filter(loc => 
                    typeof loc === 'object' && 
                    loc !== null && 
                    'id' in loc && 
                    'name' in loc && 
                    'address' in loc && 
                    'coordinates' in loc
                  )
                  .map(loc => ({
                    id: String(loc.id),
                    name: String(loc.name),
                    address: String(loc.address),
                    coordinates: {
                      latitude: Number(loc.coordinates.latitude),
                      longitude: Number(loc.coordinates.longitude)
                    }
                  }));
              }
            } catch (parseError) {
              console.error('Error parsing backup data:', parseError);
            }
          }
        } catch (backupError) {
          console.error('Backup localStorage load also failed:', backupError);
        }
      }
      
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
        // Use Electron fs methods for file deletion
        const userDataPath = window.electron.fs.join(USER_DATA_FOLDER);
        const filePath = window.electron.fs.join(userDataPath, LOCATIONS_FILENAME);
        
        // Check if file exists before trying to delete
        if (window.electron.fs.exists(filePath)) {
          // Since there's no direct delete method, we'll overwrite with empty array
          await window.electron.fs.writeFile(filePath, JSON.stringify([]));
          console.log('Cleared locations file via Electron');
        }
      }
      
      // Always clear localStorage as well
      localStorage.removeItem(STORAGE_KEY_CUSTOM_LOCATIONS);
      console.log('Cleared locations from localStorage');
    } catch (error) {
      console.error('Error clearing custom locations:', error);
    }
  }
};

// The Window interface is already declared in the electron.d.ts file
// No need to redeclare it here

export default locationStorageService; 
import { CustomLocation } from './routingService';
import { ElectronAPI } from '../types/electron';

// Storage key constants
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';
const USER_DATA_FOLDER = 'userdata';
const LOCATIONS_FILENAME = 'custom-locations.json';

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
        await window.electron.fs.writeFile(filePath, JSON.stringify(locations));
        console.log(`Saved ${locations.length} locations to file system via Electron at ${filePath}`);
      } else {
        // Fall back to localStorage for web browser environment
        localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, JSON.stringify(locations));
        console.log(`Saved ${locations.length} locations to localStorage`);
      }
    } catch (error) {
      console.error('Error saving custom locations:', error);
      // If Electron save fails, try localStorage as backup
      if (window.electron) {
        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM_LOCATIONS, JSON.stringify(locations));
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
      
      const locations = JSON.parse(locationsData);
      
      // Validate the data structure
      if (Array.isArray(locations) && 
          locations.every(loc => 
            typeof loc === 'object' && 
            loc !== null && 
            'id' in loc && 
            'name' in loc && 
            'address' in loc && 
            'coordinates' in loc &&
            'latitude' in loc.coordinates &&
            'longitude' in loc.coordinates
          )) {
        console.log(`Loaded ${locations.length} saved locations`);
        return locations;
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
            const locations = JSON.parse(backupData);
            console.log('Fallback to localStorage successful after Electron load failed');
            return locations;
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
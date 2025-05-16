import { CustomLocation } from './routingService';

// Storage key constants
const STORAGE_KEY_CUSTOM_LOCATIONS = 'mapview_custom_locations';

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
      if (window.electron && window.electron.saveData) {
        // Use Electron IPC for file system storage
        await window.electron.saveData('custom-locations.json', JSON.stringify(locations));
        console.log(`Saved ${locations.length} locations to file system via Electron`);
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
      if (window.electron && window.electron.loadData) {
        // Use Electron IPC for file system access
        locationsData = await window.electron.loadData('custom-locations.json');
        console.log('Retrieved location data from Electron file system');
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
      if (window.electron && window.electron.deleteData) {
        // Use Electron IPC for file deletion
        await window.electron.deleteData('custom-locations.json');
        console.log('Deleted locations file via Electron');
      }
      
      // Always clear localStorage as well
      localStorage.removeItem(STORAGE_KEY_CUSTOM_LOCATIONS);
      console.log('Cleared locations from localStorage');
    } catch (error) {
      console.error('Error clearing custom locations:', error);
    }
  }
};

// Add TypeScript interface for Electron features
// This prevents TypeScript errors when accessing the electron object
declare global {
  interface Window {
    electron?: {
      saveData: (filename: string, data: string) => Promise<void>;
      loadData: (filename: string) => Promise<string | null>;
      deleteData: (filename: string) => Promise<void>;
    };
  }
}

export default locationStorageService; 
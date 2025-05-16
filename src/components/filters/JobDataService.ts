import { WorkOrder } from '../../types';
import { debounce } from 'lodash';

/**
 * Service for loading, managing and refreshing job data
 */
class JobDataService {
  private static instance: JobDataService;
  private isLoadingRef: boolean = false;
  private lastLoadTimeRef: number = Date.now();
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  // Private constructor to enforce singleton pattern
  private constructor() {}
  
  /**
   * Get the singleton instance of JobDataService
   */
  public static getInstance(): JobDataService {
    if (!JobDataService.instance) {
      JobDataService.instance = new JobDataService();
    }
    return JobDataService.instance;
  }
  
  /**
   * Load initial job data with multi-source fallback strategy
   * @param setWorkOrders React setState function to update workOrders
   * @param setIsLoading React setState function to update loading state
   * @param loadDispenserData Function to load dispenser data from context
   * @param dispenserData Current dispenser data from context
   * @returns Promise resolving to the loaded workOrders
   */
  public async loadInitialData(
    setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    loadDispenserData: () => Promise<void>,
    dispenserData: any
  ): Promise<WorkOrder[]> {
    // Prevent concurrent loading
    if (this.isLoadingRef) {
      console.log('Initial data load already in progress, skipping');
      return [];
    }
    
    console.log('Starting initial data load');
    this.isLoadingRef = true;
    setIsLoading(true);
    
    try {
      // Multi-source strategy: API -> Local JSON -> Static Import
      let workOrders: WorkOrder[] = [];
      
      // First try to load data from the API
      try {
        const apiResponse = await fetch('/api/workorders');
        
        if (!apiResponse.ok) {
          throw new Error(`Failed to load work orders: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (apiData && Array.isArray(apiData.workOrders)) {
          workOrders = apiData.workOrders;
          console.log(`Loaded ${workOrders.length} work orders from API`);
        } else {
          throw new Error('Invalid API data format');
        }
      } catch (apiError) {
        console.error('Error loading work order data from API:', apiError);
        
        // Fall back to local JSON file if API fails
        try {
          console.log('Trying to load local JSON file as fallback');
          const fileResponse = await fetch('/src/data/scraped_content.json');
          
          if (!fileResponse.ok) {
            throw new Error(`Failed to load local data: ${fileResponse.status}`);
          }
          
          const fileData = await fileResponse.json();
          
          if (fileData && Array.isArray(fileData.workOrders)) {
            workOrders = fileData.workOrders;
            console.log(`Loaded ${workOrders.length} work orders from local JSON`);
          } else {
            throw new Error('Invalid local data format');
          }
        } catch (localError) {
          console.error('Error loading local work order data:', localError);
          
          // Try to load from imported data as final fallback
          try {
            console.log('Trying to load imported data as final fallback');
            const importedData = await import('../../data/scraped_content.json');
            
            if (importedData && Array.isArray(importedData.workOrders)) {
              workOrders = importedData.workOrders;
              console.log(`Loaded ${workOrders.length} work orders from imported data`);
            } else {
              throw new Error('Invalid imported data format');
            }
          } catch (importError) {
            console.error('Error loading imported work order data:', importError);
            throw new Error('Failed to load work order data from all sources');
          }
        }
      }
      
      // Load dispenser data if not already loaded
      try {
        await loadDispenserData();
        
        // Get the dispenser data and merge with work orders
        const currentDispenserData = dispenserData.dispenserData || {};
        
        // Merge dispenser data with work orders
        const mergedOrders = workOrders.map(order => {
          if (currentDispenserData[order.id]) {
            const dispenserInfo = currentDispenserData[order.id] as { dispensers: any[] };
            const dispensers = dispenserInfo.dispensers || [];
            return { ...order, dispensers };
          }
          return order;
        });
        
        // Update work orders with merged data
        workOrders = mergedOrders;
        
        console.log(`Merged dispenser data with ${workOrders.length} work orders`);
      } catch (dispenserError) {
        console.error('Error loading dispenser data:', dispenserError);
        // Continue with non-merged work orders
      }
      
      // Update state with loaded data
      setWorkOrders(workOrders);
      
      // Emit data loaded event
      this.emit('dataLoaded', workOrders);
      
      return workOrders;
    } catch (error) {
      console.error('Error in loadInitialData:', error);
      setWorkOrders([]);
      this.emit('error', error);
      return [];
    } finally {
      setIsLoading(false);
      this.isLoadingRef = false;
      this.lastLoadTimeRef = Date.now();
    }
  }
  
  /**
   * Reload work order data from available sources
   * @param setWorkOrders React setState function to update workOrders
   * @param setIsLoading React setState function to update loading state
   * @param loadDispenserData Function to load dispenser data from context
   * @param dispenserData Current dispenser data from context
   * @returns Promise resolving to the loaded workOrders
   */
  public async reloadData(
    setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    loadDispenserData: () => Promise<void>,
    dispenserData: any
  ): Promise<WorkOrder[]> {
    // Prevent concurrent loading
    if (this.isLoadingRef) {
      console.log('Data reload already in progress, skipping');
      return [];
    }
    
    console.log('Reloading Filter data...');
    this.isLoadingRef = true;
    setIsLoading(true);
    
    try {
      // Multi-source strategy: API -> Local JSON -> Static Import
      let workOrders: WorkOrder[] = [];
      
      // Try loading from API first with cache prevention headers
      try {
        const apiResponse = await fetch('/api/workorders', {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store'
        });
        
        if (!apiResponse.ok) {
          throw new Error(`Failed to reload work orders: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (apiData && Array.isArray(apiData.workOrders)) {
          workOrders = apiData.workOrders;
          console.log(`Reloaded ${workOrders.length} work orders from API`);
        } else {
          throw new Error('Invalid API data format');
        }
      } catch (apiError) {
        console.error('Error reloading work order data from API:', apiError);
        
        // Fall back to local JSON file if API fails
        try {
          console.log('Trying to reload from local JSON file as fallback');
          const fileResponse = await fetch('/src/data/scraped_content.json', {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          if (!fileResponse.ok) {
            throw new Error(`Failed to reload local data: ${fileResponse.status}`);
          }
          
          const fileData = await fileResponse.json();
          
          if (fileData && Array.isArray(fileData.workOrders)) {
            workOrders = fileData.workOrders;
            console.log(`Reloaded ${workOrders.length} work orders from local JSON`);
          } else {
            throw new Error('Invalid local data format');
          }
        } catch (localError) {
          console.error('Error reloading local work order data:', localError);
          
          // Try to load from imported data as final fallback
          try {
            console.log('Trying to reload from imported data as final fallback');
            const importedData = await import('../../data/scraped_content.json');
            
            if (importedData && Array.isArray(importedData.workOrders)) {
              workOrders = importedData.workOrders;
              console.log(`Reloaded ${workOrders.length} work orders from imported data`);
            } else {
              throw new Error('Invalid imported data format');
            }
          } catch (importError) {
            console.error('Error reloading imported work order data:', importError);
            throw new Error('Failed to reload work order data from all sources');
          }
        }
      }
      
      // Load fresh dispenser data
      try {
        await loadDispenserData(true, false);
        
        // Get the dispenser data and merge with work orders
        const currentDispenserData = dispenserData.dispenserData || {};
        
        // Merge dispenser data with work orders
        const mergedOrders = workOrders.map(order => {
          if (currentDispenserData[order.id]) {
            const dispenserInfo = currentDispenserData[order.id] as { dispensers: any[] };
            const dispensers = dispenserInfo.dispensers || [];
            return { ...order, dispensers };
          }
          return order;
        });
        
        // Update work orders with merged data
        workOrders = mergedOrders;
        
        console.log(`Merged dispenser data with ${workOrders.length} work orders`);
      } catch (dispenserError) {
        console.error('Error reloading dispenser data:', dispenserError);
        // Continue with non-merged work orders
      }
      
      // Update state with loaded data
      setWorkOrders(workOrders);
      
      // Emit data loaded event
      this.emit('dataLoaded', workOrders);
      
      return workOrders;
    } catch (error) {
      console.error('Error in reloadData:', error);
      this.emit('error', error);
      return [];
    } finally {
      setIsLoading(false);
      this.isLoadingRef = false;
      this.lastLoadTimeRef = Date.now();
    }
  }
  
  /**
   * Create a debounced reload function to prevent multiple rapid calls
   * @param reloadFn Function to debounce
   * @param wait Wait time in milliseconds
   * @returns Debounced function
   */
  public createDebouncedReload(
    reloadFn: () => Promise<any>,
    wait: number = 1000
  ): () => void {
    return debounce(reloadFn, wait);
  }
  
  /**
   * Set up an event listener for the custom 'fossa-data-updated' event
   * to refresh data automatically
   * @param reloadFn Function to call when event is triggered
   * @returns Cleanup function to remove the event listener
   */
  public setupDataUpdateListener(reloadFn: () => void): () => void {
    // Create the event handler
    const handleDataUpdated = (event: Event) => {
      console.log('fossa-data-updated event detected, triggering reload');
      reloadFn();
    };
    
    // Add event listener
    window.addEventListener('fossa-data-updated', handleDataUpdated);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('fossa-data-updated', handleDataUpdated);
    };
  }
  
  /**
   * Check if there are dispenser-enabled work orders in the data
   * @param workOrders Array of work orders
   * @returns Object with count and boolean flag
   */
  public checkForDispenserInfo(workOrders: WorkOrder[]): { count: number, hasDispensers: boolean } {
    const ordersWithDispensers = workOrders.filter(
      (order) => order.dispensers && order.dispensers.length > 0
    ).length;
    
    return {
      count: ordersWithDispensers,
      hasDispensers: ordersWithDispensers > 0
    };
  }
  
  /**
   * Listen for events from this service
   * @param event Event name
   * @param listener Callback function
   */
  public on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener);
  }
  
  /**
   * Remove event listener
   * @param event Event name
   * @param listener Callback function
   */
  public off(event: string, listener: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(listener);
    }
  }
  
  /**
   * Emit an event with data
   * @param event Event name
   * @param data Event data
   */
  private emit(event: string, data?: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

export default JobDataService;

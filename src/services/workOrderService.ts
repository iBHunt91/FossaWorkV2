import type { WorkOrder } from '../types/workOrderTypes';
import { buildUrl } from '../config/api';

// Service to handle work order data
export const workOrderService = {
  // Get active user ID from localStorage
  getActiveUserId: (): string => {
    const activeUserId = localStorage.getItem('activeUserId');
    if (!activeUserId) {
      console.error('No active user ID found in localStorage');
      // Generate a new user ID if none exists
      const newUserId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('activeUserId', newUserId);
      console.log('Generated new user ID:', newUserId);
      return newUserId;
    }
    console.log('Using active user ID:', activeUserId);
    return activeUserId;
  },

  // Get all work orders for the active user
  getWorkOrders: async (): Promise<WorkOrder[]> => {
    try {
      const activeUserId = workOrderService.getActiveUserId();
      console.log('Loading work orders for active user:', activeUserId);

      // First try: API endpoint
      try {
        const apiEndpoint = await buildUrl('/api/work-orders');
        console.log('Fetching work orders from API endpoint:', apiEndpoint);
        
        const apiResponse = await fetch(apiEndpoint);
        
        if (apiResponse.ok) {
          const data = await apiResponse.json();
          
          // Check if the data has a workOrders array
          if (data.workOrders && Array.isArray(data.workOrders)) {
            console.log(`Successfully loaded ${data.workOrders.length} work orders from API`);
            
            // Add the userId to each work order
            const workOrders: WorkOrder[] = data.workOrders.map((order: any) => ({
              ...order,
              _userId: activeUserId
            }));
            
            return workOrders;
          } else if (Array.isArray(data)) {
            // If the response is directly an array
            console.log(`Successfully loaded ${data.length} work orders from API (direct array)`);
            
            const workOrders: WorkOrder[] = data.map((order: any) => ({
              ...order,
              _userId: activeUserId
            }));
            
            return workOrders;
          } else {
            // Fallback to old format (object with work order IDs as keys)
            console.log(`Successfully loaded ${Object.keys(data).length} work orders from API (legacy format)`);
            
            const workOrders: WorkOrder[] = Object.entries(data).map(([id, details]: [string, any]) => {
              return {
                id,
                ...details,
                _userId: activeUserId
              };
            });
            
            return workOrders;
          }
        }
      } catch (apiError) {
        console.log('API endpoint failed, will try file paths:', apiError);
      }

      // Second try: File paths
      try {
        // Try the user-specific path
        const userSpecificPath = `/data/users/${activeUserId}/scraped_content.json`;
        let url = await buildUrl(userSpecificPath);
        console.log('Trying user-specific file path:', url);
        
        let response = await fetch(url);
        
        // If user-specific file not found, try the default path
        if (!response.ok) {
          const defaultPath = `/data/scraped_content.json`;
          url = await buildUrl(defaultPath);
          console.log('Trying default file path:', url);
          response = await fetch(url);
        }
        
        if (response.ok) {
          const data = await response.json();
          
          // Check if the data has a workOrders array
          if (data.workOrders && Array.isArray(data.workOrders)) {
            console.log(`Successfully loaded ${data.workOrders.length} work orders from file`);
            
            // Add the userId to each work order
            const workOrders: WorkOrder[] = data.workOrders.map((order: any) => ({
              ...order,
              _userId: activeUserId
            }));
            
            return workOrders;
          } else if (Array.isArray(data)) {
            // If the response is directly an array
            console.log(`Successfully loaded ${data.length} work orders from file (direct array)`);
            
            const workOrders: WorkOrder[] = data.map((order: any) => ({
              ...order,
              _userId: activeUserId
            }));
            
            return workOrders;
          } else {
            // Fallback to old format (object with work order IDs as keys)
            console.log(`Successfully loaded ${Object.keys(data).length} work orders from file (legacy format)`);
            
            const workOrders: WorkOrder[] = Object.entries(data).map(([id, details]: [string, any]) => {
              return {
                id,
                ...details,
                _userId: activeUserId
              };
            });
            
            return workOrders;
          }
        }
      } catch (fileError) {
        console.log('File paths failed:', fileError);
      }

      // All fetching methods failed - return empty array instead of mock data
      console.log(`All data fetching methods failed. Returning empty array.`);
      return [];
    } catch (error) {
      console.error('Error loading work orders:', error);
      
      // Return empty array instead of throwing error
      return [];
    }
  },

  // Get dispenser information for the active user and specific work order
  getDispensersForWorkOrder: async (workOrderId: string): Promise<any> => {
    try {
      const activeUserId = workOrderService.getActiveUserId();
      console.log(`Loading dispensers for work order ${workOrderId} and user ${activeUserId}`);

      // Use the file system path format for the active user
      const filePath = `/data/users/${activeUserId}/dispenser_store.json`;
      const url = await buildUrl(filePath);

      console.log('Fetching dispenser data from:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load dispenser data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Successfully loaded dispenser data for user ${activeUserId}`);

      // Find dispensers for the specific work order
      const dispenserData = data[workOrderId] || { dispensers: [] };
      return dispenserData;
    } catch (error) {
      console.error(`Error loading dispensers for work order ${workOrderId}:`, error);
      return { dispensers: [] };
    }
  },

  // Get a specific work order by ID
  getWorkOrderById: async (id: string): Promise<WorkOrder | null> => {
    try {
      const workOrders = await workOrderService.getWorkOrders();
      return workOrders.find(order => order.id === id) || null;
    } catch (error) {
      console.error(`Error in workOrderService.getWorkOrderById for ID ${id}:`, error);
      return null;
    }
  }
};

export default workOrderService;
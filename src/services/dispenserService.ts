// Dispenser service implementation
import { buildUrl } from '../config/api';

// Get active user ID from localStorage
const getActiveUserId = (): string => {
  const activeUserId = localStorage.getItem('activeUserId');
  if (!activeUserId) {
    console.error('No active user ID found in localStorage');
    throw new Error('No active user ID found');
  }
  return activeUserId;
};

export const getDispensersForWorkOrder = async (workOrderId: string): Promise<any> => {
  try {
    console.log(`Getting dispensers for work order: ${workOrderId}`);
    
    const activeUserId = getActiveUserId();
    console.log(`Loading dispensers for work order ${workOrderId} and user ${activeUserId}`);

    // First try: API endpoints (these seem to be working based on logs)
    try {
      // Try the general endpoint first
      const apiGeneral = await buildUrl('/api/dispensers');
      console.log('Fetching dispenser data from general API endpoint:', apiGeneral);
      
      const generalResponse = await fetch(apiGeneral);
      if (generalResponse.ok) {
        const allData = await generalResponse.json();
        
        if (allData && allData.dispenserData && allData.dispenserData[workOrderId]) {
          console.log(`Found dispenser data for work order ${workOrderId} in general API response`);
          return {
            ...allData.dispenserData[workOrderId],
            _userId: activeUserId
          };
        }
      }
      
      // If general endpoint didn't have our work order, try specific endpoint
      const apiSpecific = await buildUrl(`/api/dispensers/${workOrderId}`);
      console.log('Fetching dispenser data from specific API endpoint:', apiSpecific);
      
      const specificResponse = await fetch(apiSpecific);
      if (specificResponse.ok) {
        const data = await specificResponse.json();
        console.log(`Successfully loaded dispenser data from API for work order ${workOrderId}`);
        
        return {
          ...data,
          _userId: activeUserId
        };
      }
    } catch (apiError) {
      console.log('API endpoints failed, will try dispenser_store.json:', apiError);
    }

    // Second try: Use dispenser_store.json as fallback
    try {
      // Load from the user-specific dispenser_store.json
      const dispenserStorePath = `/data/users/${activeUserId}/dispenser_store.json`;
      const url = await buildUrl(dispenserStorePath);
      console.log('Trying dispenser_store.json path:', url);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const storeData = await response.json();
        console.log(`Successfully loaded data from dispenser_store.json`);
        
        // Debug code
        console.log('[DISPENSER DEBUG] Store data structure:', JSON.stringify(storeData));
        console.log('[DISPENSER DEBUG] Looking for work order:', workOrderId);
        
        // Check if we have data for this specific work order
        if (storeData && storeData.dispenserData && storeData.dispenserData[workOrderId]) {
          console.log(`Found workOrder ${workOrderId} in dispenser_store data`);
          return {
            ...storeData.dispenserData[workOrderId],
            _userId: activeUserId
          };
        } else {
          console.log(`Work order ${workOrderId} not found in dispenser_store data`);
        }
      }
    } catch (fileError) {
      console.log('Dispenser store file access failed:', fileError);
    }

    // Third try: Check scraped_content.json as last resort for real data
    try {
      // Try loading from the user-specific scraped_content.json
      const userSpecificScrapedPath = `/data/users/${activeUserId}/scraped_content.json`;
      const url = await buildUrl(userSpecificScrapedPath);
      console.log('Trying user-specific scraped_content.json path as last resort:', url);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Successfully loaded data from scraped_content.json`);
        
        // Only handle the scraped_content.json format
        if (data && data.workOrders) {
          // Find the specific work order in the workOrders array
          const workOrder = data.workOrders.find(wo => wo.id === workOrderId);
          if (workOrder && workOrder.dispensers && workOrder.dispensers.length > 0) {
            console.log(`Found workOrder ${workOrderId} with dispensers in scraped_content data`);
            return {
              workOrderId,
              visitId: workOrder.visitId || workOrderId,
              dispensers: workOrder.dispensers || [],
              lastUpdated: workOrder.lastUpdated || new Date().toISOString(),
              _userId: activeUserId
            };
          } else {
            console.log(`Work order ${workOrderId} not found or has no dispensers in scraped_content data`);
          }
        } else {
          console.log('Invalid data format: missing workOrders array');
        }
      }
    } catch (fileError) {
      console.log('Scraped content file access failed:', fileError);
    }

    console.log(`All data fetching methods failed for work order ${workOrderId}. Returning empty dispensers array.`);
    
    // If all methods fail, return a valid structure with empty dispensers array
    return { 
      workOrderId,
      visitId: workOrderId,
      dispensers: [],
      lastUpdated: new Date().toISOString(),
      _userId: activeUserId
    };
  } catch (error) {
    console.error(`Error loading dispensers for work order ${workOrderId}:`, error);
    
    // Always return something usable with empty dispensers array
    return { 
      workOrderId,
      visitId: workOrderId,
      dispensers: [],
      lastUpdated: new Date().toISOString(),
      _userId: activeUserId
    };
  }
};

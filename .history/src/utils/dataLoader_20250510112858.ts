import { WorkOrder } from '../types/workOrder';

/**
 * Loads work order data from the scraped content JSON file
 * In a real application, this would likely be fetching from an API
 */
export const loadWorkOrders = async (userId?: string): Promise<WorkOrder[]> => {
  try {
    const targetId = userId || '7bea3bdb7e8e303eacaba442bd824004';
    
    // Fetch work orders and dispenser data in parallel
    const [workOrderResponse, dispenserStoreResponse] = await Promise.all([
      fetch(`/data/users/${targetId}/scraped_content.json`),
      fetch(`/data/users/${targetId}/dispenser_store.json`)
    ]);

    if (!workOrderResponse.ok) {
      throw new Error(`Failed to fetch work orders: ${workOrderResponse.statusText}`);
    }
    // It's okay if dispenser_store.json is not found, we can proceed without it
    // and dispenser data will be missing for jobs.
    
    const workOrderData = await workOrderResponse.json();
    let dispenserStoreLookup: { [key: string]: { dispensers?: any[] } } = {};
    if (dispenserStoreResponse.ok) {
      const rawDispenserJson = await dispenserStoreResponse.json();
      // Check if the actual data is nested under a 'dispenserData' key or if it's at the root
      if (rawDispenserJson && rawDispenserJson.dispenserData && typeof rawDispenserJson.dispenserData === 'object') {
        dispenserStoreLookup = rawDispenserJson.dispenserData;
      } else if (rawDispenserJson && typeof rawDispenserJson === 'object') {
        // Assume the data is at the root if no 'dispenserData' key found
        dispenserStoreLookup = rawDispenserJson;
      } else {
        console.warn(`Unexpected JSON structure in dispenser_store.json for user ${targetId}.`);
      }
    } else {
      console.warn(`Could not load dispenser_store.json for user ${targetId}: ${dispenserStoreResponse.statusText}. Dispenser counts may be incomplete.`);
    }

    if (!workOrderData.workOrders || !Array.isArray(workOrderData.workOrders)) {
      throw new Error('Invalid data format from scraped_content.json: workOrders array not found');
    }

    const workOrders: WorkOrder[] = workOrderData.workOrders;

    // Merge dispenser data into work orders
    const mergedWorkOrders = workOrders.map(workOrder => {
      const dispenserEntry = dispenserStoreLookup[workOrder.id];
      if (workOrder.id === 'W-126694') { // Example ID to trace, replace with a relevant ID for testing
        console.log(`[dataLoader] Tracing WID ${workOrder.id}: Entry in dispenser_store.json found?`, !!dispenserEntry);
        if (dispenserEntry) {
          console.log(`[dataLoader] Tracing WID ${workOrder.id}: Dispensers in entry:`, dispenserEntry.dispensers);
          console.log(`[dataLoader] Tracing WID ${workOrder.id}: Count from entry:`, dispenserEntry.dispensers?.length);
        }
      }
      if (dispenserEntry && dispenserEntry.dispensers) {
        return {
          ...workOrder,
          dispensers: dispenserEntry.dispensers 
        };
      }
      return workOrder;
    });

    return mergedWorkOrders;

  } catch (error) {
    console.error('Error loading work orders:', error);
    
    // If fetch fails (like in development without a server), load sample data
    try {
      const sampleData = await import('../data/sampleWorkOrders.json');
      return sampleData.workOrders;
    } catch (fallbackError) {
      console.error('Error loading sample data:', fallbackError);
      return [];
    }
  }
};

/**
 * Loads a specific work order by ID
 */
export const loadWorkOrderById = async (workOrderId: string, userId?: string): Promise<WorkOrder | null> => {
  const workOrders = await loadWorkOrders(userId);
  return workOrders.find(order => order.id === workOrderId) || null;
}; 
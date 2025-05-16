import { WorkOrder } from '../types/workOrder';

/**
 * Loads work order data from the scraped content JSON file
 * In a real application, this would likely be fetching from an API
 */
export const loadWorkOrders = async (userId?: string): Promise<WorkOrder[]> => {
  try {
    const targetId = userId || '7bea3bdb7e8e303eacaba442bd824004';
    const response = await fetch(`/data/users/${targetId}/scraped_content.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch work orders: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.workOrders || !Array.isArray(data.workOrders)) {
      throw new Error('Invalid data format: workOrders array not found');
    }
    
    return data.workOrders as WorkOrder[];
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
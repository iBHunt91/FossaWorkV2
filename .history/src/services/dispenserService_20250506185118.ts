import { ENDPOINTS } from '../config/api';

interface DispenserData {
  dispensers: Array<{
    title?: string;
    serial?: string;
    make?: string;
    model?: string;
    fields?: Record<string, string>;
  }>;
  lastUpdated?: string;
  visitId?: string;
}

interface DispenserStore {
  dispenserData: Record<string, DispenserData>;
  metadata?: {
    created?: string;
    lastUpdated?: string;
    totalStores?: number;
  };
}

/**
 * Fetches dispenser data for a specific work order ID
 * @param workOrderId The work order ID to fetch dispenser data for
 * @returns Promise resolving to the dispenser data
 */
export async function getDispensersForWorkOrder(workOrderId: string): Promise<DispenserData | null> {
  try {
    // Fetch the dispenser store data
    const response = await fetch(ENDPOINTS.DISPENSERS());
    
    if (!response.ok) {
      throw new Error(`Failed to load dispenser data: ${response.status}`);
    }
    
    const data: DispenserStore = await response.json();
    
    // Return the dispenser data for the specific work order if it exists
    if (data.dispenserData && data.dispenserData[workOrderId]) {
      return data.dispenserData[workOrderId];
    }
    
    // No dispenser data found for this work order
    return null;
  } catch (error) {
    console.error('Error fetching dispenser data:', error);
    return null;
  }
}

/**
 * Gets dispenser titles for a work order
 * @param workOrderId The work order ID to get dispenser titles for
 * @returns Array of dispenser titles or empty array if none found
 */
export async function getDispenserTitles(workOrderId: string): Promise<string[]> {
  try {
    const dispenserData = await getDispensersForWorkOrder(workOrderId);
    
    if (dispenserData?.dispensers) {
      return dispenserData.dispensers
        .map(dispenser => dispenser.title || '')
        .filter(title => title.length > 0);
    }
    
    return [];
  } catch (error) {
    console.error('Error getting dispenser titles:', error);
    return [];
  }
} 
import { format, parseISO, subDays, addDays, startOfWeek, endOfWeek } from 'date-fns';
// Fix case sensitivity issue with import
import { WorkOrder } from '../../types/workOrder';
import { ChangeRecord, ChangeItem } from '../../types/ChangeHistory';
import { ExtendedFilterWarning } from '../../types/FilterWarning';
import { calculateFiltersForWorkOrder, determineWarningSeverity } from '../../utils/filterCalculation';
import { ENDPOINTS } from '../../config/api';
import fuelGrades from '../../data/fuel_grades';

interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

const HomeUtils = {
  // Helper function to calculate work week date ranges
  getWorkWeekDateRanges(
    workWeekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1, // Monday by default
    workWeekEnd: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 5, // Friday by default
    selectedDate: Date = new Date()
  ): WorkWeekDateRanges {
    // Get the current week's start date (based on the selected date)
    const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: workWeekStart });
    
    // Calculate the end of the current work week
    let currentWeekEnd;
    if (workWeekEnd < workWeekStart) {
      // If weekend end is before start (e.g., workWeekStart is Monday(1) and workWeekEnd is Sunday(0))
      // then the end date is in the next week
      currentWeekEnd = addDays(currentWeekStart, 7 - workWeekStart + workWeekEnd);
    } else {
      // Otherwise the end date is in the same week
      currentWeekEnd = addDays(currentWeekStart, workWeekEnd - workWeekStart);
    }
    
    // Set time to end of day
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    // Calculate next week's range (add 7 days to current week)
    const nextWeekStart = addDays(currentWeekStart, 7);
    const nextWeekEnd = addDays(currentWeekEnd, 7);
    
    return {
      currentWeekStart,
      currentWeekEnd,
      nextWeekStart,
      nextWeekEnd
    };
  },

  // Calculate category counts
  calculateCategoryCounts(workOrders: WorkOrder[]) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    // Get date ranges for the current and next weeks
    const { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd } = 
      this.getWorkWeekDateRanges(1, 5, now);
    
    let thisWeek = 0;
    let nextWeek = 0;
    let future = 0;
    let unscheduled = 0;
    
    workOrders.forEach(order => {
      let orderDate = null;
      
      // Try to extract date from different possible locations
      // Note: Using only properties that exist on the actual WorkOrder interface
      if (order.scheduledDate) {
        orderDate = parseISO(order.scheduledDate);
      } else if (order.visits?.nextVisit?.date) {
        orderDate = parseISO(order.visits.nextVisit.date);
      } else if (order.createdDate) {
        orderDate = parseISO(order.createdDate);
      }
      
      if (orderDate && isFinite(orderDate.getTime())) {
        if (orderDate >= currentWeekStart && orderDate <= currentWeekEnd) {
          thisWeek++;
        } else if (orderDate >= nextWeekStart && orderDate <= nextWeekEnd) {
          nextWeek++;
        } else if (orderDate > nextWeekEnd) {
          future++;
        }
      } else {
        unscheduled++;
      }
    });
    
    return {
      total: workOrders.length,
      thisWeek,
      nextWeek,
      future,
      unscheduled
    };
  },

  // Helper function to calculate distribution for current and next week jobs only
  calculateDistribution(
    orders: WorkOrder[], 
    currentWeekStart: Date, 
    currentWeekEnd: Date, 
    nextWeekStart: Date, 
    nextWeekEnd: Date
  ) {
    console.log('===== calculateDistribution called =====');
    console.log('Total orders to process:', orders?.length || 0);
    console.log('Date ranges:', {
      currentWeekStart: currentWeekStart.toISOString(),
      currentWeekEnd: currentWeekEnd.toISOString(),
      nextWeekStart: nextWeekStart.toISOString(),
      nextWeekEnd: nextWeekEnd.toISOString()
    });
    
    // Initialize containers for current and next week
    const currentWeekMap: Record<string, WorkOrder[]> = {};
    const nextWeekMap: Record<string, WorkOrder[]> = {};
    
    // Format current and next week ranges for display
    const currentWeekLabel = `${format(currentWeekStart, 'MMM d')} - ${format(currentWeekEnd, 'MMM d')}`;
    const nextWeekLabel = `${format(nextWeekStart, 'MMM d')} - ${format(nextWeekEnd, 'MMM d')}`;
    
    console.log('Week labels:', {currentWeekLabel, nextWeekLabel});
    
    // Initialize with empty arrays
    currentWeekMap[currentWeekLabel] = [];
    nextWeekMap[nextWeekLabel] = [];
    
    // Count for debugging
    let skippedDueToNoDate = 0;
    let skippedDueToInvalidDate = 0;
    let addedToCurrentWeek = 0;
    let addedToNextWeek = 0;
    let notInAnyWeek = 0;
    
    // Group orders into current week and next week
    orders.forEach((order, index) => {
      // Debug first few orders
      if (index < 5) {
        console.log(`Order ${index} details:`, {
          id: order.id,
          scheduledDate: order.scheduledDate,
          nextVisitDate: order.visits?.nextVisit?.date,
          createdDate: order.createdDate,
          customerName: order.customer?.name
        });
      }
      
      let orderDate = null;
      
      // Try multiple date fields to find a valid date
      if (order.scheduledDate) {
        orderDate = parseISO(order.scheduledDate);
      } else if (order.visits?.nextVisit?.date) {
        orderDate = parseISO(order.visits.nextVisit.date);
      } else if (order.createdDate) {
        orderDate = parseISO(order.createdDate);
      }
      
      if (!orderDate) {
        skippedDueToNoDate++;
        return; // Skip orders without dates
      }
      
      if (!isFinite(orderDate.getTime())) {
        skippedDueToInvalidDate++;
        console.warn('Invalid date found for order:', order.id);
        return; // Skip orders with invalid dates
      }
      
      // Group into current or next week
      if (orderDate >= currentWeekStart && orderDate <= currentWeekEnd) {
        currentWeekMap[currentWeekLabel].push(order);
        addedToCurrentWeek++;
      } else if (orderDate >= nextWeekStart && orderDate <= nextWeekEnd) {
        nextWeekMap[nextWeekLabel].push(order);
        addedToNextWeek++;
      } else {
        notInAnyWeek++;
      }
    });
    
    console.log('Distribution process summary:', {
      totalOrders: orders.length,
      skippedDueToNoDate,
      skippedDueToInvalidDate,
      addedToCurrentWeek,
      addedToNextWeek,
      notInAnyWeek,
      currentWeekCount: currentWeekMap[currentWeekLabel].length,
      nextWeekCount: nextWeekMap[nextWeekLabel].length
    });
    
    // Return weekly counts with the actual order objects for more detailed display
    return {
      currentWeek: currentWeekMap,
      nextWeek: nextWeekMap
    };
  },

  // Helper function to calculate store distribution
  calculateStoreDistribution(orders: WorkOrder[]) {
    const distribution: Record<string, number> = {
      '7-eleven': 0,
      'circle-k': 0,
      'wawa': 0,
      'other': 0
    };
    
    orders.forEach(order => {
      const storeType = this.getStoreTypeForFiltering(order);
      distribution[storeType]++;
    });
    
    return distribution;
  },

  // Helper function to get store type for filtering
  getStoreTypeForFiltering(order: any): string {
    let customerName = '';
    
    if (order.customer?.name) {
      customerName = order.customer.name.toLowerCase();
    } else if (order.clientName) {
      customerName = order.clientName.toLowerCase();
    }
    
    if (customerName.includes('7-eleven') || customerName.includes('7 eleven') || customerName.includes('seven eleven')) {
      return '7-eleven';
    } else if (customerName.includes('circle k') || customerName.includes('circle-k')) {
      return 'circle-k';
    } else if (customerName.includes('wawa')) {
      return 'wawa';
    } else {
      return 'other';
    }
  },

  // Function to determine meter type
  getMeterType(order: WorkOrder): string {
    let meterType = 'unknown';
    
    if (!order || !order.dispensers || order.dispensers.length === 0) {
      return meterType;
    }
    
    // Extract dispensers that have make/model information
    const relevantDispensers = order.dispensers.filter(d => d.make || d.model || (d.fields && Object.keys(d.fields).length > 0));
    
    if (relevantDispensers.length === 0) {
      return meterType;
    }
    
    // Try to determine meter type from dispenser data
    for (const dispenser of relevantDispensers) {
      const make = (dispenser.make || '').toLowerCase();
      const model = (dispenser.model || '').toLowerCase();
      const fields = dispenser.fields || {};
      
      // Look for specific fields or patterns
      if (make.includes('wayne') || model.includes('wayne')) {
        if (model.includes('ovation')) {
          return 'wayne_ovation';
        } else if (model.includes('global')) {
          return 'wayne_global';
        } else if (model.includes('helix')) {
          return 'wayne_helix';
        } else {
          return 'wayne';
        }
      } else if (make.includes('gilbarco') || model.includes('gilbarco')) {
        if (model.includes('encore')) {
          return 'gilbarco_encore';
        } else if (model.includes('advantage')) {
          return 'gilbarco_advantage';
        } else {
          return 'gilbarco';
        }
      } else if (make.includes('bennett') || model.includes('bennett')) {
        return 'bennett';
      } else if (make.includes('tokheim') || model.includes('tokheim')) {
        return 'tokheim';
      }
      
      // Check fields for additional clues
      for (const key in fields) {
        const value = fields[key].toLowerCase();
        if (value.includes('wayne')) {
          return 'wayne';
        } else if (value.includes('gilbarco')) {
          return 'gilbarco';
        } else if (value.includes('bennett')) {
          return 'bennett';
        } else if (value.includes('tokheim')) {
          return 'tokheim';
        }
      }
    }
    
    return meterType;
  },

  // Function to parse specific dispenser instructions
  parseSpecificDispenserInstructions(instructions: string): number[] {
    if (!instructions) {
      return [];
    }
    
    const dispenserNumbers: number[] = [];
    
    // Common patterns for dispenser instructions
    const patterns = [
      /dispenser(?:s)?\s*\#?\s*(\d+(?:\s*(?:,|&|and)\s*\d+)*)/i,
      /mpu(?:s)?\s*\#?\s*(\d+(?:\s*(?:,|&|and)\s*\d+)*)/i,
      /pump(?:s)?\s*\#?\s*(\d+(?:\s*(?:,|&|and)\s*\d+)*)/i
    ];
    
    for (const pattern of patterns) {
      const matches = instructions.match(pattern);
      if (matches && matches[1]) {
        // Extract the comma/and-separated list of dispenser numbers
        const numbersList = matches[1];
        
        // Replace common separators with commas
        const normalizedList = numbersList.replace(/\s*(?:,|&|and)\s*/g, ',');
        
        // Split and convert to numbers
        const numbers = normalizedList.split(',')
          .map(n => parseInt(n.trim(), 10))
          .filter(n => !isNaN(n));
        
        dispenserNumbers.push(...numbers);
      }
    }
    
    // Return unique dispenser numbers
    return [...new Set(dispenserNumbers)];
  },

  // Helper function to check if a dispenser should be included
  shouldIncludeDispenser(dispenserTitle: string | undefined, specificDispenserNumbers: number[]): boolean {
    if (!dispenserTitle || specificDispenserNumbers.length === 0) {
      return true; // If no specific numbers or no title, include by default
    }
    
    // Extract number from dispenser title (e.g., "Dispenser #3" -> 3)
    const matches = dispenserTitle.match(/(?:Dispenser|MPU|Pump)\s*\#?\s*(\d+)/i);
    if (matches && matches[1]) {
      const dispenserNumber = parseInt(matches[1], 10);
      return specificDispenserNumbers.includes(dispenserNumber);
    }
    
    return true; // If no number found in title, include by default
  },

  // Function to check for special fuel types
  checkForSpecialFuelTypes(order: WorkOrder): { hasDEF: boolean; hasDieselHighFlow: boolean } {
    let hasDEF = false;
    let hasDieselHighFlow = false;
    
    // Check instructions for DEF
    if (order.instructions) {
      const instructions = order.instructions.toLowerCase();
      if (
        instructions.includes('def') ||
        instructions.includes('diesel exhaust fluid') ||
        instructions.includes('diesel emission fluid')
      ) {
        hasDEF = true;
      }
      
      if (
        instructions.includes('high flow') ||
        instructions.includes('high-flow') ||
        instructions.includes('highflow')
      ) {
        hasDieselHighFlow = true;
      }
    }
    
    // Check dispensers data
    if (order.dispensers && order.dispensers.length > 0) {
      for (const dispenser of order.dispensers) {
        if (dispenser.html) {
          const html = dispenser.html.toLowerCase();
          if (
            html.includes('def') ||
            html.includes('diesel exhaust fluid') ||
            html.includes('diesel emission fluid')
          ) {
            hasDEF = true;
          }
          
          if (
            html.includes('high flow') ||
            html.includes('high-flow') ||
            html.includes('highflow')
          ) {
            hasDieselHighFlow = true;
          }
        }
        
        // Check fields
        if (dispenser.fields) {
          for (const key in dispenser.fields) {
            const value = dispenser.fields[key].toLowerCase();
            if (
              value.includes('def') ||
              value.includes('diesel exhaust fluid') ||
              value.includes('diesel emission fluid')
            ) {
              hasDEF = true;
            }
            
            if (
              value.includes('high flow') ||
              value.includes('high-flow') ||
              value.includes('highflow')
            ) {
              hasDieselHighFlow = true;
            }
          }
        }
      }
    }
    
    return { hasDEF, hasDieselHighFlow };
  },

  // Process instructions from work order
  processInstructions(instructions: string) {
    if (!instructions) return 'No instructions available';
    
    // Replace multiple line breaks with a single one
    let processed = instructions.replace(/(\r\n|\n|\r)+/g, '\n');
    
    // Replace tabs with spaces
    processed = processed.replace(/\t/g, '    ');
    
    // Trim extra whitespace
    processed = processed.trim();
    
    return processed;
  },

  // Helper function to extract visit ID
  extractVisitId(order: any) {
    return order.visitId || (order.visits?.nextVisit?.visitId) || '';
  },

  // Helper function to extract visit number from URL
  extractVisitNumber(order: any): string {
    // Attempt to parse from URLs or reference numbers
    if (order.workOrderNumber) {
      return order.workOrderNumber;
    }
    
    return '';
  },

  // Helper function to format store name
  getDisplayName(order: any) {
    let storeName = '';
    let storeNumber = '';
    
    // Try to extract from customer object first
    if (order.customer) {
      storeName = order.customer.name || '';
      storeNumber = order.customer.storeNumber || '';
    } 
    // Then try direct properties
    else {
      storeName = order.clientName || '';
      storeNumber = order.storeNumber || '';
    }
    
    // Handle case where we have both store name and number
    if (storeName && storeNumber) {
      // Check if store number is already included in the name
      if (!storeName.includes(storeNumber)) {
        return `${storeName} #${storeNumber}`;
      }
      return storeName;
    } 
    // Just store name
    else if (storeName) {
      return storeName;
    } 
    // Just store number with placeholder
    else if (storeNumber) {
      return `Store #${storeNumber}`;
    } 
    // Fallback to ID or unknown
    else {
      return order.id ? `Job ${order.id.substring(0, 8)}` : 'Unknown Store';
    }
  },

  // Helper function to get store styles
  getStoreStyles(storeType: string) {
    switch (storeType) {
      case '7-eleven':
        return {
          badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          text: 'text-green-700 dark:text-green-400',
          icon: 'text-green-500'
        };
      case 'circle-k':
        return {
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          text: 'text-blue-700 dark:text-blue-400',
          icon: 'text-blue-500'
        };
      case 'wawa':
        return {
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
          text: 'text-yellow-700 dark:text-yellow-400',
          icon: 'text-yellow-500'
        };
      default:
        return {
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          text: 'text-purple-700 dark:text-purple-400',
          icon: 'text-purple-500'
        };
    }
  },

  // Helper function to calculate filters safely
  calculateFiltersSafely(order: WorkOrder) {
    try {
      const result = calculateFiltersForWorkOrder(order);
      
      // Check if the result is valid and contains warnings
      if (result && Array.isArray(result.warnings)) {
        // Add part number estimates based on warnings
        result.warnings.forEach(warning => {
          if (!warning.partNumber) {
            // For gas filters, use standard part numbers based on filter type
            if (result.gasFilters > 0) {
              warning.partNumber = 'PCP-2-1';  // Standard Premier Plus filter
            }
            // For diesel filters, use standard part numbers
            if (result.dieselFilters > 0) {
              warning.partNumber = 'PCN-2-1';  // Standard Phase Coalescer filter
            }
          }
        });
        
        return result.warnings;
      }
      return [];
    } catch (error) {
      console.error('Error calculating filters for order:', order.id, error);
      // Create a fallback warning
      return [{
        dispenserId: 'System',
        warning: 'Unable to calculate filter requirements automatically',
        grades: [],
        severity: 6,
        partNumber: 'PCP-2-1'  // Default part number as fallback
      }];
    }
  },

  // Function to fetch change history data
  async fetchChangeHistoryData(): Promise<ChangeRecord[]> {
    try {
      // Get the endpoint using the function because it returns a Promise
      const endpointPromise = ENDPOINTS.CHANGE_HISTORY();
      
      if (!endpointPromise || typeof endpointPromise.then !== 'function') {
        console.error('Invalid endpoint for change history, using fallback data');
        return this.generateSimulatedChanges();
      }
      
      // Await the promise to get the actual URL
      const endpoint = await endpointPromise;
      console.log('Fetching change history from:', endpoint);
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        console.warn(`Change history endpoint returned status ${response.status}, using fallback data`);
        return this.generateSimulatedChanges();
      }
      
      // Handle response with a try/catch in case it's not valid JSON
      try {
        const data = await response.json();
        return this.formatChangeHistory(data);
      } catch (jsonError) {
        console.warn('Failed to parse change history response as JSON, using fallback data');
        return this.generateSimulatedChanges();
      }
    } catch (error) {
      console.error('Error fetching change history:', error);
      // Return simulated data instead of throwing
      return this.generateSimulatedChanges();
    }
  },

  // Helper function to format change history data
  formatChangeHistory(data: any[]): ChangeRecord[] {
    // Sort by timestamp in descending order (newest first)
    const sortedData = [...data].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Only keep the 5 most recent records
    return sortedData.slice(0, 5).map(record => {
      const changes = record.changes || {};
      const critical = changes.critical || [];
      const high = changes.high || [];
      const medium = changes.medium || [];
      const low = changes.low || [];
      const allChanges = changes.all || [];
      
      // Calculate summary if not provided
      const summary = changes.summary || {
        removed: changes.removed?.length || 0,
        added: changes.added?.length || 0,
        modified: changes.modified?.length || 0,
        swapped: changes.swapped?.length || 0
      };
      
      return {
        timestamp: record.timestamp,
        changes: {
          critical,
          high,
          medium,
          low,
          allChanges,
          summary
        }
      };
    });
  },

  // Helper function to format change items
  formatChangeItem(change: ChangeItem, timestamp: Date): string {
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return 'Unknown date';
      try {
        return format(parseISO(dateStr), 'MMM d, yyyy');
      } catch (error) {
        return dateStr;
      }
    };
    
    switch (change.type) {
      case 'added':
        return `${change.storeName || 'Store'} job added for ${formatDate(change.date)}`;
      
      case 'removed':
        return `${change.storeName || 'Store'} job removed from ${formatDate(change.date)}`;
      
      case 'modified':
        return `${change.storeName || 'Store'} job moved from ${formatDate(change.oldDate)} to ${formatDate(change.newDate)}`;
      
      case 'swapped':
        return `${change.job1StoreName || 'Store'} swapped with ${change.job2StoreName || 'another store'}`;
      
      default:
        return `${change.storeName || 'Store'} schedule changed`;
    }
  },

  // Generate simulated changes for testing
  generateSimulatedChanges(): ChangeRecord[] {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const twoDaysAgo = subDays(now, 2);
    const threeDaysAgo = subDays(now, 3);
    const fourDaysAgo = subDays(now, 4);
    
    return [
      {
        timestamp: now.toISOString(),
        changes: {
          critical: [
            { type: 'modified', storeName: '7-Eleven #12345', oldDate: subDays(now, 1).toISOString(), newDate: addDays(now, 7).toISOString() }
          ],
          high: [
            { type: 'added', storeName: 'Circle K #5678', date: addDays(now, 3).toISOString() }
          ],
          medium: [
            { type: 'removed', storeName: 'Wawa #9012', date: addDays(now, 5).toISOString() }
          ],
          low: [],
          summary: {
            added: 1,
            removed: 1,
            modified: 1,
            swapped: 0
          }
        }
      },
      {
        timestamp: yesterday.toISOString(),
        changes: {
          critical: [],
          high: [
            { type: 'added', storeName: 'Wawa #1234', date: addDays(now, 2).toISOString() },
            { type: 'added', storeName: 'Circle K #5678', date: addDays(now, 4).toISOString() }
          ],
          medium: [
            { type: 'modified', storeName: '7-Eleven #4321', oldDate: yesterday.toISOString(), newDate: addDays(now, 7).toISOString() }
          ],
          low: [
            { type: 'removed', storeName: 'Speedway #7890', date: addDays(now, 10).toISOString() }
          ],
          summary: {
            added: 2,
            removed: 1,
            modified: 1,
            swapped: 0
          }
        }
      },
      {
        timestamp: twoDaysAgo.toISOString(),
        changes: {
          critical: [
            { type: 'swapped', 
              job1StoreName: '7-Eleven #1111', 
              job2StoreName: 'Circle K #2222',
              oldDate1: twoDaysAgo.toISOString(),
              newDate1: addDays(twoDaysAgo, 7).toISOString(),
              oldDate2: addDays(twoDaysAgo, 7).toISOString(),
              newDate2: twoDaysAgo.toISOString() 
            }
          ],
          high: [],
          medium: [],
          low: [
            { type: 'added', storeName: 'QuikTrip #3333', date: addDays(now, 5).toISOString() }
          ],
          summary: {
            added: 1,
            removed: 0,
            modified: 0,
            swapped: 1
          }
        }
      },
      {
        timestamp: threeDaysAgo.toISOString(),
        changes: {
          critical: [],
          high: [],
          medium: [
            { type: 'modified', storeName: 'Wawa #4444', oldDate: threeDaysAgo.toISOString(), newDate: addDays(threeDaysAgo, 14).toISOString() }
          ],
          low: [
            { type: 'modified', storeName: 'Circle K #5555', oldDate: threeDaysAgo.toISOString(), newDate: addDays(threeDaysAgo, 2).toISOString() }
          ],
          summary: {
            added: 0,
            removed: 0,
            modified: 2,
            swapped: 0
          }
        }
      },
      {
        timestamp: fourDaysAgo.toISOString(),
        changes: {
          critical: [
            { type: 'removed', storeName: '7-Eleven #6666', date: addDays(fourDaysAgo, 3).toISOString() }
          ],
          high: [
            { type: 'removed', storeName: 'Wawa #7777', date: addDays(fourDaysAgo, 5).toISOString() }
          ],
          medium: [],
          low: [],
          summary: {
            added: 0,
            removed: 2,
            modified: 0,
            swapped: 0
          }
        }
      }
    ];
  },

  // Function to generate real warnings
  generateRealWarnings(workOrders: WorkOrder[], dispenserData: any): ExtendedFilterWarning[] {
    const warnings: ExtendedFilterWarning[] = [];
    
    workOrders.forEach(order => {
      // Skip if we don't have dispenser data for this order
      if (!order.dispensers || order.dispensers.length === 0) {
        // Add a warning about missing dispenser data
        warnings.push({
          message: `Missing dispenser data for ${this.getDisplayName(order)}`,
          severity: 1, // Low severity
          orderId: order.id,
          storeName: this.getDisplayName(order),
          missingDispenserData: true
        });
        return;
      }
      
      // Calculate filter warnings
      const filterWarnings = this.calculateFiltersSafely(order);
      if (filterWarnings && Array.isArray(filterWarnings) && filterWarnings.length > 0) {
        filterWarnings.forEach((warning: any) => {
          // Add additional data to the warning
          const extendedWarning: ExtendedFilterWarning = {
            ...warning,
            orderId: order.id,
            storeName: this.getDisplayName(order)
          };
          warnings.push(extendedWarning);
        });
      }
    });
    
    // Sort warnings by severity (highest first)
    return warnings.sort((a, b) => (b.severity || 0) - (a.severity || 0));
  }
};

export default HomeUtils;

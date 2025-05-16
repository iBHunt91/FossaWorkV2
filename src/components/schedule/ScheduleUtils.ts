import { WorkOrder, WorkWeekDates, StoreStyles } from './ScheduleTypes';

export const calculateWorkWeekDates = (selectedDate: Date): WorkWeekDates => {
  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);
  const dayOfWeek = selected.getDay();
  const daysFromMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  
  const currentWeekStart = new Date(selected);
  currentWeekStart.setDate(selected.getDate() + daysFromMonday);
  
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 4);
  
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);
  
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 4);
  
  return { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd };
};

export const extractVisitNumber = (order: WorkOrder): string => {
  // Check for visit number in multiple places
  const visitData = order.visits?.nextVisit;
  if (visitData?.number !== undefined) {
    return `#${visitData.number}`;
  }
  
  // Check workOrderNumber field
  if (order.workOrderNumber) {
    return `#${order.workOrderNumber}`;
  }
  
  // Check if visit number is at the end of the URL
  if (visitData?.url) {
    const urlMatch = visitData.url.match(/visit\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      return `#${urlMatch[1]}`;
    }
  }
  
  // Check if the order id looks like a visit number (numeric)
  if (order.id && /^\d+$/.test(order.id)) {
    return `#${order.id}`;
  }
  
  return 'N/A';
};

export const getStoreTypeForFiltering = (order: WorkOrder): string => {
  if (!order?.customer) return 'other';
  
  const storeName = order.customer.name?.toLowerCase() || '';
  const storeTerr = order.customer.territory?.toLowerCase() || '';
  
  if (storeName.includes('7-eleven') || storeName.includes('7 eleven') || storeName.includes('seven eleven')) {
    return '7-eleven';
  }
  if (storeName.includes('circle k') || storeName.includes('circle-k') || storeName.includes('circle_k')) {
    return 'circle-k';
  }
  if (storeName.includes('wawa') || storeTerr.includes('wawa')) {
    return 'wawa';
  }
  return 'other';
};

export const getStoreStyles = (storeType: string): StoreStyles => {
  const SKELETON_STYLE: StoreStyles = {
    cardBorder: 'border-gray-300 dark:border-gray-600',
    headerBg: 'bg-gray-100 dark:bg-gray-750',
    badge: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    cardBg: 'bg-white dark:bg-gray-800',
    text: 'text-gray-900 dark:text-white',
    dot: 'bg-gray-400',
  };
  
  switch (storeType.toLowerCase()) {
    case '7-eleven': 
      return { 
        ...SKELETON_STYLE, 
        cardBorder: 'border-l-4 border-emerald-500', 
        headerBg: 'bg-emerald-50 dark:bg-emerald-900/30', 
        badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', 
        dot: 'bg-emerald-500' 
      };
    case 'circle-k': 
      return { 
        ...SKELETON_STYLE, 
        cardBorder: 'border-l-4 border-red-500', 
        headerBg: 'bg-red-50 dark:bg-red-900/30', 
        badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', 
        dot: 'bg-red-500' 
      };
    case 'wawa': 
      return { 
        ...SKELETON_STYLE, 
        cardBorder: 'border-l-4 border-purple-500', 
        headerBg: 'bg-purple-50 dark:bg-purple-900/30', 
        badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', 
        dot: 'bg-purple-500' 
      };
    default: 
      return { 
        ...SKELETON_STYLE, 
        cardBorder: 'border-l-4 border-blue-500', 
        headerBg: 'bg-blue-50 dark:bg-blue-900/30', 
        badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', 
        dot: 'bg-blue-500' 
      };
  }
};

export const processInstructions = (instructions: string, currentOrder: WorkOrder | undefined): string => {
  if (!instructions) return '';
  
  // Replace line breaks with spaces
  let processedText = instructions.replace(/\n/g, ' ');
  
  // Remove any HTML tags
  processedText = processedText.replace(/<[^>]*>/g, '');
  
  // Get the store type from the passed order
  const customerName = currentOrder?.customer?.name?.toLowerCase() || '';
  
  // Rule for 7-Eleven stores
  if (customerName.includes('7-eleven') || customerName.includes('speedway')) {
    const newStoreMatch = processedText.match(/NEW\/REMODELED\s+STORE/i);
    if (newStoreMatch) {
      return newStoreMatch[0];
    }
  }
  
  // Rule for Wawa stores
  if (customerName.includes('wawa')) {
    // Hide "RETURN CRIND KEYS to the MANAGER"
    processedText = processedText.replace(/RETURN\s+CRIND\s+KEYS\s+to\s+the\s+MANAGER/gi, '');
  }
  
  // Rule for Circle K stores
  if (customerName.includes('circle k')) {
    // Only show priority level - extract just the number
    const priorityMatch = processedText.match(/Priority:\s*(\d+)/i);
    if (priorityMatch) {
      // Return only "Priority: X" without any description
      return `Priority: ${priorityMatch[1]}`;
    }
    
    // Hide instructions with "Issue:" or "Issue description:"
    if (processedText.includes('Issue:') || processedText.includes('Issue description:')) {
      return '';
    }
  }
  
  // For AccuMeasure filter change instructions, only display the "Day X of Y" part
  const accumeasureMatch = processedText.match(/((Day\s+\d+\s+of\s+\d+).*?2025\s+AccuMeasure\s+-\s+Change\s+and\s+date\s+all\s+GAS.*?filters)/i);
  if (accumeasureMatch && accumeasureMatch[2]) {
    return accumeasureMatch[2].trim(); // Return just the "Day X of Y" part
  }
  
  // For all store types - process day information
  const dayMatch = processedText.match(/(Day\s+\d+|Start\s+Day|Finish\s+Day)([^.]*)/i);
  if (dayMatch) {
    return dayMatch[0].trim();
  }
  
  // Handle dispensers calibration for specific dispensers
  const calibrateMatch = processedText.match(/(Calibrate\s+#\d+[^.]*)/i);
  if (calibrateMatch) {
    return calibrateMatch[0].trim();
  }
  
  // Hide standard instructions for all store types
  const standardPatterns = [
    /Calibrate all dispensers and change filters.+?/i,
    /2025 AccuMeasure - Change and date all GAS.+?filters with CimTek.+?/i,
    /Issue: Calibration required Issue description: Calibrate and adjust.+?/i
  ];
  
  for (const pattern of standardPatterns) {
    if (pattern.test(processedText)) {
      return '';
    }
  }
  
  // Remove common prefixes and noise
  const prefixesToRemove = [
    'special instructions:', 
    'instructions:', 
    'special notes:', 
    'notes:', 
    'additional notes:', 
    'service notes:', 
    'dispenser notes:'
  ];
  
  let lowerCaseText = processedText.toLowerCase();
  for (const prefix of prefixesToRemove) {
    if (lowerCaseText.startsWith(prefix)) {
      processedText = processedText.substring(prefix.length);
      lowerCaseText = processedText.toLowerCase();
    }
  }
  
  // Trim whitespace
  processedText = processedText.trim();
  
  // If after all specific filtering and cleaning, the text is empty or effectively placeholder, return empty
  if (!processedText || processedText.toLowerCase() === 'none' || processedText.toLowerCase() === 'n/a') {
      return ''; 
  }

  // Trim to reasonable length
  if (processedText.length > 150) {
    return processedText.substring(0, 147) + '...';
  }
  
  return processedText;
};

export const groupOrdersByDate = (orders: WorkOrder[]): [string, WorkOrder[]][] => {
  const grouped: Record<string, WorkOrder[]> = {};
  
  orders.forEach(order => {
    const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
    if (!orderDateStr) {
      if (!grouped['unknown']) grouped['unknown'] = [];
      grouped['unknown'].push(order);
      return;
    }
    
    const dateKey = new Date(orderDateStr).toDateString();
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(order);
  });
  
  return Object.entries(grouped)
    .sort(([dateA], [dateB]) => {
      if (dateA === 'unknown') return 1;
      if (dateB === 'unknown') return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
};
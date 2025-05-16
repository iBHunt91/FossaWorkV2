import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  FiCalendar, 
  FiX, 
  FiChevronDown, 
  FiInfo, 
  FiTool, 
  FiFileText, 
  FiStar, 
  FiTrash2, 
  FiRefreshCw,
  FiExternalLink,
  FiList,
  FiGrid,
  FiFilter,
  FiChevronUp,
  FiSettings,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiBriefcase,
  FiMapPin,
  FiPhone,
  FiCopy,
  FiEdit3,
  FiEye,
  FiPlus,
  FiSearch,
  FiMaximize,
  FiMinimize
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useDispenserData } from '../context/DispenserContext';
import { getWorkOrders, clearDispenserData, forceRescrapeDispenserData } from '../services/scrapeService';
import { SkeletonJobsList } from '../components/Skeleton';
import InstructionsModal from '../components/InstructionsModal';
import DispenserModal from '../components/DispenserModal';
import CalendarView from '../components/CalendarView';

// Type definitions (Consider moving to a dedicated types file if they grow)
// Basic type for view selection
export type ViewType = 'weekly' | 'calendar' | 'compact';

export type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

type Customer = {
  name: string;
  storeNumber?: string | null;
  rawHtml?: string;
};

type Dispenser = {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: {[key: string]: string};
  html?: string;
};

type WorkOrder = {
  id: string;
  workOrderId?: string;
  customer: Customer;
  services: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: Record<string, any>;
  instructions: string;
  rawHtml: string;
  dispensers?: Dispenser[];
  scheduledDate?: string;
  nextVisitDate?: string;
  visitDate?: string;
  date?: string;
  isFavorite?: boolean; // Added for toggleFavorite
};

interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

type GroupedWorkOrders = {
  currentDay: WorkOrder[];
  thisWeek: WorkOrder[];
  nextWeek: WorkOrder[];
  other: WorkOrder[];
};

// Event type for CalendarView (based on CalendarView.tsx)
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  storeType: string;
  storeNumber?: string;
  visitNumber?: string;
  dispensers?: Dispenser[]; // Use existing Dispenser type
  services?: WorkOrder['services']; // Use services type from WorkOrder
  instructions?: string;
}

// --- Helper function to calculate work week date ranges (Full version from Home.tsx) ---
const getWorkWeekDateRanges = (
  workWeekStartDay: number = 1,
  workWeekEndDay: number = 5,
  selectedDateInput: Date = new Date()
): WorkWeekDateRanges => {
  const selectedDate = selectedDateInput instanceof Date ? selectedDateInput : new Date(selectedDateInput);
  
  const today = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()); // Normalize to start of day

  const currentDayOfWeek = today.getDay(); 
  const currentHour = selectedDateInput.getHours(); // Use original selectedDateInput for currentHour to respect time on selected day

  // Adjust logic for when to flip to the "next week"
  // If it's the end day of the work week AND 5 PM or later OR if current day is past work week end day (e.g. Sat, Sun for Mon-Fri week)
  // OR if current day is before work week start day (e.g. Sun for Mon-Fri, if Mon is start)
  const isEffectivelyAfterWorkWeekEnd = 
    (currentDayOfWeek === workWeekEndDay && currentHour >= 17) ||
    (workWeekEndDay < workWeekStartDay ? // handles wrap-around weeks e.g. Fri-Tue
        (currentDayOfWeek > workWeekEndDay && currentDayOfWeek < workWeekStartDay) 
        : (currentDayOfWeek > workWeekEndDay || currentDayOfWeek < workWeekStartDay)
    );

  const currentWeekStart = new Date(today);

  if (isEffectivelyAfterWorkWeekEnd) {
    // Move to the start of the next logical work week
    let daysToAdd = (workWeekStartDay - currentDayOfWeek + 7) % 7;
    if (daysToAdd === 0 && currentDayOfWeek !== workWeekStartDay) { // If today is already the start day but we are "after hours"
        daysToAdd = 7;
    }
     currentWeekStart.setDate(today.getDate() + daysToAdd);
  } else {
    // Move to the start of the current logical work week
    let daysToSubtract = (currentDayOfWeek - workWeekStartDay + 7) % 7;
    currentWeekStart.setDate(today.getDate() - daysToSubtract);
  }
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  let daysInWorkWeek = (workWeekEndDay - workWeekStartDay + 7) % 7;
  currentWeekEnd.setDate(currentWeekStart.getDate() + daysInWorkWeek);
  currentWeekEnd.setHours(17, 0, 0, 0); // End at 5 PM on the work week's end day

  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);

  const nextWeekEnd = new Date(currentWeekEnd);
  nextWeekEnd.setDate(currentWeekEnd.getDate() + 7);

  return { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd };
};

// --- Helper function to process instructions (Copied and adapted from Home.tsx) ---
const processInstructions = (instructions: string, currentOrder: WorkOrder | undefined): string => {
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

// --- Schedule Component ---
const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { dispenserData, loadDispenserData: loadDispenserDataContext, isLoaded: dispenserDataLoaded } = useDispenserData();

  const [workOrdersData, setWorkOrdersData] = useState<{ workOrders: WorkOrder[], metadata: any }>({
    workOrders: [],
    metadata: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StoreFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [activeView, setActiveView] = useState<ViewType>('weekly');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [calendarViewType, setCalendarViewType] = useState<'month' | 'week'>('month');

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workWeekStartDay, setWorkWeekStartDay] = useState(() => {
    const storedVal = localStorage.getItem('workWeekStart');
    return storedVal ? parseInt(storedVal, 10) : 1;
  });
  const [workWeekEndDay, setWorkWeekEndDay] = useState(() => {
    const storedVal = localStorage.getItem('workWeekEnd');
    return storedVal ? parseInt(storedVal, 10) : 5;
  });

  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>([]);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [selectedInstructions, setSelectedInstructions] = useState('');
  const [selectedJobTitle, setSelectedJobTitle] = useState('');
  const [showDispenserModal, setShowDispenserModal] = useState(false);
  const [selectedDispensers, setSelectedDispensers] = useState<Dispenser[]>([]);
  const [selectedOrderIdModal, setSelectedOrderIdModal] = useState<string | null>(null); // Renamed to avoid clash
  const [selectedVisitNumberModal, setSelectedVisitNumberModal] = useState<string | null>(null); // Renamed
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  
  const workWeekDates = useMemo(() => {
    return getWorkWeekDateRanges(workWeekStartDay, workWeekEndDay, selectedDate);
  }, [workWeekStartDay, workWeekEndDay, selectedDate]);

  const goToCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  const loadData = useCallback(async (forceRefreshDispenserForOrderId?: string) => {
    setIsLoading(true);
    try {
      const data = await getWorkOrders();
      setWorkOrdersData(data);
      if (forceRefreshDispenserForOrderId && loadDispenserDataContext) {
        await loadDispenserDataContext(true);
      }
    } catch (error) {
      console.error("Failed to load work orders:", error);
      addToast('error', 'Failed to load work orders.');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, loadDispenserDataContext]);

  useEffect(() => {
    loadData();
    const handleDataUpdated = (event: Event) => {
      loadData(); 
    };
    window.addEventListener('fossa-data-updated', handleDataUpdated);
    return () => window.removeEventListener('fossa-data-updated', handleDataUpdated);
  }, [loadData]);

  // --- EFFECT FOR MERGING DISPENSER DATA ---
  useEffect(() => {
    if (dispenserDataLoaded && dispenserData?.dispenserData && workOrdersData.workOrders.length > 0) {
      setWorkOrdersData(prevData => {
        const updatedWorkOrders = prevData.workOrders.map(wo => {
          const existingDispensers = wo.dispensers && wo.dispensers.length > 0;
          const contextDispensers = dispenserData.dispenserData[wo.id]?.dispensers;

          if (!existingDispensers && contextDispensers && contextDispensers.length > 0) {
            return { ...wo, dispensers: contextDispensers };
          }
          // If WO already has dispensers and context has newer/different (optional check, for now just prioritize existing if any)
          // For simplicity, if wo.dispensers exists, we keep it. Otherwise, we use from context.
          // A more sophisticated merge could be done here if necessary.
          return wo;
        });
        return { ...prevData, workOrders: updatedWorkOrders };
      });
    }
  }, [dispenserData, dispenserDataLoaded, workOrdersData.workOrders.length]); // depends on workOrdersData.workOrders.length to run when WOs are loaded

  const getStoreTypeForFiltering = (order: WorkOrder): string => {
    const customerName = order.customer.name.toLowerCase();
    if (customerName.includes('7-eleven') || customerName.includes('7 eleven') || customerName.includes('speedway')) return '7-eleven';
    if (customerName.includes('circle k')) return 'circle-k';
    if (customerName.includes('wawa')) return 'wawa';
    return 'other';
  };

  useEffect(() => {
    let filtered = workOrdersData.workOrders;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => getStoreTypeForFiltering(order).toLowerCase() === activeFilter.toLowerCase());
    }
    // searchQuery filtering can be added here if needed for Schedule page specifically
    filtered = filtered.map(order => ({
      ...order,
      isFavorite: !!favorites[order.id]
    }));
    setFilteredWorkOrders(filtered);
  }, [workOrdersData.workOrders, activeFilter, favorites]); // searchQuery removed as not in UI
  
  useEffect(() => {
    const storedFavorites = localStorage.getItem('favorites');
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }
  }, []);

  const toggleFavorite = (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => {
      const newFavorites = { ...prev, [orderId]: !prev[orderId] };
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      addToast('success', newFavorites[orderId] ? 'Job added to favorites' : 'Job removed from favorites', 1500);
      return newFavorites;
    });
  };

  // Helper function to extract visit number (aligned with Home.tsx)
  const extractVisitNumber = (order: WorkOrder): string => {
    if (!order || !order.visits?.nextVisit?.url) return 'N/A';
    
    // Visit URLs typically have format: /app/work/123456/visits/125361/
    const matches = order.visits.nextVisit.url.match(/\/visits\/(\d+)/);
    return matches && matches[1] ? matches[1] : 'N/A';
  };
  
  const getStoreStyles = (storeType: string) => {
    const SKELETON_STYLE = {
        cardBorder: 'border-gray-300 dark:border-gray-600',
        headerBg: 'bg-gray-100 dark:bg-gray-750',
        badge: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
        cardBg: 'bg-white dark:bg-gray-800',
        text: 'text-gray-900 dark:text-white',
        dot: 'bg-gray-400',
      };
    switch (storeType.toLowerCase()) {
      case '7-eleven': return { ...SKELETON_STYLE, cardBorder: 'border-l-4 border-green-500', headerBg: 'bg-green-50 dark:bg-green-900/30', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', dot: 'bg-green-500' };
      case 'circle-k': return { ...SKELETON_STYLE, cardBorder: 'border-l-4 border-red-500', headerBg: 'bg-red-50 dark:bg-red-900/30', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', dot: 'bg-red-500' };
      case 'wawa': return { ...SKELETON_STYLE, cardBorder: 'border-l-4 border-purple-500', headerBg: 'bg-purple-50 dark:bg-purple-900/30', badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' };
      default: return { ...SKELETON_STYLE, cardBorder: 'border-l-4 border-blue-500', headerBg: 'bg-blue-50 dark:bg-blue-900/30', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' };
    }
  };

  const groupAndSortWorkOrders = useCallback((): GroupedWorkOrders => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd } = workWeekDates;

    const sortedOrders = [...filteredWorkOrders].sort((a, b) => {
      const dateA = new Date(a.visits?.nextVisit?.date || a.nextVisitDate || a.visitDate || a.date || 0);
      const dateB = new Date(b.visits?.nextVisit?.date || b.nextVisitDate || b.visitDate || b.date || 0);
      return dateA.getTime() - dateB.getTime();
    });
    
    const groups: GroupedWorkOrders = { currentDay: [], thisWeek: [], nextWeek: [], other: [] };

    sortedOrders.forEach(order => {
      const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!orderDateStr) {
        groups.other.push(order); 
        return;
      }
      const orderDate = new Date(orderDateStr);
      orderDate.setHours(0,0,0,0);

      if (orderDate.getTime() === today.getTime()) groups.currentDay.push(order);
      if (orderDate >= currentWeekStart && orderDate <= currentWeekEnd) groups.thisWeek.push(order);
      else if (orderDate >= nextWeekStart && orderDate <= nextWeekEnd) groups.nextWeek.push(order);
      else groups.other.push(order);
    });
    return groups;
  }, [filteredWorkOrders, workWeekDates]);

  const groupedWorkOrders = useMemo(() => {
    if (isLoading) return { currentDay: [], thisWeek: [], nextWeek: [], other: [] };
    return groupAndSortWorkOrders();
  }, [isLoading, groupAndSortWorkOrders]); // groupAndSortWorkOrders is dependency
  
  const handleViewInstructions = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setSelectedInstructions(order.instructions || 'No instructions provided.');
    setSelectedJobTitle(`Instructions for ${order.customer.name} - ${order.workOrderId || order.id}`);
    setShowInstructionsModal(true);
  };

  const handleViewDispenserData = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setSelectedDispensers(order.dispensers || []);
    setSelectedOrderIdModal(order.id);
    setSelectedVisitNumberModal(extractVisitNumber(order)); 
    setShowDispenserModal(true);
  };
  
  const handleClearDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOperationLoading(prev => ({...prev, [`clear-${orderId}`]: true}));
    try {
      await clearDispenserData(orderId);
      addToast('success', 'Dispenser data cleared successfully.');
      await loadData(orderId); 
    } catch (error) { 
      addToast('error', 'Failed to clear dispenser data.');
      console.error('Error clearing dispenser data:', error);
    } finally {
      setOperationLoading(prev => ({...prev, [`clear-${orderId}`]: false}));
    }
  };

  const handleForceRescrapeDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOperationLoading(prev => ({...prev, [`rescrape-${orderId}`]: true}));
    addToast('info', 'Starting dispenser data rescrape...');
    try {
      await forceRescrapeDispenserData(orderId);
      addToast('success', 'Dispenser rescrape initiated.');
      // Data will be reloaded by the fossa-data-updated event listener or manual refresh
    } catch (error) {
      addToast('error', 'Failed to force rescrape dispenser data.', 3000);
      console.error('Error forcing rescrape:', error);
    } finally {
      setOperationLoading(prev => ({...prev, [`rescrape-${orderId}`]: false}));
    }
  };

  // Transform workOrders to CalendarEvents for CalendarView
  const calendarEvents = useMemo((): CalendarEvent[] => {
    return filteredWorkOrders.map(wo => {
      const jobDate = wo.visits?.nextVisit?.date || wo.nextVisitDate || wo.visitDate || wo.scheduledDate || wo.date;
      return {
        id: wo.id,
        title: `${wo.customer.name}${wo.customer.storeNumber ? ` (#${wo.customer.storeNumber.replace(/^#+/, '')})` : ''}`,
        date: jobDate || new Date().toISOString(), // Ensure a valid date string
        storeType: getStoreTypeForFiltering(wo),
        storeNumber: wo.customer.storeNumber?.replace(/^#+/, '') || undefined,
        visitNumber: extractVisitNumber(wo) === 'N/A' ? undefined : extractVisitNumber(wo),
        dispensers: wo.dispensers,
        instructions: wo.instructions,
        services: wo.services,
        // description can be added if needed, e.g., a summary of services
      };
    });
  }, [filteredWorkOrders, getStoreTypeForFiltering, extractVisitNumber]);

  const renderJobRow = (order: WorkOrder, dateGroupClass?: string) => {
    const storeType = getStoreTypeForFiltering(order);
    const styles = getStoreStyles(storeType);
    const isFav = favorites[order.id] ?? order.isFavorite ?? false;
    const visitNumber = extractVisitNumber(order);
    const dispenserCount = order.dispensers?.length || 0;
    const filteredInstructionsOnCard = processInstructions(order.instructions, order);
    
    const jobDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
    const formattedJobDate = jobDate ? new Date(jobDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Date N/A';

    // Helper to generate WorkFossa URL
    const getWorkFossaUrl = (workOrderId?: string, visitId?: string) => {
      if (workOrderId && visitId) {
        return `https://app.workfossa.com/workorders/${workOrderId}/visits/${visitId}`;
      } else if (workOrderId) {
        return `https://app.workfossa.com/workorders/${workOrderId}`;
      }
      return 'https://app.workfossa.com';
    };
    const fossaUrl = getWorkFossaUrl(order.workOrderId, visitNumber);

    return (
      <div
        key={order.id}
        className={`job-card bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-4 border-l-4 ${styles.cardBorder} ${dateGroupClass || ''}`}
        data-store-type={storeType}
        data-work-order-id={order.workOrderId || 'N/A'}
        data-visit-id={visitNumber || 'N/A'}
      >
        {/* Top section: Store Name, WO Info, Favorite */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-grow">
            <h3 className={`text-lg font-semibold ${styles.text}`}>
              {order.customer.name}
              {order.customer.storeNumber && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  (#{order.customer.storeNumber.replace(/^#+/, '')})
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Job Date: {formattedJobDate}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            {order.workOrderId && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                WO: {order.workOrderId}
              </p>
            )}
            {visitNumber && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {visitNumber === 'N/A' ? `Visit: ${visitNumber}` : `Visit #${visitNumber}`}
              </p>
            )}
            <button
              onClick={(e) => toggleFavorite(order.id, e)}
              className={`mt-1 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 ${isFav ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}
              aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <FiStar className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Equipment & Instructions Row */}
        <div className="flex flex-col space-y-2 mb-3">
          {/* Equipment Info with Icon */}
          {dispenserCount > 0 && (
            <div className="flex items-center text-xs">
              <div className={`p-1 rounded-full mr-2 ${styles.badge}`}>
                <GiGasPump className={`h-3 w-3 ${styles.text}`} />
              </div>
              <span className={`${styles.text}`}>
                {dispenserCount} Dispenser{dispenserCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Instructions Display */}
          {filteredInstructionsOnCard && (
            <div className="flex items-start">
              <div className={`p-1 rounded-full mr-2 mt-0.5 ${styles.badge}`}>
                <FiFileText className={`h-3 w-3 ${styles.text}`} />
              </div>
              <p className={`text-xs whitespace-normal break-words ${styles.text}`}>
                {filteredInstructionsOnCard}
              </p>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 items-center justify-start pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => handleViewInstructions(e, order)}
            disabled={!order.instructions || operationLoading[`instr_${order.id}`]}
            className="flex items-center px-3 py-1.5 text-xs rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
          >
            <FiFileText className={`mr-1.5 h-4 w-4 ${styles.text}`} />
            {operationLoading[`instr_${order.id}`] ? 'Loading...' : 'Instructions'}
          </button>
          <button
            onClick={(e) => handleViewDispenserData(e, order)}
            disabled={operationLoading[`disp_${order.id}`] || dispenserCount === 0}
            className="flex items-center px-3 py-1.5 text-xs rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
          >
            <GiGasPump className={`mr-1.5 h-4 w-4 ${styles.text}`} />
            {operationLoading[`disp_${order.id}`] ? 'Loading...' : 'Dispensers'}
          </button>
          <button
            onClick={(e) => handleClearDispenserData(order.id, e)}
            disabled={operationLoading[`clear_${order.id}`] || dispenserCount === 0}
            className="flex items-center px-3 py-1.5 text-xs rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
          >
            <FiTrash2 className={`mr-1.5 h-4 w-4 ${styles.text}`} />
            {operationLoading[`clear_${order.id}`] ? 'Clearing...' : 'Clear Dispenser Data'}
          </button>
          <button
            onClick={(e) => handleForceRescrapeDispenserData(order.id, e)}
            disabled={operationLoading[`rescrape_${order.id}`]}
            className="flex items-center px-3 py-1.5 text-xs rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
          >
            <FiRefreshCw className={`mr-1.5 h-4 w-4 ${styles.text}`} />
            {operationLoading[`rescrape_${order.id}`] ? 'Rescraping...' : 'Force Rescrape'}
          </button>
          <a
            href={fossaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // Prevent card click or other parent events
            className="flex items-center px-3 py-1.5 text-xs rounded-md transition-colors duration-150 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
            aria-label="Open in WorkFossa"
          >
            <FiExternalLink className={`mr-1.5 h-4 w-4 ${styles.text}`} />
            WorkFossa
          </a>
        </div>
      </div>
    );
  };

  const renderWeeklySections = (grouped: GroupedWorkOrders) => {
    const sections = [
      { title: 'Current Week', orders: grouped.thisWeek, icon: <FiCalendar className="mr-2 text-blue-500" />, id: 'current-week' },
      { title: 'Next Week', orders: grouped.nextWeek, icon: <FiCalendar className="mr-2 text-green-500" />, id: 'next-week' },
      { title: 'Other Dates', orders: grouped.other, icon: <FiCalendar className="mr-2 text-gray-500" />, id: 'other-dates' },
    ];

    return (
      <>{sections.map(section => {
          if (section.orders.length === 0 && section.id !== 'current-week') return null;
          const isExpanded = expandedSections[section.id] || false;
          const displayLimit = section.id === 'other-dates' ? 4 : (section.id === 'current-week' || section.id === 'next-week' ? 100 : Infinity) ; // Show more for current/next week
          const visibleOrders = isExpanded ? section.orders : section.orders.slice(0, displayLimit);
          const hiddenCount = section.orders.length - visibleOrders.length;

          return (
            <div key={section.id} className="py-2">
              {/* Section Header - Aligned with guide's panel header style */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">{section.icon} {section.title}</h4>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${section.orders.length > 0 ? (section.id === 'current-week' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : section.id === 'next-week' ? 'bg-accent-green-100 dark:bg-accent-green-900/30 text-accent-green-700 dark:text-accent-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300') : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {section.orders.length} Job{section.orders.length !== 1 ? 's' : ''}
                </span>
              </div>
              {section.orders.length > 0 ? (
                <div className="p-2 sm:p-4 grid grid-cols-1 gap-4">
                  {visibleOrders.map(order => renderJobRow(order))}
                  {hiddenCount > 0 && (<button onClick={() => setExpandedSections(prev => ({ ...prev, [section.id]: true }))} className="w-full mt-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors">Show {hiddenCount} more job{hiddenCount !== 1 ? 's' : ''}</button>)}
                  {isExpanded && section.orders.length > displayLimit && (<button onClick={() => setExpandedSections(prev => ({ ...prev, [section.id]: false }))} className="w-full mt-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors">Show less</button>)}
                </div>
              ) : (<div className="p-6 text-center text-gray-500 dark:text-gray-400"><FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />No jobs scheduled for {section.title.toLowerCase()}.</div>)}
            </div>
          );
      })}</>
    );
  };

  // --- Compact View Rendering ---
  const renderCompactJobItem = (order: WorkOrder) => {
    const storeType = getStoreTypeForFiltering(order);
    const styles = getStoreStyles(storeType); // Use existing styles for consistency
    const visitNumber = extractVisitNumber(order);
    // const jobDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
    // const formattedJobDate = jobDate ? new Date(jobDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
    // const filteredInstructionsOnCard = processInstructions(order.instructions, order);

    return (
      <div 
        key={order.id}
        className={`p-2 rounded-lg border ${styles.cardBorder} ${styles.cardBg} hover:shadow-sm transition-all duration-200 cursor-pointer`}
        onClick={(e) => {
          // Prevent event bubbling if we're clicking on a job item that might be inside another clickable area
          e.stopPropagation();
          // Potentially open a modal or navigate, but for now, keep it simple
          // For example, could show quick instructions or navigate to a detailed view
          // setSelectedWorkOrder(order); // If we add a state for a selected order for a detail panel
          // setShowJobDetailModal(true); // If we add a job detail modal
          addToast('info', `Clicked on: ${order.customer?.name || 'Unknown Store'}`, 1500);
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
            {order.customer?.name || 'Unknown Store'}
          </div>
          <div className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${styles.badge}`}>
            #{visitNumber}
          </div>
        </div>
        
        {order.services && order.services.some(s => s.type === "Meter Calibration") && (
          <div className="flex items-center mt-0.5">
            <GiGasPump className="h-2.5 w-2.5 text-gray-500 dark:text-gray-400 mr-1" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {order.services.find(s => s.type === "Meter Calibration")?.quantity || 0}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCompactView = () => {
    const { thisWeek: thisWeekJobs, nextWeek: nextWeekJobs } = groupedWorkOrders;

    if (!workWeekDates) {
      return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Calculating week dates...</div>;
    }

    // Helper to render a day column (used for both current and next week)
    const renderDayColumn = (date: Date, jobsForDay: WorkOrder[], sectionKeyPrefix: string, isCurrentWeek: boolean) => {
      const isToday = date.toDateString() === new Date().toDateString() && isCurrentWeek;
      const sectionKey = `${sectionKeyPrefix}-day-${date.getDay()}`;
      const isExpanded = expandedSections[sectionKey] || false;
      
      // For next week, initially show 3 jobs unless expanded. For current week, show all.
      const initialDisplayLimit = isCurrentWeek ? jobsForDay.length : 3;
      const visibleJobs = isExpanded || isCurrentWeek ? jobsForDay : jobsForDay.slice(0, initialDisplayLimit);
      const hiddenJobCount = jobsForDay.length - visibleJobs.length;

      return (
        <div key={date.toISOString()} className={`flex flex-col ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
          {/* Date header */}
          <div className={`p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${isToday ? 'bg-blue-100/50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {date.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className={`font-semibold ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            {jobsForDay.length > 0 && (
              <span className={`text-xs px-2 py-1 rounded-full ${isToday ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                {jobsForDay.length}
              </span>
            )}
          </div>
          
          {/* Job cards */}
          <div className="flex-1 p-2 sm:p-3 space-y-2 overflow-y-auto min-h-[100px]">
            {visibleJobs.length > 0 ? visibleJobs.map(job => renderCompactJobItem(job)) : (
              <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4">No jobs</div>
            )}
            {hiddenJobCount > 0 && !isCurrentWeek && (
              <button 
                onClick={() => {
                  setExpandedSections(prev => ({
                    ...prev,
                    [sectionKey]: true
                  }));
                }}
                className="w-full mt-1 py-1 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
              >
                +{hiddenJobCount} more job{hiddenJobCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mx-1 sm:mx-2 my-2">
        {/* Header with navigation */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
              <FiCalendar className="mr-1.5 sm:mr-2 text-primary-500 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-base sm:text-lg">
                Week of {workWeekDates.currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
              onClick={() => {
                const newDate = new Date(workWeekDates.currentWeekStart);
                newDate.setDate(newDate.getDate() - 7);
                setSelectedDate(newDate);
              }}
              title="Previous Week"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={goToCurrentWeek}
              className="px-2 sm:px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs sm:text-sm font-medium transition-colors hover:bg-primary-200 dark:hover:bg-primary-800/50"
            >
              Today
            </button>
            <button 
              className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
              onClick={() => {
                const newDate = new Date(workWeekDates.currentWeekStart);
                newDate.setDate(newDate.getDate() + 7);
                setSelectedDate(newDate);
              }}
              title="Next Week"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        
        {/* Current Week Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700 gap-px">
          {Array.from({ length: 5 }).map((_, dayIndex) => {
            const currentDate = new Date(workWeekDates.currentWeekStart);
            currentDate.setDate(currentDate.getDate() + dayIndex);
            const jobsForDay = thisWeekJobs.filter(job => {
              const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.scheduledDate || job.date;
              if (!jobDate) return false;
              return new Date(jobDate).toDateString() === currentDate.toDateString();
            });
            return renderDayColumn(currentDate, jobsForDay, 'current-week', true);
          })}
        </div>
        
        {/* Next Week Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-px">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center text-sm sm:text-base">
              <FiCalendar className="mr-1.5 sm:mr-2 text-primary-500 h-4 w-4 sm:h-5 sm:w-5" />
              <span>Next Week ({workWeekDates.nextWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {workWeekDates.nextWeekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})</span>
              <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                {nextWeekJobs.length}
              </span>
            </h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700 gap-px">
            {Array.from({ length: 5 }).map((_, dayIndex) => {
              const currentDate = new Date(workWeekDates.nextWeekStart);
              currentDate.setDate(currentDate.getDate() + dayIndex);
              const jobsForDay = nextWeekJobs.filter(job => {
                const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.scheduledDate || job.date;
                if (!jobDate) return false;
                return new Date(jobDate).toDateString() === currentDate.toDateString();
              });
              return renderDayColumn(currentDate, jobsForDay, 'next-week', false);
            })}
          </div>
        </div>

        {(thisWeekJobs.length === 0 && nextWeekJobs.length === 0 && activeView === 'compact') && (
             <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                <FiInfo className="mx-auto h-10 w-10 mb-2 opacity-60" />
                No jobs to display in compact view for the current filter or selected weeks.
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 animate-fadeIn">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Work Schedule</h1>
      {isLoading && (<div className="py-10 text-center"><SkeletonJobsList /><p className="mt-2 text-gray-500 dark:text-gray-400">Loading schedule...</p></div>)}
      {!isLoading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 mx-2 my-2">
          {/* Week Navigation Header - Aligned with guide's panel header style */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <FiCalendar className="mr-2 text-primary-500" />
                <span className="text-lg">Week of {workWeekDates.currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </h3>
              {(() => {
                const now = new Date();
                const currentActualWeekRanges = getWorkWeekDateRanges(workWeekStartDay, workWeekEndDay, now); // Use Day state vars
                const isActualCurrentWeek = currentActualWeekRanges.currentWeekStart.getTime() === workWeekDates.currentWeekStart.getTime();
                const currentWeekJobsCount = groupedWorkOrders.thisWeek.length;
                if (isActualCurrentWeek && currentWeekJobsCount > 0) {
                  return (<span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium ml-3">{currentWeekJobsCount} Visit{currentWeekJobsCount !== 1 ? 's' : ''}</span>);
                }
                return null;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="flex items-center gap-1 py-1.5 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() - 7); setSelectedDate(newStart); }} 
                title="Previous Week"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> 
                <span className="text-sm font-medium">Previous Week</span>
              </button>
              <button 
                className="flex items-center gap-1 py-1.5 px-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors" 
                onClick={goToCurrentWeek} 
                title="Go to Current Week"
              >
                <FiCalendar className="h-4 w-4" />
                <span className="text-sm font-medium">Today</span>
              </button>
              <button 
                className="flex items-center gap-1 py-1.5 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors" 
                onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() + 7); setSelectedDate(newStart); }} 
                title="Next Week"
              >
                <span className="text-sm font-medium">Next Week</span> 
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
          {/* Filter Bar - Aligned with guide's filter controls container */}
          <div className="bg-gray-50 dark:bg-gray-800/80 p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-1 sm:mr-2">Filter:</span>
              {['all', '7-eleven', 'circle-k', 'wawa', 'other'].map(filter => {
                let displayName = filter.charAt(0).toUpperCase() + filter.slice(1);
                if (filter === '7-eleven') displayName = '7-Eleven';
                if (filter === 'circle-k') displayName = 'Circle K';
                
                return (
                  <button 
                    key={filter} 
                    className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === filter ? (filter === 'all' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium' : filter === '7-eleven' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-medium' : filter === 'circle-k' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 font-medium' : filter === 'wawa' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-medium' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium') : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`} 
                    onClick={() => setActiveFilter(filter as StoreFilter)}
                  >
                    {displayName}
                  </button>
                );
              })}
            </div>
            {activeFilter !== 'all' && (<button className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center" onClick={() => setActiveFilter('all')}><FiX className="h-3.5 w-3.5 mr-1" /> Clear Filter</button>)}
          </div>

          {/* View Selector Buttons */} 
          <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2">
            <button 
              onClick={() => setActiveView('weekly')}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-md text-sm font-medium transition-colors 
                ${activeView === 'weekly' 
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              <FiList /> Weekly
            </button>
            <button 
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-md text-sm font-medium transition-colors 
                ${activeView === 'calendar' 
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              <FiCalendar /> Calendar
            </button>
            <button 
              onClick={() => setActiveView('compact')}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-md text-sm font-medium transition-colors 
                ${activeView === 'compact' 
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              <FiGrid /> Compact
            </button>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {activeView === 'weekly' && renderWeeklySections(groupedWorkOrders)}
            {activeView === 'calendar' && (
              <CalendarView 
                events={calendarEvents}
                onEventClick={(event: CalendarEvent) => {
                  const originalOrder = filteredWorkOrders.find(wo => wo.id === event.id);
                  if (originalOrder) {
                    // Pass a mock MouseEvent if handleViewDispenserData expects one and can handle it being partial
                    handleViewDispenserData({ stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent, originalOrder);
                  }
                }}
              />
            )}
            {activeView === 'compact' && renderCompactView()}
          </div>
        </div>
      )}
      {showInstructionsModal && (<InstructionsModal isOpen={showInstructionsModal} onClose={() => setShowInstructionsModal(false)} instructions={selectedInstructions} title={selectedJobTitle}/>)}
      {showDispenserModal && (<DispenserModal isOpen={showDispenserModal} onClose={() => setShowDispenserModal(false)} dispensers={selectedDispensers} orderId={selectedOrderIdModal} visitNumber={selectedVisitNumberModal === null ? undefined : selectedVisitNumberModal}/>)}
    </div>
  );
};

export default Schedule; 
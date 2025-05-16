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
  FiExternalLink
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

// --- Copied Type Definitions ---
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

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

// --- Helper function to process instructions (Copied from Home.tsx) ---
const processInstructions = (instructions: string): string => {
  if (!instructions) return 'No instructions provided.';

  let processed = instructions;

  // Remove "SERVICE INSTRUCTIONS", "ADDITIONAL INSTRUCTIONS", etc.
  processed = processed.replace(/^(SERVICE|ADDITIONAL) INSTRUCTIONS:?\\s*/i, '');

  // Remove lines that are just "Instructions:", "Notes:", etc.
  processed = processed.replace(/^(Instructions|Notes):\\s*$/gim, '');
  
  // Collapse multiple empty lines to a single empty line
  processed = processed.replace(/\\n\\s*\\n/g, '\\n');

  // Remove leading/trailing whitespace from the entire text and from each line
  processed = processed.split('\\n').map(line => line.trim()).join('\\n').trim();
  
  // If, after processing, the instructions are empty or just placeholder, return a default message
  if (!processed || processed.toLowerCase() === 'none' || processed.toLowerCase() === 'n/a') {
    return 'No specific instructions provided.';
  }

  return processed;
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
  const [searchQuery, setSearchQuery] = useState<string>(''); // Not used in weekly view UI, but kept for filter logic
  
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
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [selectedInstructions, setSelectedInstructions] = useState('');
  const [selectedJobTitle, setSelectedJobTitle] = useState('');
  const [showDispenserModal, setShowDispenserModal] = useState(false);
  const [selectedDispensers, setSelectedDispensers] = useState<Dispenser[]>([]);
  const [selectedOrderIdModal, setSelectedOrderIdModal] = useState<string | null>(null); // Renamed to avoid clash
  const [selectedVisitNumberModal, setSelectedVisitNumberModal] = useState<string | null>(null); // Renamed
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
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
    if (dispenserDataLoaded && dispenserData && workOrdersData.workOrders.length > 0) {
      setWorkOrdersData(prevData => {
        const updatedWorkOrders = prevData.workOrders.map(wo => {
          // Check if this work order already has dispenser data or if there's relevant data in dispenserData
          const existingDispensers = wo.dispensers && wo.dispensers.length > 0;
          const contextDispensers = dispenserData[wo.id]?.dispensers;

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
    if (customerName.includes('7-eleven') || customerName.includes('7 eleven')) return '7-eleven';
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
    const storedFavorites = localStorage.getItem('favoriteWorkOrders');
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }
  }, []);

  const toggleFavorite = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavorites = { ...prev };
      if (newFavorites[orderId]) {
        delete newFavorites[orderId];
        addToast('info', 'Removed from favorites', 1500);
      } else {
        newFavorites[orderId] = true;
        addToast('success', 'Added to favorites', 1500);
      }
      localStorage.setItem('favoriteWorkOrders', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const extractVisitNumber = (order: WorkOrder): string => {
    if (order.visits?.nextVisit?.visit_number) {
      return order.visits.nextVisit.visit_number.toString();
    }
    if (order.workOrderId && order.workOrderId.includes('-')) {
        const parts = order.workOrderId.split('-');
        if (parts.length > 1 && !isNaN(parseInt(parts[parts.length -1]))) {
            return parts[parts.length -1];
        }
    }
    return 'N/A';
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
      addToast('error', 'Failed to start dispenser rescrape.');
      console.error('Error forcing rescrape:', error);
    } finally {
      setOperationLoading(prev => ({...prev, [`rescrape-${orderId}`]: false}));
    }
  };

  const renderJobRow = (order: WorkOrder, dateGroupClass?: string) => {
    const storeType = getStoreTypeForFiltering(order);
    const styles = getStoreStyles(storeType);
    const isFav = favorites[order.id] ?? order.isFavorite ?? false;
    const visitNumber = extractVisitNumber(order);
    const dispenserCount = order.dispensers?.length || 0;
    const processedInstructions = processInstructions(order.instructions);
    
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
        className={`job-card bg-white dark:bg-slate-800 shadow-lg rounded-lg p-4 mb-4 border-l-4 ${styles.cardBorder} ${dateGroupClass || ''}`}
        data-store-type={storeType}
        data-work-order-id={order.workOrderId || 'N/A'}
        data-visit-id={visitNumber || 'N/A'}
      >
        {/* Top section: Store Name, WO Info, Favorite */}
        <div className="flex justify-between items-start mb-3">
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
                Visit: {visitNumber}
              </p>
            )}
            <button
              onClick={(e) => toggleFavorite(order.id, e)}
              className={`mt-1 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors duration-150 ${isFav ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}
              aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <FiStar className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Equipment Section */}
        {dispenserCount > 0 && (
          <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              Equipment ({dispenserCount} Dispenser{dispenserCount > 1 ? 's' : ''})
            </h4>
            {/* Minimal dispenser info for now, can be expanded if needed */}
          </div>
        )}

        {/* Instructions Preview - if instructions exist */}
        {processedInstructions && processedInstructions !== 'No specific instructions provided.' && processedInstructions !== 'No instructions provided.' && (
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/50 rounded-md">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Instructions Preview</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
              {processedInstructions}
            </p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 items-center justify-start pt-2 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={(e) => handleViewInstructions(e, order)}
            disabled={(!order.instructions && !processedInstructions.includes('No specific instructions provided.')) || operationLoading[`instr_${order.id}`]}
            className="flex items-center px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiFileText className="mr-1.5 h-4 w-4" />
            {operationLoading[`instr_${order.id}`] ? 'Loading...' : 'Instructions'}
          </button>
          <button
            onClick={(e) => handleViewDispenserData(e, order)}
            disabled={operationLoading[`disp_${order.id}`] || dispenserCount === 0}
            className="flex items-center px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GiGasPump className="mr-1.5 h-4 w-4" />
            {operationLoading[`disp_${order.id}`] ? 'Loading...' : 'Dispensers'}
          </button>
          <button
            onClick={(e) => handleClearDispenserData(order.id, e)}
            disabled={operationLoading[`clear_${order.id}`] || dispenserCount === 0}
            className="flex items-center px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiTrash2 className="mr-1.5 h-4 w-4" />
            {operationLoading[`clear_${order.id}`] ? 'Clearing...' : 'Clear Dispenser Data'}
          </button>
          <button
            onClick={(e) => handleForceRescrapeDispenserData(order.id, e)}
            disabled={operationLoading[`rescrape_${order.id}`]}
            className="flex items-center px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiRefreshCw className="mr-1.5 h-4 w-4" />
            {operationLoading[`rescrape_${order.id}`] ? 'Rescraping...' : 'Force Rescrape'}
          </button>
          <a
            href={fossaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // Prevent card click or other parent events
            className="flex items-center px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors duration-150"
            aria-label="Open in WorkFossa"
          >
            <FiExternalLink className="mr-1.5 h-4 w-4" />
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
              <div className={`bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between`}>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">{section.icon} {section.title}</h4>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${section.orders.length > 0 ? (section.id === 'current-week' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : section.id === 'next-week' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300') : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
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

  return (
    <div className="container mx-auto p-4 animate-fadeIn">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Work Schedule</h1>
      {isLoading && (<div className="py-10 text-center"><SkeletonJobsList /><p className="mt-2 text-gray-500 dark:text-gray-400">Loading schedule...</p></div>)}
      {!isLoading && (
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 mx-2 my-2">
          <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <FiCalendar className="mr-2 text-blue-500" />
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
              <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors" onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() - 7); setSelectedDate(newStart); }} title="Previous Week"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
              <button className="flex items-center gap-1 py-1.5 px-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors" onClick={goToCurrentWeek} title="Go to Current Week"><FiCalendar className="h-4 w-4" /><span className="text-sm font-medium">Today</span></button>
              <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors" onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() + 7); setSelectedDate(newStart); }} title="Next Week"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
            </div>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-1 sm:mr-2">Filter:</span>
              {['all', '7-eleven', 'circle-k', 'wawa', 'other'].map(filter => (<button key={filter} className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === filter ? (filter === 'all' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium' : filter === '7-eleven' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-medium' : filter === 'circle-k' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 font-medium' : filter === 'wawa' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-medium' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium') : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`} onClick={() => setActiveFilter(filter as StoreFilter)}>{filter === '7-eleven' ? '7-11' : filter.charAt(0).toUpperCase() + filter.slice(1)}</button>))}
            </div>
            {activeFilter !== 'all' && (<button className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center" onClick={() => setActiveFilter('all')}><FiX className="h-3.5 w-3.5 mr-1" /> Clear Filter</button>)}
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {renderWeeklySections(groupedWorkOrders)}
          </div>
        </div>
      )}
      {showInstructionsModal && (<InstructionsModal isOpen={showInstructionsModal} onClose={() => setShowInstructionsModal(false)} instructions={selectedInstructions} title={selectedJobTitle}/>)}
      {showDispenserModal && (<DispenserModal isOpen={showDispenserModal} onClose={() => setShowDispenserModal(false)} dispensers={selectedDispensers} orderId={selectedOrderIdModal} visitNumber={selectedVisitNumberModal === null ? undefined : selectedVisitNumberModal}/>)}
    </div>
  );
};

export default Schedule; 
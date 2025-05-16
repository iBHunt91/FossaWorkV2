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
import { getWorkOrders, clearDispenserData, forceRescrapeDispenserData, getDispenserScrapeStatus } from '../services/scrapeService';
import { SkeletonJobsList, SkeletonDashboardStats } from '../components/Skeleton';
import InstructionsModal from '../components/InstructionsModal';
import DispenserModal from '../components/DispenserModal';
import fuelGrades from '../data/fuel_grades'; // Assuming this is needed for getStoreStyles or similar

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

// --- Helper function to calculate work week date ranges (Full version from Home.tsx) ---
const getWorkWeekDateRanges = (
  workWeekStartDay: number = 1, // Monday default
  workWeekEndDay: number = 5,   // Friday default
  selectedDate: Date = new Date()
): WorkWeekDateRanges => {
  const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
  const today = dateObj;
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = today.getHours();

  const isAfterWorkWeekEnd = (currentDayOfWeek === workWeekEndDay && currentHour >= 17) || 
                           currentDayOfWeek > workWeekEndDay || 
                           currentDayOfWeek < workWeekStartDay;

  const currentWeekStart = new Date(today);
  let diffToStart;
  if (isAfterWorkWeekEnd && !(currentDayOfWeek === workWeekStartDay && currentHour < 17) ) { // Ensure we are not on the start day itself before 5pm
    diffToStart = (workWeekStartDay + 7 - currentDayOfWeek) % 7;
    if (diffToStart === 0 && currentDayOfWeek !== workWeekStartDay) diffToStart = 7; 
  } else {
    diffToStart = ((currentDayOfWeek - workWeekStartDay) + 7) % 7;
  }
  
  if (isAfterWorkWeekEnd && !(currentDayOfWeek === workWeekStartDay && currentHour < 17)){
    currentWeekStart.setDate(today.getDate() + diffToStart);
  } else {
    currentWeekStart.setDate(today.getDate() - diffToStart);
  }
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  const daysToAdd = workWeekEndDay < workWeekStartDay ? 
    (7 - workWeekStartDay + workWeekEndDay) : 
    (workWeekEndDay - workWeekStartDay);
  currentWeekEnd.setDate(currentWeekStart.getDate() + daysToAdd);
  currentWeekEnd.setHours(17, 0, 0, 0);

  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);

  const nextWeekEnd = new Date(currentWeekEnd);
  nextWeekEnd.setDate(currentWeekEnd.getDate() + 7);

  return { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd };
};

// --- Schedule Component ---
const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { dispenserData, loadDispenserData: loadDispenserDataContext, isLoaded: dispenserDataLoaded } = useDispenserData();

  // State variables (copied and adapted from Home.tsx)
  const [workOrdersData, setWorkOrdersData] = useState<{workOrders: WorkOrder[], metadata: any}>({
    workOrders: [],
    metadata: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StoreFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [selectedDate, setSelectedDate] = useState(new Date()); // For week navigation
  const [workWeekStart, setWorkWeekStart] = useState(() => {
    const storedVal = localStorage.getItem('workWeekStart');
    return storedVal ? parseInt(storedVal, 10) : 1; // Default Monday
  });
  const [workWeekEnd, setWorkWeekEnd] = useState(() => {
    const storedVal = localStorage.getItem('workWeekEnd');
    return storedVal ? parseInt(storedVal, 10) : 5; // Default Friday
  });

  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>([]);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [selectedInstructions, setSelectedInstructions] = useState('');
  const [selectedJobTitle, setSelectedJobTitle] = useState('');
  const [showDispenserModal, setShowDispenserModal] = useState(false);
  const [selectedDispensers, setSelectedDispensers] = useState<Dispenser[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedVisitNumber, setSelectedVisitNumber] = useState<string | null>(null);
  const [clearingDispenserId, setClearingDispenserId] = useState<string | null>(null);
  const [reScrapingDispenserId, setReScrapingDispenserId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<{ type: 'clear' | 'rescrape', orderId: string } | null>(null);
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});

  const workWeekDates = useMemo(() => {
    return getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
  }, [workWeekStart, workWeekEnd, selectedDate]);
  
  const goToCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  // Placeholder for renderWeeklySections - will be filled with Home.tsx logic
  const renderWeeklySections = (grouped: any) => <div className="p-4"><SkeletonJobsList /> <p className="text-center text-gray-500">Job sections will appear here once data is loaded and processed.</p></div>;
  
  // Placeholder for groupAndSortWorkOrders - will be filled
   type GroupedWorkOrders = {
    thisWeek: WorkOrder[];
    nextWeek: WorkOrder[];
    other: WorkOrder[];
    currentDay: WorkOrder[];
  };

  const groupAndSortWorkOrders = (): GroupedWorkOrders => {
    // Simplified mock implementation
    return { thisWeek: [], nextWeek: [], other: [], currentDay: [] };
  };

  const groupedWorkOrders = useMemo(() => {
    if (isLoading) return { thisWeek: [], nextWeek: [], other: [], currentDay: [] };
    return groupAndSortWorkOrders();
  }, [isLoading, filteredWorkOrders, workWeekDates, activeFilter, searchQuery]);


  // --- Load Data Effect (copied and adapted) ---
  const loadData = useCallback(async (forceRefreshDispenserForOrderId?: string) => {
    console.log('Schedule.tsx: loadData triggered');
    setIsLoading(true);
    try {
      const data = await getWorkOrders();
      setWorkOrdersData(data);
      if (forceRefreshDispenserForOrderId && loadDispenserDataContext) {
        console.log(`Schedule.tsx: Force refreshing dispenser data for order ${forceRefreshDispenserForOrderId}`);
        await loadDispenserDataContext(true, forceRefreshDispenserForOrderId);
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
      console.log('fossa-data-updated event received in Schedule.tsx', (event as CustomEvent).detail);
      loadData(); 
    };
    window.addEventListener('fossa-data-updated', handleDataUpdated);
    return () => window.removeEventListener('fossa-data-updated', handleDataUpdated);
  }, [loadData]);

  // --- Filtering Logic (copied and adapted) ---
  useEffect(() => {
    let filtered = workOrdersData.workOrders;

    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => getStoreTypeForFiltering(order).toLowerCase() === activeFilter.toLowerCase());
    }

    if (searchQuery) {
      const lowerSearchQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        (order.customer.name && order.customer.name.toLowerCase().includes(lowerSearchQuery)) ||
        (order.workOrderId && order.workOrderId.toLowerCase().includes(lowerSearchQuery)) ||
        (order.instructions && order.instructions.toLowerCase().includes(lowerSearchQuery)) ||
        (order.id && order.id.toLowerCase().includes(lowerSearchQuery))
      );
    }
    
    // Apply favorite status
    filtered = filtered.map(order => ({
      ...order,
      isFavorite: !!favorites[order.id]
    }));

    setFilteredWorkOrders(filtered);
  }, [workOrdersData.workOrders, activeFilter, searchQuery, favorites]);
  
  // --- Mocked/Adapted Helper Functions (These need full implementation from Home.tsx) ---
  const getStoreTypeForFiltering = (order: WorkOrder): string => {
    const customerName = order.customer.name.toLowerCase();
    if (customerName.includes('7-eleven') || customerName.includes('7 eleven')) return '7-eleven';
    if (customerName.includes('circle k')) return 'circle-k';
    if (customerName.includes('wawa')) return 'wawa';
    return 'other';
  };

  // This needs the full implementation from Home.tsx
  const renderJobRow = (order: WorkOrder, dateGroupClass?: string) => {
    const isFavorite = !!favorites[order.id];
    const storeStyle = getStoreStyles(getStoreTypeForFiltering(order));
    const visitId = order.visits?.nextVisit?.id || order.visits?.scheduled?.id || 'N/A';
    const fullInstructions = order.instructions || 'No instructions available.';
    const isClearing = operationLoading[`clear-${order.id}`];
    const isRescraping = operationLoading[`rescrape-${order.id}`];

    return (
      <div
        key={order.id}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border ${storeStyle.cardBorder} hover:shadow-md transition-all duration-200 ${dateGroupClass ? 'date-grouped-card' : ''}`}
      >
        <div className={`flex justify-between items-center px-4 py-3 ${storeStyle.headerBg} border-b border-gray-200 dark:border-gray-700`}>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => toggleFavorite(order.id.toString(), e)}
              className={`transition-colors focus:outline-none ${
                isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400 dark:hover:text-amber-400'
              }`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <FiStar className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">
              {order.customer.name} - {order.workOrderId || order.id}
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {visitId}
            </div>
            <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              #{extractVisitNumber(order)}
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center">
                <FiCalendar className="h-3.5 w-3.5 mr-1.5" /> Visit Date
              </div>
              <p className="text-sm text-gray-800 dark:text-white">
                {order.visits?.nextVisit?.date ? new Date(order.visits.nextVisit.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not Scheduled'}
              </p>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center">
                <FiTool className="h-3.5 w-3.5 mr-1.5" /> Equipment
              </div>
              <p className="text-sm text-gray-800 dark:text-white">
                {order.dispensers ? `${order.dispensers.length} Dispenser(s)` : 'No dispenser data'}
              </p>
            </div>
          </div>
          
          {order.services && order.services.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center">
                <FiFileText className="h-3.5 w-3.5 mr-1.5" /> Services
              </div>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                {order.services.slice(0,2).map((service, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {service.description} (Qty: {service.quantity})
                  </li>
                ))}
                {order.services.length > 2 && <li className="text-xs text-gray-500 dark:text-gray-400">+ {order.services.length - 2} more...</li>}
              </ul>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <button 
                onClick={(e) => handleViewInstructions(e, order)}
                className="flex items-center text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <FiInfo className="h-3.5 w-3.5 mr-1" /> View Instructions
              </button>
              {order.dispensers && order.dispensers.length > 0 && (
                <button 
                  onClick={(e) => handleViewDispenserData(e, order)}
                  className="flex items-center text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                >
                  <GiGasPump className="h-3.5 w-3.5 mr-1" /> View Dispensers ({order.dispensers.length})
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => handleClearDispenserData(order.id, e)}
                className={`p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Clear Dispenser Data"
                disabled={isClearing || isRescraping}
              >
                {isClearing ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}
              </button>
              <button
                onClick={(e) => handleForceRescrapeDispenserData(order.id, e)}
                className={`p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500 dark:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Force Rescrape Dispenser Data"
                disabled={isClearing || isRescraping}
              >
                {isRescraping ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiRefreshCw className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const getStoreStyles = (storeType: string) => {
    // Simplified from Home.tsx, needs full version for colors etc.
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
  
  useEffect(() => {
    const storedFavorites = localStorage.getItem('favoriteWorkOrders');
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }
  }, []);

  // --- Action Handlers (Copied and adapted from Home.tsx) ---
  const handleViewInstructions = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setSelectedInstructions(order.instructions || 'No instructions provided.');
    setSelectedJobTitle(`Instructions for ${order.customer.name} - ${order.workOrderId || order.id}`);
    setShowInstructionsModal(true);
  };

  const handleViewDispenserData = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setSelectedDispensers(order.dispensers || []);
    setSelectedOrderId(order.id);
    setSelectedVisitNumber(extractVisitNumber(order)); 
    setShowDispenserModal(true);
  };
  
  const handleClearDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOperationLoading(prev => ({...prev, [`clear-${orderId}`]: true}));
    try {
      await clearDispenserData(orderId);
      addToast('success', 'Dispenser data cleared successfully.');
      await loadData(orderId); // Refresh data for this specific order
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
      // Polling for completion will be handled by a global mechanism or DispenserModal if it takes over polling
      // For now, we can assume a manual refresh or event will update status.
      // We can initiate polling here if needed or rely on DispenserModal to do it.
      // startPolling(orderId, 'dispenser'); // Example if we had local polling
      addToast('success', 'Dispenser rescrape initiated. Check status in modal or refresh.');
      // Optionally, refresh data after a delay or upon a completion event
      // setTimeout(() => loadData(orderId), 5000); // Simple refresh after 5s
    } catch (error) {
      addToast('error', 'Failed to start dispenser rescrape.');
      console.error('Error forcing rescrape:', error);
    } finally {
      setOperationLoading(prev => ({...prev, [`rescrape-${orderId}`]: false}));
    }
  };

  // --- renderWeeklySections (Full version from Home.tsx) ---
  const renderWeeklySections = (grouped: GroupedWorkOrders) => {
    const sections = [
      { title: 'Current Week', orders: grouped.thisWeek, icon: <FiCalendar className="mr-2 text-blue-500" />, id: 'current-week' },
      { title: 'Next Week', orders: grouped.nextWeek, icon: <FiCalendar className="mr-2 text-green-500" />, id: 'next-week' },
      { title: 'Other Dates', orders: grouped.other, icon: <FiCalendar className="mr-2 text-gray-500" />, id: 'other-dates' },
    ];

    return (
      <>
        {sections.map(section => {
          if (section.orders.length === 0 && section.id !== 'current-week') return null; // Always show current week section

          const isExpanded = expandedSections[section.id] || false;
          const displayLimit = section.id === 'other-dates' ? 4 : Infinity; // Show fewer for 'other' initially
          const visibleOrders = isExpanded ? section.orders : section.orders.slice(0, displayLimit);
          const hiddenCount = section.orders.length - visibleOrders.length;

          return (
            <div key={section.id} className="py-2">
              <div className={`bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between`}>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  {section.icon} {section.title}
                </h4>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium 
                  ${section.orders.length > 0 ? 
                    (section.id === 'current-week' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 
                     section.id === 'next-week' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 
                                                 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300') 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                `}>
                  {section.orders.length} Job{section.orders.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {section.orders.length > 0 ? (
                <div className="p-2 sm:p-4 grid grid-cols-1 gap-4">
                  {visibleOrders.map(order => renderJobRow(order))}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, [section.id]: true }))}
                      className="w-full mt-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                    >
                      Show {hiddenCount} more job{hiddenCount !== 1 ? 's' : ''}
                    </button>
                  )}
                  {isExpanded && section.orders.length > displayLimit && (
                     <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, [section.id]: false }))}
                      className="w-full mt-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                    >
                      Show less
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No jobs scheduled for {section.title.toLowerCase()}.
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  // --- JSX --- (Ensure all functions like getWorkWeekDateRanges are the full versions)
  return (
    <div className="container mx-auto p-4 animate-fadeIn">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Work Schedule</h1>
      
      {isLoading && (
        <div className="py-10 text-center">
          <SkeletonJobsList />
          <p className="mt-2 text-gray-500 dark:text-gray-400">Loading schedule...</p>
        </div>
      )}

      {!isLoading && (
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 mx-2 my-2">
          {/* Navigation bar - Copied from previous step, ensure getWorkWeekDateRanges is full version */}
          <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <FiCalendar className="mr-2 text-blue-500" />
                <span className="text-lg">
                  Week of {getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate).currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </h3>
              {(() => {
                const now = new Date();
                const currentActualWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, now);
                const selectedWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
                const isActualCurrentWeek = currentActualWeekRanges.currentWeekStart.getTime() === selectedWeekRanges.currentWeekStart.getTime();
                
                const currentWeekJobs = groupedWorkOrders.thisWeek.filter(job => {
                    const jobDate = new Date(job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.date || 0);
                    jobDate.setHours(0,0,0,0);
                    return jobDate >= currentActualWeekRanges.currentWeekStart && jobDate <= currentActualWeekRanges.currentWeekEnd;
                });

                if (isActualCurrentWeek && currentWeekJobs.length > 0) {
                  return (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium ml-3">
                      {currentWeekJobs.length} Visit{currentWeekJobs.length !== 1 ? 's' : ''}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                onClick={() => {
                  const newStart = new Date(workWeekDates.currentWeekStart);
                  newStart.setDate(newStart.getDate() - 7);
                  setSelectedDate(newStart);
                }}
                title="Previous Week"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
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
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                onClick={() => {
                  const newStart = new Date(workWeekDates.currentWeekStart);
                  newStart.setDate(newStart.getDate() + 7);
                  setSelectedDate(newStart);
                }}
                title="Next Week"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Filter bar - Copied from previous step */}
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-1 sm:mr-2">Filter:</span>
              {['all', '7-eleven', 'circle-k', 'wawa', 'other'].map(filter => (
                <button
                  key={filter}
                  className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === filter 
                    ? (filter === 'all' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium' :
                       filter === '7-eleven' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-medium' :
                       filter === 'circle-k' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 font-medium' :
                       filter === 'wawa' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-medium' :
                       'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium')
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                  onClick={() => setActiveFilter(filter as StoreFilter)}
                >
                  {filter === '7-eleven' ? '7-11' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            {activeFilter !== 'all' && (
              <button
                className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center"
                onClick={() => setActiveFilter('all')}
              >
                <FiX className="h-3.5 w-3.5 mr-1" /> Clear Filter
              </button>
            )}
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {renderWeeklySections(groupedWorkOrders)}
          </div>
        </div>
      )}
      {showInstructionsModal && (
        <InstructionsModal
          isOpen={showInstructionsModal}
          onClose={() => setShowInstructionsModal(false)}
          instructions={selectedInstructions}
          title={selectedJobTitle}
        />
      )}
      {showDispenserModal && (
        <DispenserModal
          isOpen={showDispenserModal}
          onClose={() => setShowDispenserModal(false)}
          dispensers={selectedDispensers}
          orderId={selectedOrderId}
          visitNumber={selectedVisitNumber === null ? undefined : selectedVisitNumber}
          // Removed onDataCleared and onRescrapeComplete as they are not part of DispenserModalProps
          // If refresh is needed, it should be handled via loadData() in Schedule.tsx or context
        />
      )}
    </div>
  );
};

export default Schedule; 
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
import { SkeletonJobsList } from '../components/Skeleton'; // Assuming this might be needed
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

// --- Schedule Component ---
const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { dispenserData, loadDispenserData: loadDispenserDataContext } = useDispenserData();

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


  // --- Copied Helper Functions (will be filled in later or adapted) ---
  const getWorkWeekDateRanges = useCallback((startDay: number, endDay: number, date: Date): WorkWeekDateRanges => {
    // This is a simplified version. The full logic from Home.tsx should be here.
    const currentWeekStart = new Date(date);
    currentWeekStart.setDate(date.getDate() - (date.getDay() - startDay + 7) % 7);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + (endDay - startDay));
    currentWeekEnd.setHours(17, 0, 0, 0);
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    const nextWeekEnd = new Date(currentWeekEnd);
    nextWeekEnd.setDate(currentWeekEnd.getDate() + 7);

    return { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd };
  }, []);

  const workWeekDates = useMemo(() => {
    return getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
  }, [workWeekStart, workWeekEnd, selectedDate, getWorkWeekDateRanges]);
  
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
  const loadData = useCallback(async (forceRefreshDispenser = false) => {
    setIsLoading(true);
    try {
      const data = await getWorkOrders();
      setWorkOrdersData(data);
      // Initial full load of dispenser data if not already loaded by context
      if (forceRefreshDispenser || Object.keys(dispenserData).length === 0) {
        // await loadDispenserDataContext(); // This might be called from Home.tsx context
      }
    } catch (error) {
      console.error("Failed to load work orders:", error);
      addToast('error', 'Failed to load work orders.');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, loadDispenserDataContext, dispenserData]);

  useEffect(() => {
    loadData();
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
  const renderJobRow = (order: WorkOrder, dateGroupClass?: string) => (
    <div key={order.id} className={`p-2 my-2 border rounded ${dateGroupClass}`}>
      <p>{order.customer.name} - {order.workOrderId}</p>
      <p>Mocked Job Row</p>
    </div>
  );
  
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


  // --- JSX from previous step ---
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Work Schedule</h1>
      
      {isLoading && (
        <div className="py-10 text-center">
          <SkeletonJobsList />
        </div>
      )}

      {!isLoading && (
        // Weekly View Section
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 mx-2 my-2">
          {/* Always-visible navigation bar */}
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
                const currentActualWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, now) as any;
                const selectedWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate) as any;
                const isActualCurrentWeek = currentActualWeekRanges.currentWeekStart.getTime() === selectedWeekRanges.currentWeekStart.getTime();
                
                if (isActualCurrentWeek && groupedWorkOrders.thisWeek.length > 0) {
                  return (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium ml-3">
                      {groupedWorkOrders.thisWeek.length} Visit{groupedWorkOrders.thisWeek.length !== 1 ? 's' : ''}
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
                  const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate) as any;
                  const newStart = new Date(dateRanges.currentWeekStart);
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
                  const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate) as any;
                  const newStart = new Date(dateRanges.currentWeekStart);
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
          
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-1 sm:mr-2">Filter:</span>
              
              <button
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm ${activeFilter === 'all' 
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveFilter('all')}
              >
                All
              </button>
              
              <button
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === '7-eleven' 
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-medium' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveFilter('7-eleven')}
              >
                7-11
              </button>
              
              <button
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === 'circle-k' 
                  ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 font-medium' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveFilter('circle-k')}
              >
                Circle K
              </button>
              
              <button
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === 'wawa' 
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-medium' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveFilter('wawa')}
              >
                Wawa
              </button>
              
              <button
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm flex items-center ${activeFilter === 'other' 
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-medium' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveFilter('other')}
              >
                Other
              </button>
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
          onDataCleared={() => loadData(true)}
          onRescrapeComplete={() => loadData(true)}
        />
      )}
    </div>
  );
};

export default Schedule; 
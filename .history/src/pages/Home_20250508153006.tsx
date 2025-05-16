import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { 
  FiActivity, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiClock, 
  FiHome, 
  FiMapPin, 
  FiFileText, 
  FiTool, 
  FiBriefcase, 
  FiExternalLink, 
  FiCalendar,
  FiGrid,
  FiFilter,
  FiX,
  FiShoppingBag,
  FiInfo,
  FiTrash2,
  FiRefreshCw,
  FiPieChart,
  FiTrendingUp,
  FiList,
  FiArrowUp,
  FiSearch,
  FiStar,
  FiBarChart2,
  FiChevronDown,
  FiSettings,
  FiMaximize,
  FiMinimize,
  FiDownload,
  FiSun,
  FiMoon,
  FiHash,
  FiClipboard,
  FiDroplet,
  FiGlobe,
  FiDatabase  // Add FiDatabase icon for our new button
} from 'react-icons/fi'
import { GiGasPump } from 'react-icons/gi'
import LastScrapedTime from '../components/LastScrapedTime'
import NextScrapeTime from '../components/NextScrapeTime'
import ScrapeLogsConsole from '../components/ScrapeLogsConsole'
import DispenserModal from '../components/DispenserModal' // Reverted: Explicitly adding .tsx extension is not allowed by tsconfig
import { useNavigate } from 'react-router-dom'
import { clearDispenserData, forceRescrapeDispenserData, getDispenserScrapeStatus, getWorkOrders, startScrapeJob, getScrapeStatus, startDispenserScrapeJob } from '../services/scrapeService'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { useDispenserData } from '../context/DispenserContext'
import { 
  SkeletonDashboardStats, 
  SkeletonJobsList 
} from '../components/Skeleton'

// Import fuel grades list for proper ordering
import fuelGrades from '../data/fuel_grades';

// View type enum
type ViewType = 'weekly' | 'calendar' | 'compact';

// Store filter type
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

// Customer type definition
type Customer = {
  name: string;
  storeNumber?: string | null;
  rawHtml?: string;
};

// Define a Dispenser type
type Dispenser = {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: {[key: string]: string}; // Changed to indexed signature to handle any field name
  html?: string;
};

// Define a WorkOrder type that includes dispensers
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
  // Add optional fields used elsewhere in the component
  scheduledDate?: string;
  nextVisitDate?: string;
  visitDate?: string;
  date?: string;
};

// Add a utility function to sort fuel types according to the official order
const sortFuelTypes = (gradeString: string): string[] => {
  if (!gradeString) return [];
  
  // Split by commas, semicolons, or slashes to get individual grades
  const grades = gradeString.split(/[,;\/]+/).map(grade => grade.trim());
  
  // Sort according to the order in fuelGrades list
  return [...grades].sort((a, b) => {
    // Try exact match first for both
    const exactMatchA = fuelGrades.findIndex(grade => 
      grade.toLowerCase() === a.toLowerCase()
    );
    const exactMatchB = fuelGrades.findIndex(grade => 
      grade.toLowerCase() === b.toLowerCase()
    );
    
    // If both have exact matches, use those
    if (exactMatchA !== -1 && exactMatchB !== -1) {
      return exactMatchA - exactMatchB;
    }
    
    // If only one has an exact match, prioritize it
    if (exactMatchA !== -1) return -1;
    if (exactMatchB !== -1) return 1;
    
    // Otherwise, find the best match by finding the shortest containing grade
    // (This prevents "Plus" in "Ethanol-Free Gasoline Plus" from matching with "Plus")
    const bestMatchA = fuelGrades.reduce((best, grade) => {
      if (a.toLowerCase().includes(grade.toLowerCase()) && 
          (best === -1 || grade.length > fuelGrades[best].length)) {
        return fuelGrades.indexOf(grade);
      }
      return best;
    }, -1);
    
    const bestMatchB = fuelGrades.reduce((best, grade) => {
      if (b.toLowerCase().includes(grade.toLowerCase()) && 
          (best === -1 || grade.length > fuelGrades[best].length)) {
        return fuelGrades.indexOf(grade);
      }
      return best;
    }, -1);
    
    // If not found in list, put at the end
    if (bestMatchA === -1) return 1;
    if (bestMatchB === -1) return -1;
    
    return bestMatchA - bestMatchB;
  });
};

// Helper function to calculate work week date ranges
// Returns standard Monday-Friday by default, or custom ranges if preferences are set
interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

const getWorkWeekDateRanges = (
  workWeekStart: number = 1,
  workWeekEnd: number = 5,
  selectedDate: Date = new Date()
): WorkWeekDateRanges => {
  // Ensure selectedDate is a proper Date object
  const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
  
  // Use the selectedDate as the base date
  const today = dateObj;
  
  // Get current day of week and hour
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = today.getHours();
  
  // Check if we're at the end of the work week after 5:00pm (17:00)
  // If it's workWeekEnd day and after 5pm, we'll treat it as weekend mode
  const isAfterWorkWeekEnd = (currentDayOfWeek === workWeekEnd && currentHour >= 17) || 
                           currentDayOfWeek > workWeekEnd || 
                           currentDayOfWeek < workWeekStart;
  
  // Always calculate first day of current week
  const currentWeekStart = new Date(today);
  
  // Calculate days to add/subtract to get to start day
  let diffToStart;
  
  if (isAfterWorkWeekEnd) {
    // If in weekend mode, current week becomes next week
    diffToStart = (workWeekStart + 7 - currentDayOfWeek) % 7;
    if (diffToStart === 0) diffToStart = 7; // If today is the start day of next week, we need to move forward a full week
  } else {
    // Normal mode - calculate days to subtract to get to current week's start
    diffToStart = ((currentDayOfWeek - workWeekStart) + 7) % 7;
    currentWeekStart.setDate(today.getDate() - diffToStart);
  }
  
  // Apply the calculated difference
  currentWeekStart.setDate(today.getDate() + (isAfterWorkWeekEnd ? diffToStart : -diffToStart));
  
  // Set time to start of day
  currentWeekStart.setHours(0, 0, 0, 0);
  
  // Calculate end of current week
  const currentWeekEnd = new Date(currentWeekStart);
  const daysToAdd = workWeekEnd < workWeekStart ? 
    (7 - workWeekStart + workWeekEnd) : // Wrap around to next week if end day is before start day
    (workWeekEnd - workWeekStart);     // Otherwise calculate normally
  
  currentWeekEnd.setDate(currentWeekStart.getDate() + daysToAdd);
  currentWeekEnd.setHours(17, 0, 0, 0); // End at 5:00pm on the end day
  
  // Calculate next week (start of next week)
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);
  
  // Calculate end of next week
  const nextWeekEnd = new Date(currentWeekEnd);
  nextWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  
  return {
    currentWeekStart,
    currentWeekEnd,
    nextWeekStart,
    nextWeekEnd
  };
};

import PersistentView, { usePersistentViewContext } from '../components/PersistentView';

// Add a custom hook for persisting scraper status
const usePersistentScrapeStatus = (key: string, initialStatus: {
  status: string;
  progress: number;
  message: string;
}) => {
  // Initialize state from sessionStorage or use the initialStatus
  const [status, setStatus] = useState<{
    status: string;
    progress: number;
    message: string;
  }>(() => {
    const storedStatus = sessionStorage.getItem(`scrape-status-${key}`);
    return storedStatus ? JSON.parse(storedStatus) : initialStatus;
  });

  // Update sessionStorage when status changes
  useEffect(() => {
    sessionStorage.setItem(`scrape-status-${key}`, JSON.stringify(status));
  }, [status, key]);

  return [status, setStatus] as const;
};

// Simplified Home component to just render PersistentView wrapper
const Home: React.FC = () => {
  return (
    <PersistentView id="home-dashboard" persistScrollPosition={true}>
      <HomeContent />
    </PersistentView>
  );
};

export default Home;

// HomeContent component uses the persistence context
const HomeContent = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { dispenserData, loadDispenserData } = useDispenserData();
  
  // Get the context from PersistentView
  const { createState, createDateState } = usePersistentViewContext();
  
  // State for managing work orders and loading - don't persist these
  const [workOrdersData, setWorkOrdersData] = useState<{workOrders: WorkOrder[], metadata: any}>({
    workOrders: [],
    metadata: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state that should persist - use createState
  const [activeView, setActiveView] = createState<ViewType>('activeView', 'weekly');
  const [activeFilter, setActiveFilter] = createState<StoreFilter>('activeFilter', 'all');
  const [searchQuery, setSearchQuery] = createState<string>('searchQuery', '');
  
  // Calendar view state
  const today = new Date();
  const [currentMonth, setCurrentMonth] = createState<number>('currentMonth', today.getMonth());
  const [currentYear, setCurrentYear] = createState<number>('currentYear', today.getFullYear());
  
  // Work orders data state - don't persist these as they're loaded from API
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>(workOrdersData.workOrders as WorkOrder[]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = createState<string>('selectedTab', 'all');
  const [searchTerm, setSearchTerm] = createState<string>('searchTerm', '');
  const [countsByCategory, setCountsByCategory] = useState<{[key: string]: number}>({});
  
  // State for modals and dispenser operations - transient states, don't persist
  const [clearingDispenserId, setClearingDispenserId] = useState<string | null>(null);
  const [reScrapeDispenserId, setReScrapeDispenserId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [logConsoleType, setLogConsoleType] = useState<'workOrder' | 'dispenser' | 'server'>('workOrder');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedVisitNumber, setSelectedVisitNumber] = useState<string>('');
  const [currentDispenserInfo, setCurrentDispenserInfo] = useState<string | null>(null);
  const [currentDispenserData, setCurrentDispenserData] = useState<any[]>([]);
  const [hasDispenserInfo, setHasDispenserInfo] = useState<boolean>(false);
  const [isDataRefreshing, setIsDataRefreshing] = useState<boolean>(false);
  const [showDispenserModal, setShowDispenserModal] = useState<boolean>(false);
  const [selectedDispensers, setSelectedDispensers] = useState<any[]>([]);
  
  // UI state - persist these across reloads
  const [favorites, setFavorites] = createState<string[]>('favorites', []);
  const [showWelcome, setShowWelcome] = createState<boolean>('showWelcome', true);
  const [isFullscreenMode, setIsFullscreenMode] = createState<boolean>('isFullscreenMode', false);
  const [chartType, setChartType] = createState<'pie' | 'bar'>('chartType', 'pie');
  const chartRef = useRef<HTMLDivElement>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');

  // Track if dispenser toast notification has been shown - already using sessionStorage
  const [dispenserToastShown, setDispenserToastShown] = useState(() => {
    return sessionStorage.getItem('dispenserToastShown') === 'true';
  });

  // New work week preferences state - persist these
  const [workWeekStart, setWorkWeekStart] = createState<number>('workWeekStart', 1); // 1 = Monday
  const [workWeekEnd, setWorkWeekEnd] = createState<number>('workWeekEnd', 5);   // 5 = Friday
  const [showWorkWeekSettings, setShowWorkWeekSettings] = useState<boolean>(false);
  const [recentScrapedOrders, setRecentScrapedOrders] = useState<string[]>([]);
  
  // Sort order references
  const [sortOrder, setSortOrder] = createState<'asc' | 'desc'>('sortOrder', 'asc');
  const [sortField, setSortField] = createState<'date' | 'customer'>('sortField', 'date');
  
  // Expandable panel state
  const [expandedPanels, setExpandedPanels] = createState<Record<string, boolean>>('expandedPanels', {});
  
  // Add state to track which sections are expanded in the compact view
  const [expandedSections, setExpandedSections] = createState<Record<string, boolean>>('expandedSections', {});
  
  // Work orders state
  const [selectedMarketArea, setSelectedMarketArea] = createState<string>('selectedMarketArea', 'all');
  const [storeFilter, setStoreFilter] = createState<StoreFilter>('storeFilter', 'all');
  
  // Date calculation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workWeekDateRanges, setWorkWeekDateRanges] = useState<WorkWeekDateRanges>(() => 
    getWorkWeekDateRanges(workWeekStart, workWeekEnd)
  );

  // Use the date-specific hook for better date handling
  const [selectedDate, setSelectedDate] = createDateState('selectedDate', new Date());
  const [previousDate, setPreviousDate] = createDateState('previousDate', new Date());
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());

  // Add a state to track which dispensers have expanded technical details
  const [expandedTechnicalDetails, setExpandedTechnicalDetails] = createState<number[]>('expandedTechnicalDetails', []);
  
  // Flag to prevent duplicate distribution logs
  const [distributionLogged, setDistributionLogged] = useState<boolean>(false);

  // Add a state to track if the 5pm transition has been processed for the current window
  const [transitionProcessed, setTransitionProcessed] = useState<boolean>(false);
  // Add a state to track whether the initial weekend mode has been shown
  const [initialWeekendModeShown, setInitialWeekendModeShown] = useState<boolean>(() => {
    // Check if we've already shown this notification today
    const today = new Date().toDateString();
    const lastShownDay = localStorage.getItem('weekendModeNotificationDate');
    return lastShownDay === today;
  });

  // Helper function to mark the weekend mode notification as shown
  const markWeekendModeAsShown = () => {
    const today = new Date().toDateString();
    localStorage.setItem('weekendModeNotificationDate', today);
    setInitialWeekendModeShown(true);
  };

  // Log data for debugging
  useEffect(() => {
    console.log('Loaded work orders:', workOrdersData.workOrders);
    console.log('Orders with dispenser data:', (workOrdersData.workOrders as WorkOrder[]).filter(order => order.dispensers && order.dispensers.length > 0).length);
    // Check for first work order with dispenser data
    const orderWithDispenser = (workOrdersData.workOrders as WorkOrder[]).find(order => order.dispensers && order.dispensers.length > 0);
    if (orderWithDispenser) {
      console.log('Sample dispenser data:', orderWithDispenser.dispensers);
    } else {
      console.warn('No orders found with dispenser data');
    }
  }, [workOrdersData.workOrders]);

  // Load the data from API
  const loadData = async (forceRefreshDispenser = false) => {
    setIsLoading(true);
    try {
      // Check if there's an active user
      const activeUserId = localStorage.getItem('activeUserId');
      
      if (!activeUserId) {
        console.warn('No active user found, cannot load work orders');
        addToast('warning', 'Please select a user to view work orders', 5000);
        setIsLoading(false);
        return;
      }
      
      console.log(`Loading work orders for user: ${activeUserId}`);
      
      // Load work orders from the API
      const workOrdersResponse = await getWorkOrders();
      
      // Verify the response contains the work orders
      if (workOrdersResponse.error) {
        console.error('Error loading work orders:', workOrdersResponse.error);
        addToast('error', `Failed to load work orders: ${workOrdersResponse.error}`, 5000);
        setIsLoading(false);
        return;
      }
      
      setWorkOrdersData(workOrdersResponse);
      
      console.log('Loaded work orders:', workOrdersResponse.workOrders);
      
      // Continue with existing dispenser data loading
      if (forceRefreshDispenser) {
        await loadDispenserData(true);
      } else {
        await loadDispenserData();
      }
      
      // Use local data instead of API call
      if (process.env.NODE_ENV === 'development') {
        console.log(`Using local work orders data: ${workOrdersResponse.workOrders.length} items`);
      }
      
      // Check if there's dispenser data from the context
      if (dispenserData && dispenserData.dispenserData) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Merging with dispenser data from context: ${Object.keys(dispenserData.dispenserData).length} items`);
        }
        
        // Debug: log some sample IDs to check matching
        const dispenserDataIds = Object.keys(dispenserData.dispenserData);
        console.log("Dispenser data IDs (first 5):", dispenserDataIds.slice(0, 5));
        
        if (workOrdersResponse.workOrders.length > 0) {
          console.log("Work order IDs sample (first 5):", workOrdersResponse.workOrders.slice(0, 5).map((o: WorkOrder) => o.id));
        }
        
        const mergedOrders = [...workOrdersResponse.workOrders].map(order => {
          // Get ID and remove any leading/trailing whitespace
          const orderId = order.id?.trim();
          // Use optional chaining to safely access workOrderId which might not exist on all orders
          const workOrderId = (order as any)?.workOrderId?.trim() || '';
          
          // Try to match by multiple ID formats (with and without W- prefix)
          let orderDispenserData = null;
          
          // First try direct match
          if (orderId && dispenserData.dispenserData[orderId]) {
            orderDispenserData = dispenserData.dispenserData[orderId];
          } 
          // Try with W- prefix if not found
          else if (orderId && !orderId.startsWith('W-') && dispenserData.dispenserData[`W-${orderId}`]) {
            orderDispenserData = dispenserData.dispenserData[`W-${orderId}`];
          }
          // Try without W- prefix if not found
          else if (orderId && orderId.startsWith('W-') && dispenserData.dispenserData[orderId.substring(2)]) {
            orderDispenserData = dispenserData.dispenserData[orderId.substring(2)];
          }
          // Try workOrderId as fallback
          else if (workOrderId && dispenserData.dispenserData[workOrderId]) {
            orderDispenserData = dispenserData.dispenserData[workOrderId];
          }
          // Try with W- prefix on workOrderId
          else if (workOrderId && !workOrderId.startsWith('W-') && dispenserData.dispenserData[`W-${workOrderId}`]) {
            orderDispenserData = dispenserData.dispenserData[`W-${workOrderId}`];
          }
          
          if (orderDispenserData && orderDispenserData.dispensers && orderDispenserData.dispensers.length > 0) {
            // Log success for debugging
            console.log(`Found dispenser data for order ${orderId || workOrderId}`);
            return {
              ...order,
              dispensers: orderDispenserData.dispensers
            };
          }
          
          return order;
        });
        
        // Update work orders with merged data - use type assertion to handle the expanded properties
        setWorkOrdersData({
          workOrders: mergedOrders as any, // Use type assertion to avoid TypeScript errors
          metadata: workOrdersResponse.metadata
        });
        
        // Also update filtered work orders to reflect the changes
        // Use direct assignment to bypass TypeScript errors
        const filteredWithDispensers = filteredWorkOrders.map(prevOrder => {
          // Find matching order in mergedOrders
          const matchingOrder = mergedOrders.find(o => o.id === prevOrder.id);
          if (matchingOrder && (matchingOrder as any).dispensers) {
            // Return the updated order with dispensers
            return {
              ...prevOrder,
              dispensers: (matchingOrder as any).dispensers
            };
          }
          return prevOrder;
        });
        
        // Force cast to WorkOrder[] and set the filtered work orders
        setFilteredWorkOrders(filteredWithDispensers as unknown as WorkOrder[]);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Loaded main data with ${mergedOrders.length} work orders`);
          // Debug: Log count of work orders with dispensers
          const withDispensers = mergedOrders.filter(order => 
            (order as any).dispensers && (order as any).dispensers.length > 0
          ).length;
          console.log(`Work orders with dispenser data: ${withDispensers}`);
          
          // Log sample of merged order with dispenser data
          const sampleWithDispenser = mergedOrders.find(order => 
            (order as any).dispensers && (order as any).dispensers.length > 0
          );
          if (sampleWithDispenser) {
            console.log('Sample of merged order with dispensers:', sampleWithDispenser);
          }
        }
      } else {
        console.warn('No dispenser data available from context');
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      addToast('error', `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Use the loaded work orders throughout the component
  const { workOrders, metadata } = workOrdersData;

  // Load data on component mount
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Add this new effect to reload data when the active user changes
  useEffect(() => {
    // Get the active user ID from localStorage
    const activeUserId = localStorage.getItem('activeUserId');
    
    // Create a function to reload data when active user changes
    const handleUserChange = () => {
      console.log('Active user changed, reloading work orders data');
      loadData(true); // Force refresh including dispensers
    };
    
    // Add event listener for storage changes (for user switching)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'activeUserId' && event.newValue !== activeUserId) {
        console.log(`User changed from ${activeUserId} to ${event.newValue}`);
        handleUserChange();
      }
    };
    
    // Initial load of data
    loadData();
    
    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for a custom event that could be dispatched after user switching
    window.addEventListener('user-switched', handleUserChange);
    
    // Cleanup listeners
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-switched', handleUserChange);
    };
  }, []);
  
  // Listen for fossa-data-updated events to refresh data automatically
  useEffect(() => {
    const handleDataUpdated = (event: CustomEvent) => {
      // Extract details from the event
      const detail = event.detail || {};
      const isSilent = detail.silent || false;
      const isAutomatic = detail.automatic || false;
      
      console.log(`Data update event detected: ${isAutomatic ? 'Automatic' : 'Manual'} ${isSilent ? '(Silent)' : ''}`);
      
      // Define a silent data reload function
      const silentReload = async () => {
        try {
          // Load new dispenser data without setting loading state
          await loadDispenserData(true, false);
          
          // Load work order data without triggering loading indicators
          try {
            // Use the API endpoint which handles user-specific data retrieval
            const response = await fetch('/api/work-orders', {
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
              cache: 'no-store'
            });
            
            if (!response.ok) {
              throw new Error(`Failed to load data: ${response.status}`);
            }
            
            // Check if content type is JSON before parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error(`Invalid content type: ${contentType}. Expected JSON.`);
            }
            
            const data = await response.json();
            
            // Merge dispenser data with work orders
            const merged = data.workOrders.map((order: any) => {
              // Check if dispenser data exists in context
              if (dispenserData?.dispenserData && dispenserData.dispenserData[order.id]) {
                const dispenserInfo = dispenserData.dispenserData[order.id] as any;
                return {
                  ...order,
                  dispensers: dispenserInfo.dispensers || []
                };
              }
              return order;
            });
            
            // Update state without triggering loading indicators
            setWorkOrdersData({
              workOrders: merged,
              metadata: data.metadata || {}
            });
            
            if (!isSilent) {
              // Only show toast for non-silent updates
              addToast('success', `${isAutomatic ? 'Scheduled' : 'Manual'} data refresh completed`);
            }
            
            console.log('Work orders silently refreshed:', merged.length);
          } catch (error) {
            console.error('Error during silent data refresh:', error);
          }
        } catch (error) {
          console.error('Error during silent data refresh:', error);
        }
      };
      
      // Execute the silent reload
      silentReload();
    };

    // Add event listener
    window.addEventListener('fossa-data-updated', handleDataUpdated as EventListener);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('fossa-data-updated', handleDataUpdated as EventListener);
    };
  }, [dispenserData, loadDispenserData, addToast]);

  // Update filtered work orders whenever workOrders or filters change
  useEffect(() => {
    // Filter work orders based on searchTerm and selectedTab
    let filtered = [...workOrders];
    
    if (searchTerm) {
      filtered = filtered.filter(order => {
        const customerName = order.customer?.name?.toLowerCase() || '';
        const storeNumber = order.customer?.storeNumber?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return customerName.includes(search) || storeNumber.includes(search);
      });
    }
    
    if (selectedTab !== 'all') {
      filtered = filtered.filter(order => {
        const storeType = getStoreTypeForFiltering(order);
        return storeType === selectedTab;
      });
    }
    
    // Ensure filtered is properly typed as WorkOrder[]
    const typedFiltered: WorkOrder[] = filtered as WorkOrder[];
    setFilteredWorkOrders(typedFiltered);
    
  }, [workOrders, searchTerm, selectedTab]);

  // Separate useEffect for toast notifications
  useEffect(() => {
    // Only show toast if it hasn't been shown yet during this session
    if (!dispenserToastShown && !isLoading && filteredWorkOrders.length > 0) {
      const ordersWithDispensers = filteredWorkOrders.filter(
        (order) => order.dispensers && order.dispensers.length > 0
      ).length;
      
      if (ordersWithDispensers > 0) {
        addToast('success', `Loaded ${ordersWithDispensers} work orders with dispenser information`);
      } else {
        addToast('warning', 'No dispenser information found for any work orders');
      }
      
      // Mark as shown in session storage to prevent repeated notifications
      sessionStorage.setItem('dispenserToastShown', 'true');
      setDispenserToastShown(true);
    }
  }, [isLoading, filteredWorkOrders, dispenserToastShown, addToast]);

  // Auto-hide welcome message
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  // Process instructions from work order
  const processInstructions = (instructions: string) => {
    if (!instructions) return '';
    
    // Replace line breaks with spaces
    let processedText = instructions.replace(/\n/g, ' ');
    
    // Remove any HTML tags
    processedText = processedText.replace(/<[^>]*>/g, '');
    
    // Get the store type
    const order = workOrders.find(o => o.instructions === instructions);
    const customerName = order?.customer?.name?.toLowerCase() || '';
    
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
    
    // Trim to reasonable length
    if (processedText.length > 150) {
      return processedText.substring(0, 147) + '...';
    }
    
    return processedText;
  };

  // The calculateStoreDistribution function for use with the weekly views
  const calculateStoreDistribution = (orders: any[]) => {
    // Get date ranges using the helper function
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    
    // Use the helper function to calculate distribution
    return calculateDistribution(
      orders,
      dateRanges.currentWeekStart,
      dateRanges.currentWeekEnd,
      dateRanges.nextWeekStart,
      dateRanges.nextWeekEnd
    );
  };
  
  // Helper function to calculate distribution using provided date ranges
  const calculateDistribution = (
    orders: any[], 
    currentWeekStart: Date, 
    currentWeekEnd: Date, 
    nextWeekStart: Date, 
    nextWeekEnd: Date
  ) => {
    const result = {
      currentWeek: {} as Record<string, number>,
      nextWeek: {} as Record<string, number>,
      total: 0
    };
    
    orders.forEach(order => {
      // Check for visits in different formats
      const visitDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || null;
      
      if (!visitDate) return;
      
      // Make sure we have a proper Date object
      const visitDateTime = new Date(visitDate);
      if (isNaN(visitDateTime.getTime())) return; // Skip if invalid date
      
      // Determine store type
      const storeType = getStoreTypeForFiltering(order);
      
      // Count in total
      result.total++;
      
      // Check which week this visit falls into
      if (visitDateTime >= currentWeekStart && visitDateTime <= currentWeekEnd) {
        // Current week
        if (!result.currentWeek[storeType]) {
          result.currentWeek[storeType] = 0;
        }
        result.currentWeek[storeType]++;
      } 
      else if (visitDateTime >= nextWeekStart && visitDateTime <= nextWeekEnd) {
        // Next week
        if (!result.nextWeek[storeType]) {
          result.nextWeek[storeType] = 0;
        }
        result.nextWeek[storeType]++;
      }
    });
    
    // Only log in development and only once
    if (process.env.NODE_ENV === 'development' && !distributionLogged) {
      console.log(`Current week: ${currentWeekStart.toDateString()} to ${currentWeekEnd.toDateString()}`);
      console.log(`Next week: ${nextWeekStart.toDateString()} to ${nextWeekEnd.toDateString()}`);
      console.log('Store distribution:', { currentWeek: result.currentWeek, nextWeek: result.nextWeek, total: result.total });
      // Set a flag to prevent duplicate logs
      setDistributionLogged(true);
    }
    
    return result;
  };

  // Update the renderDashboardHeader to use a different visualization
  const renderDashboardHeader = () => {
    if (isLoading) {
      return <SkeletonDashboardStats />;
    }

    const storeDistribution = calculateStoreDistribution(workOrders);
    
    const getStoreColor = (storeType: string) => {
      switch (storeType) {
        case '7-eleven': return { 
          bg: 'bg-red-500', 
          text: 'text-red-700',
          border: 'border-red-200', 
          dark: 'dark:border-red-800 dark:text-red-300',
          icon: '🏪',
          gradient: 'from-green-500 to-green-700'
        };
        case 'circle-k': return { 
          bg: 'bg-amber-500', 
          text: 'text-amber-700',
          border: 'border-amber-200',
          dark: 'dark:border-amber-800 dark:text-amber-300',
          icon: '⭕',
          gradient: 'from-orange-500 to-orange-700'
        };
        case 'wawa': return { 
          bg: 'bg-indigo-500', 
          text: 'text-indigo-700',
          border: 'border-indigo-200',
          dark: 'dark:border-indigo-800 dark:text-indigo-300',
          icon: '🦆',
          gradient: 'from-purple-500 to-purple-700'
        };
        case 'other': return { 
          bg: 'bg-blue-500', 
          text: 'text-blue-700',
          border: 'border-blue-200',
          dark: 'dark:border-blue-800 dark:text-blue-300',
          icon: '🏢',
          gradient: 'from-blue-500 to-blue-700'
        };
        default: return { 
          bg: 'bg-gray-500', 
          text: 'text-gray-700',
          border: 'border-gray-200',
          dark: 'dark:border-gray-800 dark:text-gray-300',
          icon: '🏬',
          gradient: 'from-gray-500 to-gray-700'
        };
      }
    };
    
    // Function to format date range for display
    const formatDateRange = (start: Date, end: Date) => {
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    };
    
    // Calculate date ranges
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    
    const currentWeekText = formatDateRange(dateRanges.currentWeekStart, dateRanges.currentWeekEnd);
    const nextWeekText = formatDateRange(dateRanges.nextWeekStart, dateRanges.nextWeekEnd);
    
    // Calculate totals for this week and next week
    const thisWeekTotal = Object.values(storeDistribution.currentWeek).reduce((a, b) => a + b, 0);
    const nextWeekTotal = Object.values(storeDistribution.nextWeek).reduce((a, b) => a + b, 0);
    
    // Calculate current and next week totals
    const currentDistribution = {
      current: thisWeekTotal,
      next: nextWeekTotal
    };
    
    // Convert store distribution to array for mapping
    const storeDistributionArray = Object.entries(storeDistribution.currentWeek)
      .map(([type, count]) => ({
        type,
        name: type === 'circle-k' ? 'Circle K' : 
              type === '7-eleven' ? '7-Eleven' : 
              type === 'wawa' ? 'Wawa' : 'Other',
        count
      }));

    return (
      <div className="mb-6 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Overview card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 bg-gradient-to-br from-primary-400/20 to-primary-600/10 rounded-full blur-xl"></div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <FiPieChart className="text-primary-600 dark:text-primary-400" /> Dashboard Overview
            </h2>
            <div className="flex flex-col space-y-3 z-10 relative">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <FiActivity className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Current Week</span>
                  <div className="font-semibold text-gray-800 dark:text-white">{currentDistribution.current} Jobs</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <FiTrendingUp className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Next Week</span>
                  <div className="font-semibold text-gray-800 dark:text-white">{currentDistribution.next} Jobs</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <FiList className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total Jobs</span>
                  <div className="font-semibold text-gray-800 dark:text-white">{filteredWorkOrders.length} Jobs Total</div>
                </div>
              </div>
            </div>
          </div>

          {/* Store distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-48 h-48 -mt-16 -mr-16 bg-gradient-to-br from-blue-400/20 to-blue-600/10 rounded-full blur-xl pointer-events-none"></div>
            
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <FiBarChart2 className="text-primary-600 dark:text-primary-400" /> 
              Store Distribution
            </h2>
            
            {/* Better adaptive layout based on store count */}
            {storeDistributionArray.length > 0 && (
              <div className={`relative z-10 ${
                // For larger counts, use flex with wrap to fill space more effectively
                storeDistributionArray.length >= 3 ? 'flex flex-wrap justify-center gap-3' : 
                // For 1-2 stores, use grid with better spacing and larger elements
                `grid gap-4 mx-auto ${
                  storeDistributionArray.length === 1 ? 'grid-cols-1 max-w-sm' : 
                  // For exactly 2 stores, make them fill more space vertically
                  'grid-cols-2 w-full'
                }`
              }`}>
                {storeDistributionArray.map((store) => {
                  const storeStyle = getStoreStyles(store.type);
                  
                  return (
                    <div 
                      key={store.type}
                      className={`relative rounded-xl bg-gray-50 dark:bg-gray-700/70 ${
                        // For 2 stores, make cards taller with more vertical presence
                        storeDistributionArray.length === 2 ? 'min-h-[100px]' :
                        // For flex layout (3+ stores), set flexible width
                        storeDistributionArray.length >= 3 ? 'flex-1 min-w-[180px] max-w-[240px]' : ''
                      }`}
                    >
                      {/* Color indicator bar at top of card */}
                      <div className={`h-2 w-full rounded-t-xl ${storeStyle.dot}`}></div>
                      
                      {/* For 1-2 stores, use centered column layout with larger elements */}
                      {storeDistributionArray.length <= 2 ? (
                        <div className="p-4 flex flex-col items-center justify-center h-full">
                          {/* Store name with larger text */}
                          <span className={`font-medium mb-3 text-base ${storeStyle.text}`}>
                            {store.name}
                          </span>
                          
                          {/* Larger count badge */}
                          <div className={`px-4 py-2 rounded-full text-base font-medium ${storeStyle.count}`}>
                            {store.count}
                          </div>
                        </div>
                      ) : (
                        // Standard horizontal layout for 3+ stores
                        <div className="p-3 flex items-center justify-between">
                          {/* Store name - prevent wrapping with whitespace-nowrap */}
                          <span className={`text-sm font-medium whitespace-nowrap ${storeStyle.text}`}>
                            {store.name}
                          </span>
                          
                          {/* Count badge */}
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ml-2 ${storeStyle.count}`}>
                            {store.count}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* No stores case */}
            {storeDistributionArray.length === 0 && (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <FiBarChart2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No store data available</p>
              </div>
            )}
          </div>

          {/* Date range navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <FiCalendar className="text-primary-600 dark:text-primary-400" /> Date Range
            </h2>
            
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">Current Week</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatDateRange(workWeekDates.currentWeekStart, workWeekDates.currentWeekEnd)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 dark:text-gray-400">Next Week</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatDateRange(workWeekDates.nextWeekStart, workWeekDates.nextWeekEnd)}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between mt-4 gap-2">
              <button
                onClick={() => {
                  // Get current week's start date and subtract 7 days
                  const newDate = new Date(workWeekDates.currentWeekStart);
                  newDate.setDate(newDate.getDate() - 7);
                  setSelectedDate(newDate);
                  setRefreshTimestamp(Date.now());
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <FiArrowUp className="transform rotate-270" /> Previous
              </button>
              
              <button
                onClick={goToCurrentWeek}
                className="flex-1 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-800/40 text-primary-700 dark:text-primary-300 font-medium py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-1"
              >
                <FiClock /> Today
              </button>
              
              <button
                onClick={() => {
                  // Get current week's start date and add 7 days
                  const newDate = new Date(workWeekDates.currentWeekStart);
                  newDate.setDate(newDate.getDate() + 7);
                  setSelectedDate(newDate);
                  setRefreshTimestamp(Date.now());
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-1"
              >
                Next <FiArrowUp className="transform rotate-90" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Data Tools Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 mb-6 transition-all duration-300 hover:shadow-xl">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <FiDatabase className="text-primary-600 dark:text-primary-400" /> Data Tools
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Data Timestamps */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <FiClock className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Last Updated</span>
                  <div className="font-medium text-gray-800 dark:text-white">
                    <LastScrapedTime />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <FiCalendar className="text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Next Update</span>
                  <div className="font-medium text-gray-800 dark:text-white">
                    <NextScrapeTime />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Work Order Scraping */}
            <div className="flex flex-col space-y-3">
              <h3 className="text-base font-medium text-gray-800 dark:text-white flex items-center gap-1.5">
                <FiFileText className="text-primary-500" /> Work Orders
              </h3>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    {isWorkOrderScraping ? (
                      <>
                        <div className="h-2.5 w-2.5 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Scraping in progress</span>
                      </>
                    ) : (
                      workOrderStatus.status === 'completed' ? (
                        <>
                          <div className="h-2.5 w-2.5 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">Ready</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2.5 w-2.5 bg-gray-400 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Idle</span>
                        </>
                      )
                    )}
                  </div>
                  
                  {isWorkOrderScraping && (
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-1">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${workOrderStatus.progress}%` }}></div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {workOrderStatus.message || "Click the button to update work order data"}
                  </div>
                </div>
                
                <button
                  onClick={handleScrapeWorkOrders}
                  disabled={isWorkOrderScraping || isDispenserScraping}
                  className={`ml-4 py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap
                    ${isWorkOrderScraping || isDispenserScraping 
                      ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed' 
                      : 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 transition-colors'
                    }`}
                >
                  {isWorkOrderScraping 
                    ? <><FiRefreshCw className="animate-spin" /> Scraping...</>
                    : <><FiRefreshCw /> Update Data</>
                  }
                </button>
              </div>
            </div>
            
            {/* Dispenser Scraping */}
            <div className="flex flex-col space-y-3">
              <h3 className="text-base font-medium text-gray-800 dark:text-white flex items-center gap-1.5">
                <GiGasPump className="text-primary-500" /> Dispensers
              </h3>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    {isDispenserScraping ? (
                      <>
                        <div className="h-2.5 w-2.5 bg-amber-500 rounded-full animate-pulse mr-2"></div>
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Scraping in progress</span>
                      </>
                    ) : (
                      dispenserStatus.status === 'completed' ? (
                        <>
                          <div className="h-2.5 w-2.5 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">Ready</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2.5 w-2.5 bg-gray-400 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Idle</span>
                        </>
                      )
                    )}
                  </div>
                  
                  {isDispenserScraping && (
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-1">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${dispenserStatus.progress}%` }}></div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {dispenserStatus.message || "Click the button to update dispenser data"}
                  </div>
                </div>
                
                <button
                  onClick={handleScrapeDispenserData}
                  disabled={isWorkOrderScraping || isDispenserScraping}
                  className={`ml-4 py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap
                    ${isWorkOrderScraping || isDispenserScraping 
                      ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed' 
                      : 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 transition-colors'
                    }`}
                >
                  {isDispenserScraping 
                    ? <><FiRefreshCw className="animate-spin" /> Scraping...</>
                    : <><FiRefreshCw /> Update Data</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add a new function to organize work orders by date within each time period
  const organizeWorkOrdersByDate = (orders: WorkOrder[]) => {
    // Group orders by their date
    const byDate: Record<string, WorkOrder[]> = {};
    
    orders.forEach(order => {
      const visitDate = order.visits?.nextVisit?.date ||
                        order.nextVisitDate ||
                        order.visitDate ||
                        order.date;
      
      if (!visitDate) return;
      
      // Format the date as a string key
      const dateKey = new Date(visitDate).toLocaleDateString();
      
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      
      byDate[dateKey].push(order);
    });
    
    // Convert to array of date groups, sorted by date
    return Object.entries(byDate)
      .sort(([dateKeyA], [dateKeyB]) => {
        return new Date(dateKeyA).getTime() - new Date(dateKeyB).getTime();
      })
      .map(([dateKey, orders]) => ({
        date: dateKey,
        orders
      }));
  };

  // Update the renderJobRow function with improved instructions display
  const renderJobRow = (order: any, dateGroupClass?: string) => {
    // Get meter calibration quantity (renamed to getDispenserQuantity for consistency)
    const getDispenserQuantity = (order: any) => {
      const meterCalibration = order.services.find((s: any) => s.type === "Meter Calibration");
      return meterCalibration ? meterCalibration.quantity : 0;
    };

    // Get store display name
    const getDisplayName = (order: any) => {
      if (!order || !order.customer) return 'Unknown';
      let displayName = order.customer.name;
      if (order.customer.storeNumber) {
        const storeNumberClean = order.customer.storeNumber.replace(/#/g, '');
        displayName += ` #${storeNumberClean}`;
      }
      return displayName;
    };

    // Determine store type and apply appropriate styling
    const storeType = getStoreTypeForFiltering(order);
    const visitId = extractVisitId(order);
    const dispenserQty = getDispenserQuantity(order);
    const hasDispenserData = order.dispensers && order.dispensers.length > 0;
    const hasNextVisit = order.visits && order.visits.nextVisit && order.visits.nextVisit.date;
    const nextVisitDate = hasNextVisit ? new Date(order.visits.nextVisit.date) : null;
    const formattedVisitDate = nextVisitDate ? nextVisitDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No visit scheduled';

    // Process instructions safely
    const instructions = order.instructions ? processInstructions(order.instructions) : '';

    // Check if this order is a favorite
    const isFavorite = favorites.includes(order.id.toString());

    // Get store styling
    const storeStyle = getStoreStyles(storeType);

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
              {getDisplayName(order)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            {hasNextVisit && (
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5 mr-2">
                  <FiCalendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Visit Date</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">{formattedVisitDate}</div>
                </div>
              </div>
            )}

            {dispenserQty > 0 && (
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5 mr-2">
                  <GiGasPump className={`h-4 w-4 ${storeStyle.text}`} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Equipment</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {dispenserQty} {dispenserQty === 1 ? 'Dispenser' : 'Dispensers'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions with improved visibility */}
          {instructions && (
            <div className={`mt-2 rounded p-3 border ${storeStyle.cardBg} border-gray-200 dark:border-gray-700`}>
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 mt-0.5">
                  <FiInfo className={`h-4 w-4 ${storeStyle.text}`} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 hover:line-clamp-none transition-all duration-200">
                  {instructions}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons - Grouped on the right */}
          <div className="mt-4 flex items-center justify-end"> 
            {/* Group View, Clear, Rescrape buttons together */}
            <div className="flex items-center space-x-2"> 
              {/* Open Visit URL Button */}
              {order.visits?.nextVisit?.url && (
                <button
                  className="p-2 text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-green-500 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Construct the full URL if it's relative
                    const url = order.visits.nextVisit.url;
                    const fullUrl = url.startsWith('http') ? url : `https://app.workfossa.com${url}`;
                    // Open the URL with auto-login
                    openWorkFossaWithLogin(fullUrl);
                  }}
                  title="Open Visit URL"
                >
                  <FiExternalLink className="h-5 w-5" />
                </button>
              )}
            
              {/* View Dispensers Icon Button */}
              <button
                className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors ${
                  hasDispenserData
                    ? storeStyle.text + ' hover:' + storeStyle.text
                    : 'text-gray-400 dark:text-gray-500 cursor-not-allowed' // Indicate no data
                }`}
                onClick={(e) => hasDispenserData && handleViewDispenserData(order, e)} // Only clickable if data exists
                disabled={!hasDispenserData}
                title={hasDispenserData ? "View dispenser information" : "No dispenser information available"}
              >
                <GiGasPump className="h-5 w-5" />
              </button>

              {/* Clear Data Icon Button */}
              <button
                className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 transition-colors"
                onClick={(e) => handleClearDispenserData(order.id, e)}
                disabled={!!clearingDispenserId}
                title="Clear Dispenser Data"
              >
                {clearingDispenserId === order.id ? (
                  <FiRefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <FiTrash2 className="h-5 w-5" />
                )}
              </button>

              {/* Force Rescrape Icon Button */}
              <button
                className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
                onClick={(e) => handleForceRescrapeDispenserData(order.id, e)}
                disabled={!!reScrapeDispenserId}
                title="Force Rescrape"
              >
                {reScrapeDispenserId === order.id ? (
                  <FiRefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to extract visit ID
  const extractVisitId = (order: any) => {
    if (!order) return 'Unknown';
    return order.workOrderId || order.id || 'Unknown';
  };
  
  // Helper function to extract visit number from URL
  const extractVisitNumber = (order: any): string => {
    if (!order || !order.visits?.nextVisit?.url) return 'N/A';
    
    // Visit URLs typically have format: /app/work/123456/visits/125361/
    const matches = order.visits.nextVisit.url.match(/\/visits\/(\d+)/);
    return matches && matches[1] ? matches[1] : 'N/A';
  };
  
  // Toggle favorite status for work orders
  const toggleFavorite = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(orderId)) {
      setFavorites(favorites.filter(id => id !== orderId));
      addToast('info', 'Removed from favorites');
    } else {
      setFavorites([...favorites, orderId]);
      addToast('success', 'Added to favorites');
    }
  };
  
  // Handler for viewing dispenser data
  const handleViewDispenserData = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Set the selected order ID regardless of whether there's dispenser data
    setSelectedOrderId(order.id);
    
    // Extract and set the visit number
    const visitNum = extractVisitNumber(order);
    setSelectedVisitNumber(visitNum);
    
    console.log('View dispenser data for order:', order.id, 'Visit number:', visitNum, 'Has dispensers:', 
      order.dispensers && Array.isArray(order.dispensers) && order.dispensers.length > 0);
    
    if (order.dispensers) {
      console.log('Dispenser data:', order.dispensers);
    }
    
    // Check if there is dispenser data available
    if (order.dispensers && Array.isArray(order.dispensers) && order.dispensers.length > 0) {
      // Format dispenser data for the modal if needed
      const formattedDispensers = order.dispensers.map((dispenser: any) => {
        console.log('Processing dispenser:', dispenser);
        
        // Use original title without modifications - titles should be preserved exactly as in JSON
        const formattedTitle = dispenser.title || '';
        
        // Create a base dispenser object with proper type handling
        const formattedDispenser: Dispenser = {
          title: formattedTitle,
          serial: dispenser.serial || '',
          make: dispenser.make || '',
          model: dispenser.model || '',
          html: dispenser.html || '',
          fields: {} // Initialize fields as empty object
        };

        // Ensure fields is an object
        const sourceFields = dispenser.fields || {};
        
        // Create a strongly typed fields object
        const typedFields: {[key: string]: string} = {};
        
        // Copy fields from source, ensuring all values are strings
        Object.keys(sourceFields).forEach(key => {
          // Only add the field if the value is defined and can be converted to string
          if (sourceFields[key] !== undefined && sourceFields[key] !== null) {
            typedFields[key] = String(sourceFields[key]);
          }
        });
        
        // Assign the typed fields to the dispenser
        formattedDispenser.fields = typedFields;
        
        // Add properties from dispenser root if they don't exist in fields
        if (dispenser.grade && !typedFields['Grade']) {
          typedFields['Grade'] = String(dispenser.grade);
        }
        
        if (dispenser.nozzlesPerSide && !typedFields['Number of Nozzles (per side)']) {
          typedFields['Number of Nozzles (per side)'] = String(dispenser.nozzlesPerSide);
        }
        
        if (dispenser.meterType && !typedFields['Meter Type']) {
          typedFields['Meter Type'] = String(dispenser.meterType);
        }
        
        if (dispenser.standAloneCode && !typedFields['Stand Alone Code']) {
          typedFields['Stand Alone Code'] = String(dispenser.standAloneCode);
        }
        
        return formattedDispenser;
      });
      
      setSelectedDispensers(formattedDispensers);
      setShowDispenserModal(true);
      console.log('Showing dispenser modal with data:', formattedDispensers);
    } else {
      // If no data, still show the modal but with the empty state
      setSelectedDispensers([]);
      setShowDispenserModal(true);
      
      // Also show an alert for better user feedback
      setAlertMessage('No dispenser information available for this work order');
      setAlertType('info');
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
      
      console.log('No dispenser data found for order:', order.id);
    }
  };
  
  // Handler for clearing dispenser data
  const handleClearDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setClearingDispenserId(orderId);
      addToast('info', 'Clearing dispenser data...');
      
      // Call service to clear dispenser data
      await clearDispenserData(orderId);
      
      // Show success notification
      addToast('success', 'Dispenser data cleared successfully');
      
      // Force reload dispenser data to get fresh data from server
      await loadDispenserData(true);
      
      // Refresh the filtered work orders to reflect the changes
      setFilteredWorkOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === orderId) {
            // Remove dispensers from this specific order
            return {
              ...order,
              dispensers: []
            };
          }
          return order;
        });
      });
      
      // If the modal is currently showing dispensers for this order, clear the modal data as well
      if (selectedOrderId === orderId) {
        setSelectedDispensers([]);
        // Close the modal if it's open
        if (showDispenserModal) {
          setShowDispenserModal(false);
        }
      }
      
      setClearingDispenserId(null);
    } catch (error) {
      setClearingDispenserId(null);
      console.error('Error clearing dispenser data:', error);
      addToast('error', `Failed to clear dispenser data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Handler for forcing rescrape of dispenser data
  const handleForceRescrapeDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setReScrapeDispenserId(orderId);
      addToast('info', 'Starting dispenser data rescrape...');
      
      // Call service to rescrape dispenser data
      await forceRescrapeDispenserData(orderId);
      
      // Show success notification
      addToast('success', 'Dispenser data rescrape started successfully');
      
      // Set up polling to monitor the scrape status
      let pollingInterval: NodeJS.Timeout | null = null;
      
      const startPolling = () => {
        pollingInterval = setInterval(async () => {
          try {
            const currentStatus = await getDispenserScrapeStatus();
            console.log('Force rescrape status update:', {
              status: currentStatus.status,
              progress: currentStatus.progress,
              message: currentStatus.message
            });
            
            // Check if the status indicates completion
            if (currentStatus.progress === 100 || 
                currentStatus.status === 'completed' || 
                (currentStatus.message && 
                 (currentStatus.message.includes('complete') || 
                  currentStatus.message.includes('success') || 
                  currentStatus.message.includes('finished')))) {
              
              console.log('Detected completion state:', currentStatus);
              
              // Stop polling
              if (pollingInterval) {
                console.log('Clearing polling interval');
                clearInterval(pollingInterval);
                pollingInterval = null;
              }
              
              // Clear the rescrape indicator
              setReScrapeDispenserId(null);
              
              // Show success notification
              addToast('success', 'Equipment data collection completed successfully!');
              
              // Reload the page to show new data
              console.log('Scheduling page reload');
              window.location.reload();
            }
            
            // Check for error state
            if (currentStatus.status === 'error') {
              console.log('Detected error state, stopping polling');
              
              if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
              }
              
              setReScrapeDispenserId(null);
              addToast('error', `Error during dispenser data collection: ${currentStatus.error || 'Unknown error'}`);
            }
          } catch (error) {
            console.error('Error polling force rescrape status:', error);
            
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
            
            setReScrapeDispenserId(null);
            addToast('error', 'Failed to get status update for dispenser rescrape');
          }
        }, 1000);
      };
      
      // Start polling for updates
      startPolling();
    } catch (error) {
      setReScrapeDispenserId(null);
      console.error('Error rescraping dispenser data:', error);
      addToast('error', `Failed to rescrape dispenser data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper function to get store type for filtering
  const getStoreTypeForFiltering = (order: any): string => {
    if (!order || !order.customer) return 'other';
    
    const customerName = order.customer.name.toLowerCase();
    
    if (customerName.includes('7-eleven') || customerName.includes('speedway')) {
      return '7-eleven';
    } else if (customerName.includes('circle k')) {
      return 'circle-k';
    } else if (customerName.includes('wawa')) {
      return 'wawa';
    } else {
      return 'other';
    }
  };

  // Function to toggle technical details visibility for a dispenser
  const toggleTechnicalDetails = (index: number) => {
    setExpandedTechnicalDetails(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  // Update the filteredWorkOrders when filter changes
  useEffect(() => {
    if (!workOrders || workOrders.length === 0) {
      setFilteredWorkOrders([]);
      return;
    }

    let filtered = [...workOrders];
    
    // Apply store filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => {
        const storeType = getStoreTypeForFiltering(order);
        return storeType === activeFilter;
      });
    }
    
    // Apply search query if present
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => {
        // Search in customer name
        if (order.customer?.name && order.customer.name.toLowerCase().includes(query)) return true;
        
        // Search in order ID
        if (order.id && order.id.toString().toLowerCase().includes(query)) return true;
        
        // Search in instructions
        if (order.instructions && order.instructions.toLowerCase().includes(query)) return true;
        
        // Search in store number from customer
        if (order.customer?.storeNumber && order.customer.storeNumber.toLowerCase().includes(query)) return true;
        
        return false;
      });
      
      // Show toast with search results
      if (searchQuery.trim().length > 2) {
        if (filtered.length > 0) {
          addToast('info', `Found ${filtered.length} work order${filtered.length !== 1 ? 's' : ''} matching "${searchQuery.trim()}"`, 3000);
        } else {
          addToast('warning', `No work orders found matching "${searchQuery.trim()}"`, 3000);
        }
      }
    }
    
    // Explicitly cast to WorkOrder[] to satisfy TypeScript
    setFilteredWorkOrders(filtered as WorkOrder[]);
  }, [workOrders, activeFilter, searchQuery]);

  // Consistent store color palette
  const getStoreStyles = (storeType: string) => {
    switch (storeType.toLowerCase()) {
      case 'circle-k':
        return {
          name: 'Circle K',
          cardBorder: 'border-l-4 border-red-500',
          badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          headerBg: 'bg-red-50 dark:bg-red-900/20',
          cardBg: 'bg-red-50 dark:bg-red-900/20',
          text: 'text-red-700 dark:text-red-300',
          boxBg: 'bg-red-100 dark:bg-red-800/40',
          icon: '🏪',
          bg: 'bg-red-100 dark:bg-red-900/30',
          dot: 'bg-red-500 dark:bg-red-400',
          count: 'bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-300',
          gradient: 'from-red-500 to-red-700'
        };
      case '7-eleven':
        return {
          name: '7-Eleven',
          cardBorder: 'border-l-4 border-green-500',
          badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          headerBg: 'bg-green-50 dark:bg-green-900/20',
          cardBg: 'bg-green-50 dark:bg-green-900/20',
          text: 'text-green-700 dark:text-green-300',
          boxBg: 'bg-green-100 dark:bg-green-800/40',
          icon: '🏪',
          bg: 'bg-green-100 dark:bg-green-900/30', 
          dot: 'bg-green-500 dark:bg-green-400',
          count: 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-300',
          gradient: 'from-green-500 to-green-700'
        };
      case 'wawa':
        return {
          name: 'Wawa',
          cardBorder: 'border-l-4 border-amber-500',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          headerBg: 'bg-amber-50 dark:bg-amber-900/20',
          cardBg: 'bg-amber-50 dark:bg-amber-900/20',
          text: 'text-amber-700 dark:text-amber-300',
          boxBg: 'bg-amber-100 dark:bg-amber-800/40',
          icon: '🦆',
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          dot: 'bg-amber-500 dark:bg-amber-400',
          count: 'bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300',
          gradient: 'from-amber-500 to-amber-700'
        };
      default:
        return {
          name: 'Other',
          cardBorder: 'border-l-4 border-blue-500',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          headerBg: 'bg-blue-50 dark:bg-blue-900/20',
          cardBg: 'bg-blue-50 dark:bg-blue-900/20', 
          text: 'text-blue-700 dark:text-blue-300',
          boxBg: 'bg-blue-100 dark:bg-blue-800/40',
          icon: '🏢',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          dot: 'bg-blue-500 dark:bg-blue-400',
          count: 'bg-blue-200 dark:bg-blue-800/50 text-blue-800 dark:text-blue-300',
          gradient: 'from-blue-500 to-blue-700'
        };
    }
  };

  // Load filtered and grouped data when workOrders changes or when refreshTimestamp updates
  useEffect(() => {
    // Calculate date ranges using the selected date
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    
    // Get the distribution of store types
    const storeTypeDistribution = calculateStoreDistribution(filteredWorkOrders);
    
    // Fix type error - extract only the count properties that match the expected type
    const countsByType: {[key: string]: number} = {};
    if (storeTypeDistribution.total) {
      countsByType.total = storeTypeDistribution.total;
    }
    
    // Set the properly typed counts
    setCountsByCategory(countsByType);
    
    // Apply the current filter logic here directly instead of calling applyFilters
    // This section can be expanded with actual filtering logic if needed
    
  }, [workOrders, workWeekStart, workWeekEnd, activeFilter, searchQuery, refreshTimestamp, selectedDate]);

  // Add a function to reset to current week
  const goToCurrentWeek = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setRefreshTimestamp(Date.now());
    addToast('info', 'Showing current week schedule', 2000);
  };

  // Function to format date range for display
  const formatDateRange = (start: Date, end: Date) => {
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };
  
  // Add a useEffect to handle ESC key for exiting fullscreen mode
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreenMode) {
        setIsFullscreenMode(false);
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isFullscreenMode]);

  // Check on initial render if we're already after 5:00pm on work week end day
  useEffect(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    
    if (currentDayOfWeek === workWeekEnd && currentHour >= 17 && !initialWeekendModeShown) {
      // If we're loading after 5:00pm on work week end day, update the UI
      console.log("Page loaded after 5:00pm on work week end day - using weekend mode");
      
      // Force refresh the UI - the getWorkWeekDateRanges function will handle weekend mode
      setRefreshTimestamp(Date.now());
      
      // Show notification only once
      addToast('info', 'Weekend mode active - viewing next week\'s schedule', 5000);
      
      // Mark as shown to prevent repeated notifications
      markWeekendModeAsShown();
    }
  }, [workWeekEnd, setRefreshTimestamp, addToast, initialWeekendModeShown]);

  // Add a timer effect to check for work week transitions at 5:00pm
  useEffect(() => {
    // Function to check if we're at the end of work week after 5:00pm
    const checkForWorkWeekTransition = () => {
      const now = new Date();
      const currentDayOfWeek = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Check if we're at the work week end day and it's 5:00pm or later but before 5:05pm
      // This gives a small window to process the transition only once
      if (currentDayOfWeek === workWeekEnd && 
          currentHour === 17 && 
          currentMinute < 5) {
        // Only process the transition once per window
        if (!transitionProcessed) {
          console.log("Work week transition detected at 5:00pm - refreshing dashboard and updating selected date");

          // Force refresh the UI to update the week view using the current date
          // The getWorkWeekDateRanges function will automatically handle weekend mode
          setRefreshTimestamp(Date.now());
          
          // Optionally show a toast notification
          addToast('info', 'Switched to weekend mode - next week is now this week', 5000);

          // Mark transition as processed for this window
          setTransitionProcessed(true);
          
          // Also set the initial flag to prevent duplicate notifications
          markWeekendModeAsShown();
        }
      } else {
        // Only reset the flag when we're completely outside the transition window
        // This ensures we don't process the transition again during the same 5:00-5:05pm window
        if (currentDayOfWeek !== workWeekEnd || currentHour !== 17) {
          setTransitionProcessed(false);
        }
      }
    };
    
    // Run the check immediately when this effect runs
    checkForWorkWeekTransition();
    
    // Set up an interval to check every minute
    const intervalId = setInterval(checkForWorkWeekTransition, 60000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [workWeekEnd, addToast, setRefreshTimestamp, transitionProcessed, setTransitionProcessed, markWeekendModeAsShown]);

  // Function to group and sort work orders
  const groupAndSortWorkOrders = () => {
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    const grouped = {
      thisWeek: [] as WorkOrder[],
      nextWeek: [] as WorkOrder[],
      future: [] as WorkOrder[],
      past: [] as WorkOrder[],
      noDate: [] as WorkOrder[],
      current: [] as WorkOrder[],   // Added for new structure
      next: [] as WorkOrder[],      // Added for new structure
      other: [] as WorkOrder[]      // Added for new structure
    };

    filteredWorkOrders.forEach(order => {
      const visitDate = order.visits?.nextVisit?.date ||
                        order.nextVisitDate ||
                        order.visitDate ||
                        order.date;

      if (!visitDate) {
        grouped.noDate.push(order);
        return;
      }

      const orderDate = new Date(visitDate);

      if (isNaN(orderDate.getTime())) { // Check for invalid date
        grouped.noDate.push(order); // Add orders with invalid dates to noDate
        return;
      }

      if (orderDate >= dateRanges.currentWeekStart && orderDate <= dateRanges.currentWeekEnd) {
        grouped.thisWeek.push(order);
        grouped.current.push(order);  // Updated for new structure
      } else if (orderDate >= dateRanges.nextWeekStart && orderDate <= dateRanges.nextWeekEnd) {
        grouped.nextWeek.push(order);
        grouped.next.push(order);     // Updated for new structure
      } else if (orderDate > dateRanges.nextWeekEnd) {
        grouped.future.push(order);
        grouped.other.push(order);    // Updated for new structure
      } else {
        grouped.past.push(order);
        grouped.other.push(order);    // Updated for new structure
      }
    });

    const sortByDate = (a: WorkOrder, b: WorkOrder) => {
      const dateA = new Date(a.visits?.nextVisit?.date || a.nextVisitDate || a.visitDate || a.date || 0);
      const dateB = new Date(b.visits?.nextVisit?.date || b.nextVisitDate || b.visitDate || b.date || 0);
       // Handle potential invalid dates during sort
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateA.getTime() - dateB.getTime();
    };

    grouped.thisWeek.sort(sortByDate);
    grouped.nextWeek.sort(sortByDate);
    grouped.future.sort(sortByDate);
    grouped.past.sort(sortByDate);
    grouped.current.sort(sortByDate);  // Sort new structure
    grouped.next.sort(sortByDate);     // Sort new structure
    grouped.other.sort(sortByDate);    // Sort new structure

    return grouped;
  };

  // Type for the grouped work orders
  type GroupedWorkOrders = ReturnType<typeof groupAndSortWorkOrders>;

  // New function to render the grouped weekly sections based on passed data
  const renderWeeklySections = (grouped: GroupedWorkOrders) => {
    // Determine if the current view is the actual current week
    const now = new Date();
    const currentActualWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, now);
    const selectedWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    const isActualCurrentWeek = currentActualWeekRanges.currentWeekStart.getTime() === selectedWeekRanges.currentWeekStart.getTime();

    // Helper function to render a group of work orders with date headers
    const renderOrderGroup = (orders: WorkOrder[]) => {
      // We'll group orders by date in this function
      const ordersByDate = organizeWorkOrdersByDate(orders);
      
      // Function to format date for display
      const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        
        // Check if it's today or tomorrow
        if (date.toDateString() === today.toDateString()) {
          return 'Today - ' + date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        } else if (date.toDateString() === tomorrow.toDateString()) {
          return 'Tomorrow - ' + date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        } else {
          return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        }
      };
      
      return (
        <div>
          {ordersByDate.map((dateGroup) => (
            <div key={dateGroup.date} className="mb-6">
              <div className="flex items-center mb-3">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                  <FiCalendar className="mr-1 h-3.5 w-3.5" /> 
                  {formatDateHeader(dateGroup.date)}
                </h3>
                <div className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded">
                  {dateGroup.orders.length} job{dateGroup.orders.length !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="space-y-3">
                {dateGroup.orders.map((order) => renderJobRow(order))}
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="pb-8">
        {/* Current week section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex-shrink-0 h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <FiActivity className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Current Week
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDateRange(workWeekDates.currentWeekStart, workWeekDates.currentWeekEnd)}
              </p>
            </div>
            <div className="ml-auto">
              <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-1 rounded-full">
                {grouped.thisWeek.length} jobs
              </span>
            </div>
          </div>

          {grouped.thisWeek.length > 0 ? (
            <>
              {renderOrderGroup(grouped.thisWeek)}
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center border border-gray-200 dark:border-gray-700">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                <FiCalendar className="h-8 w-8 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No jobs scheduled</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                There are no jobs scheduled for the current week. Try changing the filters or checking next week.
              </p>
            </div>
          )}
        </div>

        {/* Next week section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex-shrink-0 h-10 w-10 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <FiTrendingUp className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Next Week
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDateRange(workWeekDates.nextWeekStart, workWeekDates.nextWeekEnd)}
              </p>
            </div>
            <div className="ml-auto">
              <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">
                {grouped.nextWeek.length} jobs
              </span>
            </div>
          </div>

          {grouped.nextWeek.length > 0 ? (
            <>
              {renderOrderGroup(grouped.nextWeek)}
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center border border-gray-200 dark:border-gray-700">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 mb-4">
                <FiCalendar className="h-8 w-8 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No jobs scheduled</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                There are no jobs scheduled for next week yet. Check back later or adjust your filters.
              </p>
            </div>
          )}
        </div>

        {/* Other dates section */}
        {grouped.other.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex-shrink-0 h-10 w-10 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <FiList className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Other Dates
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Jobs scheduled outside current and next week
                </p>
              </div>
              <div className="ml-auto">
                <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full">
                  {grouped.other.length} jobs
                </span>
              </div>
            </div>

            {renderOrderGroup(grouped.other)}
          </div>
        )}
      </div>
    );
  };

  // Calculate grouped work orders before the main return
  const groupedWorkOrders = groupAndSortWorkOrders();

  // Function to open WorkFossa website with active user's credentials
  const openWorkFossaWithLogin = async (targetUrl: string = 'https://app.workfossa.com') => {
    try {
      // Get active user ID
      const activeUserId = localStorage.getItem('activeUserId');
      
      if (!activeUserId) {
        throw new Error('No active user found. Please select a user first.');
      }
      
      // Fetch active user's credentials
      const response = await fetch(`/api/users/${activeUserId}/credentials`);
      
      if (!response.ok) {
        throw new Error('Failed to get active user credentials');
      }
      
      const credentials = await response.json();
      
      if (!credentials.email || !credentials.password) {
        throw new Error('Active user has incomplete credentials');
      }
      
      // Use the electron API to open the URL with the active user's credentials
      // @ts-ignore (electron is defined in the preload script)
      const result = await window.electron.openUrlWithActiveUser({
        url: targetUrl,
        email: credentials.email,
        password: credentials.password
      });
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to open WorkFossa');
      }
      
      // Show success toast
      addToast(
        'info',
        'WorkFossa has been opened with active user credentials'
      );
    } catch (error) {
      console.error('Error opening WorkFossa:', error);
      
      // Show error toast
      addToast(
        'error',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  };

  // Add workWeekDates state
  const [workWeekDates, setWorkWeekDates] = useState<WorkWeekDateRanges>(() => 
    getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate)
  );

  // Add status states for work orders and dispensers
  const [workOrderStatus, setWorkOrderStatus] = usePersistentScrapeStatus('workOrder', {
    status: 'idle',
    progress: 0,
    message: ''
  });

  const [dispenserStatus, setDispenserStatus] = usePersistentScrapeStatus('dispenser', {
    status: 'idle',
    progress: 0,
    message: ''
  });

  const [isWorkOrderScraping, setIsWorkOrderScraping] = useState(() => {
    const stored = sessionStorage.getItem('isWorkOrderScraping');
    return stored === 'true';
  });

  const [isDispenserScraping, setIsDispenserScraping] = useState(() => {
    const stored = sessionStorage.getItem('isDispenserScraping');
    return stored === 'true';
  });

  // Update sessionStorage when scraping status changes
  useEffect(() => {
    sessionStorage.setItem('isWorkOrderScraping', isWorkOrderScraping.toString());
  }, [isWorkOrderScraping]);

  useEffect(() => {
    sessionStorage.setItem('isDispenserScraping', isDispenserScraping.toString());
  }, [isDispenserScraping]);

  // Update workWeekDates when selectedDate changes
  useEffect(() => {
    setWorkWeekDates(getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate));
  }, [selectedDate, workWeekStart, workWeekEnd]);
  
  // Add handler functions for scraping
  const handleScrapeWorkOrders = async () => {
    try {
      setIsWorkOrderScraping(true);
      setWorkOrderStatus({
        status: 'processing',
        progress: 0,
        message: 'Starting work order data collection...'
      });
      
      // Use the scrapeService function instead of direct fetch
      await startScrapeJob();
      
      // Set a polling interval to check status
      const intervalId = setInterval(async () => {
        try {
          // Use the scrapeService function instead of direct fetch
          const status = await getScrapeStatus();
          setWorkOrderStatus(status);
          
          // If complete, stop polling and refresh data
          if (status.status === 'completed') {
            clearInterval(intervalId);
            setIsWorkOrderScraping(false);
            loadData(true); // Reload data with dispenser refresh
          }
        } catch (error) {
          console.error('Error checking scrape status:', error);
          clearInterval(intervalId);
          setIsWorkOrderScraping(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error starting work order scrape:', error);
      setIsWorkOrderScraping(false);
      addToast('error', `Failed to start work order scrape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleScrapeDispenserData = async () => {
    try {
      setIsDispenserScraping(true);
      setDispenserStatus({
        status: 'processing',
        progress: 0,
        message: 'Starting dispenser data collection...'
      });
      
      // Use the scrapeService function instead of direct fetch
      await startDispenserScrapeJob();
      
      // Set a polling interval to check status
      const intervalId = setInterval(async () => {
        try {
          // Use the scrapeService function instead of direct fetch
          const status = await getDispenserScrapeStatus();
          setDispenserStatus(status);
          
          // If complete, stop polling and refresh data
          if (status.status === 'completed') {
            clearInterval(intervalId);
            setIsDispenserScraping(false);
            loadData(true); // Reload data with dispenser refresh
          }
        } catch (error) {
          console.error('Error checking dispenser scrape status:', error);
          clearInterval(intervalId);
          setIsDispenserScraping(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error starting dispenser scrape:', error);
      setIsDispenserScraping(false);
      addToast('error', `Failed to start dispenser scrape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add polling for scrape status when component mounts if a scrape is already in progress
  useEffect(() => {
    // Check if there's a scrape in progress from session storage
    const workOrderScraping = sessionStorage.getItem('isWorkOrderScraping') === 'true';
    const dispenserScraping = sessionStorage.getItem('isDispenserScraping') === 'true';
    
    if (workOrderScraping) {
      // Create polling for work order scrape status
      const intervalId = setInterval(async () => {
        try {
          // Use the scrapeService function instead of direct fetch
          const status = await getScrapeStatus();
          setWorkOrderStatus(status);
          
          // If complete, stop polling and refresh data
          if (status.status === 'completed') {
            clearInterval(intervalId);
            setIsWorkOrderScraping(false);
            loadData(true); // Reload data with dispenser refresh
          }
        } catch (error) {
          console.error('Error checking scrape status:', error);
          clearInterval(intervalId);
          setIsWorkOrderScraping(false);
        }
      }, 1000);
      
      return () => clearInterval(intervalId);
    }
    
    if (dispenserScraping) {
      // Create polling for dispenser scrape status
      const intervalId = setInterval(async () => {
        try {
          // Use the scrapeService function
          const status = await getDispenserScrapeStatus();
          setDispenserStatus(status);
          
          // If complete, stop polling and refresh data
          if (status.status === 'completed') {
            clearInterval(intervalId);
            setIsDispenserScraping(false);
            loadData(true); // Reload data with dispenser refresh
          }
        } catch (error) {
          console.error('Error checking dispenser scrape status:', error);
          clearInterval(intervalId);
          setIsDispenserScraping(false);
        }
      }, 1000);
      
      return () => clearInterval(intervalId);
    }
  }, []);

  // Slightly adjust container padding for better responsiveness
  return (
    // Remove flex-col and any padding to eliminate the gap next to the sidebar
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
      {/* Dashboard header with stats */}
      <div className="px-1 sm:px-0">
        {renderDashboardHeader()}
      </div>

      {/* Main toolbar */}
      {/* Updated background, padding, and spacing */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
        {/* Top section - view toggles, update times and filter */}
        <div className="flex flex-wrap items-center justify-between p-4 border-b border-gray-700/60 dark:border-gray-800/60 gap-3">
          <div className="flex items-center gap-2 relative z-10"> {/* Decreased gap for mobile */}
            <button
              className={`px-3 py-2 rounded-md flex items-center gap-1 transition-all text-sm sm:text-base sm:px-4 sm:py-2.5 sm:gap-2 ${
                activeView === 'weekly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-700/70 dark:bg-gray-800/70 text-gray-300 hover:bg-gray-600 dark:hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => setActiveView('weekly')}
            >
              <FiList className="h-4 w-4" />
              <span>List</span>
            </button>

            <button
              className={`px-3 py-2 rounded-md flex items-center gap-1 transition-all text-sm sm:text-base sm:px-4 sm:py-2.5 sm:gap-2 ${
                activeView === 'calendar'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-700/70 dark:bg-gray-800/70 text-gray-300 hover:bg-gray-600 dark:hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => setActiveView('calendar')}
            >
              <FiCalendar className="h-4 w-4" />
              <span>Calendar</span>
            </button>
            
            <button
              className={`px-3 py-2 rounded-md flex items-center gap-1 transition-all text-sm sm:text-base sm:px-4 sm:py-2.5 sm:gap-2 ${
                activeView === 'compact'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-700/70 dark:bg-gray-800/70 text-gray-300 hover:bg-gray-600 dark:hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => setActiveView('compact')}
            >
              <FiGrid className="h-4 w-4" />
              <span>Compact</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Dark mode toggle button */}
            <button
              className="p-2.5 text-gray-300 hover:text-yellow-400 hover:bg-gray-700/50 dark:hover:bg-gray-800/50 rounded-md focus:outline-none transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              onClick={() => {
                const toggleTheme = document.querySelector('#theme-toggle') as HTMLButtonElement;
                if (toggleTheme) toggleTheme.click();
              }}
            >
              {isDarkMode ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Bottom section - search and action buttons */}
        <div className="flex flex-wrap items-center gap-4 p-4 relative"> {/* Added flex-wrap for mobile */}
          {/* Added subtle background gradients */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 z-0"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 z-0"></div>
          
          <div className="relative flex-1 z-10 min-w-[200px] w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 bg-gray-700/70 dark:bg-gray-800/70 border border-gray-600 dark:border-gray-700 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors shadow-inner"
              placeholder="Search store name, ID, instructions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 z-10 flex-wrap justify-center sm:justify-start">
            <button
              className="p-2.5 text-gray-300 hover:text-blue-400 bg-gray-700/70 dark:bg-gray-800/70 hover:bg-gray-600 dark:hover:bg-gray-700 rounded-lg focus:outline-none transition-colors"
              title="Refresh Data"
              onClick={() => {
                setIsDataRefreshing(true);
                addToast('info', 'Refreshing data...', 2000);
                loadData(true).then(() => {
                  setIsDataRefreshing(false);
                  addToast('success', 'Data refreshed successfully', 3000);
                }).catch(error => {
                  setIsDataRefreshing(false);
                  addToast('error', `Failed to refresh data: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
                });
              }}
            >
              <FiRefreshCw className={`h-5 w-5 ${isDataRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              className="p-2.5 text-gray-300 hover:text-blue-400 bg-gray-700/70 dark:bg-gray-800/70 hover:bg-gray-600 dark:hover:bg-gray-700 rounded-lg focus:outline-none transition-colors"
              title="View Logs"
              onClick={() => {
                setShowLogsModal(true);
                setLogConsoleType('workOrder');
              }}
            >
              <FiFileText className="h-5 w-5" />
            </button>

            <button
              className="p-2.5 text-gray-300 hover:text-blue-400 bg-gray-700/70 dark:bg-gray-800/70 hover:bg-gray-600 dark:hover:bg-gray-700 rounded-lg focus:outline-none transition-colors"
              title="Open WorkFossa Website"
              onClick={() => openWorkFossaWithLogin()}
            >
              <FiGlobe className="h-5 w-5" />
            </button>

            <button
              className="p-2.5 text-gray-300 hover:text-blue-400 bg-gray-700/70 dark:bg-gray-800/70 hover:bg-gray-600 dark:hover:bg-gray-700 rounded-lg focus:outline-none transition-colors"
              title={isFullscreenMode ? "Exit Fullscreen" : "Enter Fullscreen"}
              onClick={() => setIsFullscreenMode(!isFullscreenMode)}
            >
              {isFullscreenMode ? <FiMinimize className="h-5 w-5" /> : <FiMaximize className="h-5 w-5" />}
            </button>

            {/* Work Week Settings Button */}
            <button
              onClick={() => setShowWorkWeekSettings(!showWorkWeekSettings)}
              className={`p-2.5 rounded-lg focus:outline-none transition-colors flex items-center ${showWorkWeekSettings ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-blue-400 bg-gray-700/70 dark:bg-gray-800/70 hover:bg-gray-600 dark:hover:bg-gray-700'}`}
              aria-expanded={showWorkWeekSettings}
              aria-controls="work-week-settings-panel"
              title="Work Week Settings"
            >
              <FiSettings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Work Week Settings Panel - Redesigned for better appearance */}
      {showWorkWeekSettings && (
         <div
           id="work-week-settings-panel"
           className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 border border-gray-200 dark:border-gray-700 shadow-md transition-all duration-300 ease-in-out"
         >
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
               <FiSettings className="mr-2 text-blue-500" />
               Work Week Preferences
             </h3>
             <button 
               onClick={() => setShowWorkWeekSettings(false)}
               className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
             >
               <FiX className="h-5 w-5" />
             </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start of Work Week</label>
                <select
                  value={workWeekStart}
                  onChange={(e) => setWorkWeekStart(Number(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 px-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End of Work Week</label>
                <select
                  value={workWeekEnd}
                  onChange={(e) => setWorkWeekEnd(Number(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 px-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
            </div>
            <div className="mt-5 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">About Work Week Settings</h4>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                These settings define which days are considered part of your work week for planning purposes.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                <span className="font-medium">Weekend Mode:</span> The dashboard automatically displays the <strong>next</strong> work week's schedule after 5:00 PM on the selected 'End of Work Week' day.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <span className="font-medium">Job Filtering:</span> The weekly dashboard views will primarily focus on jobs scheduled between your selected start and end days.
              </p>
            </div>
          </div>
        )}

      {/* Main Content Area Wrapper - Improve mobile responsiveness with padding */}
      <div className={`flex-grow px-1 sm:px-0 ${isFullscreenMode ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4 overflow-auto' : ''}`}>
        {isFullscreenMode && (
          <div className="absolute top-2 right-2 z-50">
            <button
              className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-lg"
              onClick={() => setIsFullscreenMode(false)}
              title="Exit Fullscreen"
            >
              <FiMinimize className="h-5 w-5" />
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4">
            <SkeletonDashboardStats />
            <SkeletonJobsList />
          </div>
        ) : (
          <>
            {/* Weekly view */}
            {activeView === 'weekly' && (
              <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"> {/* Added background and container styling */}
                {/* Always-visible navigation bar */}
                <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-xl"> {/* Updated styling */}
                  <div className="flex items-center">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center"> {/* Updated font weight and text color */}
                      <FiCalendar className="mr-2 text-blue-500" />
                      <span className="text-lg"> {/* Changed to text-lg for better readability */} 
                        Week of {getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate).currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </h3>
                    {/* Add visit count badge if viewing the actual current week */}
                    {(() => {
                      const now = new Date();
                      const currentActualWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, now);
                      const selectedWeekRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
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
                  <div className="flex items-center gap-2"> {/* Changed to gap for consistent spacing */}
                    <button 
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                      onClick={() => {
                        // Navigate to previous week
                        const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
                        const newStart = new Date(dateRanges.currentWeekStart);
                        newStart.setDate(newStart.getDate() - 7);
                        
                        // Update state to trigger re-render
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
                        // Navigate to next week
                        const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
                        const newStart = new Date(dateRanges.currentWeekStart);
                        newStart.setDate(newStart.getDate() + 7);
                        
                        // Update state to trigger re-render
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
                
                {/* Apply active filter indicator and filter buttons */}
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center flex-wrap gap-1 sm:gap-2"> {/* Adjusted gap for mobile */}
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
                
                {/* Weekly sections rendered with improved styling */}
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {renderWeeklySections(groupedWorkOrders)}
                </div>
              </div>
            )}

            {/* Calendar view */}
            {activeView === 'calendar' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (currentMonth === 0) {
                          setCurrentMonth(11);
                          setCurrentYear(currentYear - 1);
                        } else {
                          setCurrentMonth(currentMonth - 1);
                        }
                      }}
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        setCurrentMonth(today.getMonth());
                        setCurrentYear(today.getFullYear());
                      }}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium"
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => {
                        if (currentMonth === 11) {
                          setCurrentMonth(0);
                          setCurrentYear(currentYear + 1);
                        } else {
                          setCurrentMonth(currentMonth + 1);
                        }
                      }}
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Calendar grid */}
                <div className="p-4">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                      <div key={i} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const days = [];
                      const date = new Date(currentYear, currentMonth, 1);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      // Add empty cells for days before the first day of the month
                      const firstDayOfMonth = date.getDay();
                      for (let i = 0; i < firstDayOfMonth; i++) {
                        days.push(
                          <div key={`empty-${i}`} className="h-24 p-1 border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-md"></div>
                        );
                      }
                      
                      // Add cells for each day of the month
                      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                      
                      for (let i = 1; i <= daysInMonth; i++) {
                        const currentDate = new Date(currentYear, currentMonth, i);
                        const isToday = currentDate.getTime() === today.getTime();
                        
                        // Count events on this day
                        const eventsOnDay = filteredWorkOrders.filter(order => {
                          const visitDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
                          if (!visitDate) return false;
                          
                          const orderDate = new Date(visitDate);
                          return orderDate.getDate() === i && 
                                 orderDate.getMonth() === currentMonth && 
                                 orderDate.getFullYear() === currentYear;
                        });
                        
                        days.push(
                          <div 
                            key={`day-${i}`} 
                            className={`h-24 p-1 border rounded-md transition-colors ${
                              isToday 
                                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className={`text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center ${
                                isToday 
                                  ? 'bg-blue-500 text-white' 
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {i}
                              </span>
                              
                              {eventsOnDay.length > 0 && (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  {eventsOnDay.length}
                                </span>
                              )}
                            </div>
                            
                            {/* Show up to 2 events, with a "+more" indicator if needed */}
                            <div className="mt-1 space-y-1 overflow-hidden" style={{ maxHeight: "77px" }}>
                              {eventsOnDay.slice(0, 2).map((order, idx) => {
                                const storeType = getStoreTypeForFiltering(order);
                                const storeStyle = getStoreStyles(storeType);
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className={`text-xs p-1 rounded truncate ${storeStyle.badge}`}
                                    title={order.customer?.name || 'Unknown store'}
                                  >
                                    {order.customer?.name || 'Unknown store'}
                                  </div>
                                );
                              })}
                              
                              {eventsOnDay.length > 2 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                  +{eventsOnDay.length - 2} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Compact view (calendar-style weekly view) */}
            {activeView === 'compact' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header with navigation */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
                      <FiCalendar className="mr-2 text-primary-500" />
                      <span className="text-lg"> 
                        Week of {workWeekDates.currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      onClick={() => {
                        // Navigate to previous week
                        const newDate = new Date(workWeekDates.currentWeekStart);
                        newDate.setDate(newDate.getDate() - 7);
                        setSelectedDate(newDate);
                        setRefreshTimestamp(Date.now());
                      }}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToCurrentWeek}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium"
                    >
                      Today
                    </button>
                    <button 
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      onClick={() => {
                        // Navigate to next week
                        const newDate = new Date(workWeekDates.currentWeekStart);
                        newDate.setDate(newDate.getDate() + 7);
                        setSelectedDate(newDate);
                        setRefreshTimestamp(Date.now());
                      }}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Week grid */}
                <div className="grid grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700">
                  {Array.from({ length: 5 }).map((_, dayIndex) => {
                    const currentDate = new Date(workWeekDates.currentWeekStart);
                    currentDate.setDate(currentDate.getDate() + dayIndex);
                    
                    const isToday = currentDate.toDateString() === new Date().toDateString();
                    const jobs = groupedWorkOrders.thisWeek.filter(job => {
                      const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.date;
                      if (!jobDate) return false;
                      
                      const date = new Date(jobDate);
                      return date.toDateString() === currentDate.toDateString();
                    });
                    
                    // Remove the job limit to show all cards
                    return (
                      <div key={dayIndex} className={`flex flex-col ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                        {/* Date header */}
                        <div className={`p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${isToday ? 'bg-blue-100/50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {currentDate.toLocaleDateString(undefined, { weekday: 'short' })}
                            </span>
                            <span className={`font-semibold ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {jobs.length > 0 && (
                            <span className={`text-xs px-2 py-1 rounded-full ${isToday ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                              {jobs.length}
                            </span>
                          )}
                        </div>
                        
                        {/* Job cards - show all cards with more compact styling */}
                        <div className="flex-1 p-4 space-y-2 overflow-visible">
                          {jobs.map(job => {
                            const storeType = getStoreTypeForFiltering(job);
                            const storeStyle = getStoreStyles(storeType);
                            
                            return (
                              <div 
                                key={job.id}
                                className={`p-2 rounded-lg border ${storeStyle.cardBorder} ${storeStyle.cardBg} hover:shadow-sm transition-all duration-200 cursor-pointer`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                                    {job.customer?.name || 'Unknown Store'}
                                  </div>
                                  <div className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${storeStyle.badge}`}>
                                    #{extractVisitNumber(job)}
                                  </div>
                                </div>
                                
                                {job.services && job.services.some(s => s.type === "Meter Calibration") && (
                                  <div className="flex items-center mt-0.5">
                                    <GiGasPump className="h-2.5 w-2.5 text-gray-500 dark:text-gray-400 mr-1" />
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                      {job.services.find(s => s.type === "Meter Calibration")?.quantity || 0}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Next week section */}
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <FiCalendar className="mr-2 text-primary-500" />
                      <span>Next Week ({workWeekDates.nextWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {workWeekDates.nextWeekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</span>
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                        {groupedWorkOrders.nextWeek.length}
                      </span>
                    </h4>
                  </div>
                  
                  {/* Next week day-by-day grid - Matching the current week layout */}
                  <div className="grid grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700">
                    {Array.from({ length: 5 }).map((_, dayIndex) => {
                      const currentDate = new Date(workWeekDates.nextWeekStart);
                      currentDate.setDate(currentDate.getDate() + dayIndex);
                      
                      const jobs = groupedWorkOrders.nextWeek.filter(job => {
                        const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.date;
                        if (!jobDate) return false;
                        
                        const date = new Date(jobDate);
                        return date.toDateString() === currentDate.toDateString();
                      });
                      
                      // Create a unique section key for this day
                      const sectionKey = `next-week-day-${dayIndex}`;
                      
                      // Determine if this section is expanded
                      const isExpanded = expandedSections[sectionKey] || false;
                      
                      // Default to showing 3 jobs unless expanded
                      const visibleJobs = isExpanded ? jobs : jobs.slice(0, 3);
                      const hiddenJobCount = jobs.length - visibleJobs.length;
                      
                      return (
                        <div key={dayIndex} className="flex flex-col">
                          {/* Date header */}
                          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {currentDate.toLocaleDateString(undefined, { weekday: 'short' })}
                              </span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            {jobs.length > 0 && (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                {jobs.length}
                              </span>
                            )}
                          </div>
                          
                          {/* Job cards */}
                          <div className="flex-1 p-4 space-y-2 overflow-visible">
                            {visibleJobs.map(job => {
                              const storeType = getStoreTypeForFiltering(job);
                              const storeStyle = getStoreStyles(storeType);
                              
                              return (
                                <div 
                                  key={job.id}
                                  className={`p-2 rounded-lg border ${storeStyle.cardBorder} ${storeStyle.cardBg} hover:shadow-sm transition-all duration-200 cursor-pointer`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                                      {job.customer?.name || 'Unknown Store'}
                                    </div>
                                    <div className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${storeStyle.badge}`}>
                                      #{extractVisitNumber(job)}
                                    </div>
                                  </div>
                                  
                                  {job.services && job.services.some(s => s.type === "Meter Calibration") && (
                                    <div className="flex items-center mt-0.5">
                                      <GiGasPump className="h-2.5 w-2.5 text-gray-500 dark:text-gray-400 mr-1" />
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {job.services.find(s => s.type === "Meter Calibration")?.quantity || 0}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* Toggle button for hidden jobs */}
                            {hiddenJobCount > 0 && (
                              <button 
                                onClick={() => {
                                  setExpandedSections(prev => ({
                                    ...prev,
                                    [sectionKey]: true
                                  }));
                                }}
                                className="w-full mt-1 py-1 px-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                              >
                                +{hiddenJobCount} more job{hiddenJobCount !== 1 ? 's' : ''}
                              </button>
                            )}
                            
                            {/* Show less button when expanded */}
                            {isExpanded && jobs.length > 3 && (
                              <button 
                                onClick={() => {
                                  setExpandedSections(prev => ({
                                    ...prev,
                                    [sectionKey]: false
                                  }));
                                }}
                                className="w-full mt-1 py-1 px-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                              >
                                Show less
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Future and past jobs section - only show if there are any */}
                {groupedWorkOrders.other.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <FiCalendar className="mr-2 text-primary-500" />
                        <span>Other Dates ({groupedWorkOrders.other.length})</span>
                      </h4>
                    </div>
                    
                    <div className="p-4">
                      {/* Check if the other jobs section is expanded */}
                      {expandedSections['other-jobs'] ? (
                        <div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {groupedWorkOrders.other.map(job => {
                              const storeType = getStoreTypeForFiltering(job);
                              const storeStyle = getStoreStyles(storeType);
                              const visitDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.date;
                              const formattedDate = visitDate ? new Date(visitDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date';
                              
                              return (
                                <div 
                                  key={job.id}
                                  className={`p-2 rounded-lg border ${storeStyle.cardBorder} ${storeStyle.cardBg} hover:shadow-md transition-all duration-200 cursor-pointer`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                                      {job.customer?.name || 'Unknown Store'}
                                    </div>
                                    <div className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${storeStyle.badge}`}>
                                      #{extractVisitNumber(job)}
                                    </div>
                                  </div>
                                  
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                                    <FiCalendar className="h-2.5 w-2.5 mr-1" />
                                    {formattedDate}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Show less button */}
                            <div className="col-span-full">
                              <button 
                                onClick={() => {
                                  setExpandedSections(prev => ({
                                    ...prev,
                                    'other-jobs': false
                                  }));
                                }}
                                className="w-full mt-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                              >
                                Show less
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Show limited jobs when collapsed
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {groupedWorkOrders.other.slice(0, 4).map(job => {
                            const storeType = getStoreTypeForFiltering(job);
                            const storeStyle = getStoreStyles(storeType);
                            const visitDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.date;
                            const formattedDate = visitDate ? new Date(visitDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date';
                            
                            return (
                              <div 
                                key={job.id}
                                className={`p-2 rounded-lg border ${storeStyle.cardBorder} ${storeStyle.cardBg} hover:shadow-md transition-all duration-200 cursor-pointer`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                                    {job.customer?.name || 'Unknown Store'}
                                  </div>
                                  <div className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${storeStyle.badge}`}>
                                    #{extractVisitNumber(job)}
                                  </div>
                                </div>
                                
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                                  <FiCalendar className="h-2.5 w-2.5 mr-1" />
                                  {formattedDate}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Show more button */}
                          {groupedWorkOrders.other.length > 4 && (
                            <div className="col-span-full">
                              <button 
                                onClick={() => {
                                  setExpandedSections(prev => ({
                                    ...prev,
                                    'other-jobs': true
                                  }));
                                }}
                                className="w-full mt-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                              >
                                +{groupedWorkOrders.other.length - 4} more jobs
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Display the logs modal if enabled */}
      </div>

      {/* Modals remain outside the main content flow but within the component return */}
      {showDispenserModal && (
        <DispenserModal
          isOpen={showDispenserModal}
          onClose={() => setShowDispenserModal(false)}
          dispensers={selectedDispensers}
          orderId={selectedOrderId}
          visitNumber={selectedVisitNumber}
        />
      )}
    </div>
  );
}; // End of HomeContent component


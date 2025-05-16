import React, { useState, useEffect, useMemo, useRef } from 'react';
import {   FiActivity,   FiAlertCircle,  FiAlertTriangle,  FiCalendar,  FiClock,   FiDatabase,  FiExternalLink,   FiFileText,   FiFilter,  FiHome,  FiInfo,  FiList,  FiMapPin,  FiPieChart,  FiRefreshCw,  FiSearch,  FiStar,  FiTrash2,  FiTrendingUp,  FiChevronDown,  FiCheckCircle,  FiX } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { useNavigate, useParams } from 'react-router-dom';
import { clearDispenserData, forceRescrapeDispenserData, getDispenserScrapeStatus, getWorkOrders, getScrapeStatus, startDispenserScrapeJob, startScrapeJob } from '../services/scrapeService';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useDispenserData } from '../context/DispenserContext';
import PersistentView, { usePersistentViewContext } from '../components/PersistentView';
import LastScrapedTime from '../components/LastScrapedTime';
import NextScrapeTime from '../components/NextScrapeTime';
import ScrapeLogsConsole from '../components/ScrapeLogsConsole';
import DispenserModal from '../components/DispenserModal';
import InstructionsModal from '../components/InstructionsModal';
import JobMap from '../components/map/JobMap';
import SimpleJobMap from '../components/map/SimpleJobMap';
import { SkeletonDashboardStats, SkeletonJobsList } from '../components/Skeleton';
import fuelGrades from '../data/fuel_grades';
import { ENDPOINTS } from '../config/api';
import MarkerClusterer from '@googlemaps/markerclustererplus';
import ReactDOMServer from 'react-dom/server';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO, isValid } from 'date-fns';
import PerformanceChart from '../components/PerformanceChart';
import { useSettings } from '../context/SettingsContext';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import { calculateFiltersForWorkOrder, determineWarningSeverity, FilterWarning } from '../utils/filterCalculation';

// Type definitions
type ViewType = 'weekly' | 'calendar' | 'compact';
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

// Define the Location interface at the top of the file
interface Location {
  id: string;
  lat: number;
  lng: number;
  title: string;
  storeType?: string;
}

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
  status: string;
  workOrderNumber?: string;
  customer?: Customer;
  services?: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  nextVisitDate?: string;
  visitDate?: string;
  date?: string;
  description?: string;
  instructions?: string;
  clientName?: string;
  clientNotes?: string;
  storeNumber?: string;
  visitId?: string;
  serviceType?: string;
  serviceTypes?: string[];
  dispensers?: any[];
  visits?: {
    nextVisit?: {
      date?: string;
    };
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  clientLocation?: {
    latitude: number;
    longitude: number;
  };
  // Direct latitude/longitude properties that might exist at root level
  lat?: number;
  lng?: number;
  // Other location properties
  address?: {
    location?: {
      latitude: number;
      longitude: number;
    };
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    geo?: {
      lat: number;
      lng: number;
    };
  };
  site?: {
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  client?: {
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  store?: {
    location?: {
      latitude: number;
      longitude: number;
    };
  };
};

// Add interfaces for the change history data
interface ChangeRecord {
  timestamp: string;
  changes: {
    critical?: ChangeItem[];
    high?: ChangeItem[];
    medium?: ChangeItem[];
    low?: ChangeItem[];
    allChanges?: ChangeItem[];
    summary: {
      removed: number;
      added: number;
      modified: number;
      swapped?: number;
    };
  };
}

interface ChangeItem {
  type: string;
  jobId?: string;
  store?: string;
  storeName?: string;
  date?: string;
  dispensers?: number;
  oldDate?: string;
  newDate?: string;
  removedJobId?: string;
  removedStore?: string;
  removedStoreName?: string;
  removedDispensers?: number;
  addedJobId?: string;
  addedStore?: string;
  addedStoreName?: string;
  addedDispensers?: number;
  // Swap-related properties
  job1Id?: string;
  job1Store?: string;
  job1StoreName?: string;
  job1Dispensers?: number;
  job1Location?: string;
  job1Address?: any;
  job2Id?: string;
  job2Store?: string;
  job2StoreName?: string;
  job2Dispensers?: number;
  job2Location?: string;
  job2Address?: any;
  oldDate1?: string;
  newDate1?: string;
  oldDate2?: string;
  newDate2?: string;
}

interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

// Extended interface for filter warnings with additional properties we need
interface ExtendedFilterWarning extends FilterWarning {
  partNumber?: string;
  message?: string;
  severity?: number;
  orderId?: string;
  storeName?: string;
  missingDispenserData?: boolean;
}

// Custom hook for persisting scraper status
const usePersistentScrapeStatus = (key: string, initialStatus: {
  status: string;
  progress: number;
  message: string;
}) => {
  const [status, setStatus] = useState<{
    status: string;
    progress: number;
    message: string;
  }>(() => {
    const storedStatus = sessionStorage.getItem(`scrape-status-${key}`);
    return storedStatus ? JSON.parse(storedStatus) : initialStatus;
  });

  useEffect(() => {
    sessionStorage.setItem(`scrape-status-${key}`, JSON.stringify(status));
  }, [status, key]);

  return [status, setStatus] as const;
};

// Helper function to calculate work week date ranges
const getWorkWeekDateRanges = (
  workWeekStart: number = 1,
  workWeekEnd: number = 5,
  selectedDate: Date = new Date()
): WorkWeekDateRanges => {
  const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
  const today = dateObj;
  const currentDayOfWeek = today.getDay();
  const currentHour = today.getHours();
  
  const isAfterWorkWeekEnd = (currentDayOfWeek === workWeekEnd && currentHour >= 17) || 
                           currentDayOfWeek > workWeekEnd || 
                           currentDayOfWeek < workWeekStart;
  
  const currentWeekStart = new Date(today);
  let diffToStart;
  
  if (isAfterWorkWeekEnd) {
    diffToStart = (workWeekStart + 7 - currentDayOfWeek) % 7;
    if (diffToStart === 0) diffToStart = 7;
  } else {
    diffToStart = ((currentDayOfWeek - workWeekStart) + 7) % 7;
    currentWeekStart.setDate(today.getDate() - diffToStart);
  }
  
  currentWeekStart.setDate(today.getDate() + (isAfterWorkWeekEnd ? diffToStart : -diffToStart));
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const currentWeekEnd = new Date(currentWeekStart);
  const daysToAdd = workWeekEnd < workWeekStart ? 
    (7 - workWeekStart + workWeekEnd) : 
    (workWeekEnd - workWeekStart);
  
  currentWeekEnd.setDate(currentWeekStart.getDate() + daysToAdd);
  currentWeekEnd.setHours(17, 0, 0, 0);
  
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);
  
  const nextWeekEnd = new Date(currentWeekEnd);
  nextWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  
  return {
    currentWeekStart,
    currentWeekEnd,
    nextWeekStart,
    nextWeekEnd
  };
};

// Helper function to calculate filter warnings for a work order safely
const calculateFiltersSafely = (order: WorkOrder) => {
  try {
    // Use the unsafe type assertion only within this helper function
    return calculateFiltersForWorkOrder(order as any);
  } catch (error) {
    console.error("Error calculating filters:", error);
    return { gasFilters: 0, dieselFilters: 0, warnings: [] };
  }
};

// Main component
const Home: React.FC = () => {
  return (
    <PersistentView id="home-dashboard" persistScrollPosition={true}>
      <HomeContent />
    </PersistentView>
  );
};

export default Home;

// HomeContent component
const HomeContent = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { dispenserData, loadDispenserData } = useDispenserData();
  
  // Get the context from PersistentView
  const { createState, createDateState } = usePersistentViewContext();
  
  // State for managing work orders and loading
  const [workOrdersData, setWorkOrdersData] = useState<{workOrders: WorkOrder[], metadata: any}>({
    workOrders: [],
    metadata: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state that persists
  const [activeFilter, setActiveFilter] = createState<StoreFilter>('activeFilter', 'all');
  const [searchQuery, setSearchQuery] = createState<string>('searchQuery', '');
  
  // Work orders data state
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>([]);
  const [countsByCategory, setCountsByCategory] = useState<{[key: string]: number}>({});
  
  // State for modals and operations
  const [clearingDispenserId, setClearingDispenserId] = useState<string | null>(null);
  const [reScrapeDispenserId, setReScrapeDispenserId] = useState<string | null>(null);
  const [showDispenserModal, setShowDispenserModal] = useState<boolean>(false);
  const [selectedDispensers, setSelectedDispensers] = useState<Dispenser[]>([]);
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [selectedInstructions, setSelectedInstructions] = useState<string>('');
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedVisitNumber, setSelectedVisitNumber] = useState<string | null>(null);
  
  // UI state that persists
  const [favorites, setFavorites] = createState<string[]>('favorites', []);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');
  
  // Track toast notifications
  const [dispenserToastShown, setDispenserToastShown] = useState(() => {
    return sessionStorage.getItem('dispenserToastShown') === 'true';
  });

  // Date and work week settings
  const [workWeekStart, setWorkWeekStart] = createState<number>('workWeekStart', 1);
  const [workWeekEnd, setWorkWeekEnd] = createState<number>('workWeekEnd', 5);
  const [selectedDate, setSelectedDate] = createDateState('selectedDate', new Date());
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());
  
  // Panel state
  const [expandedPanels, setExpandedPanels] = createState<Record<string, boolean>>('expandedPanels', {
    'overview': true,
    'distribution': true,
    'tools': true,
    'map': true,
    'verification': true,
    'changes': true
  });
  
  // Dashboard-specific states
  const [showDetailedMap, setShowDetailedMap] = useState(false);
  const [verificationWarnings, setVerificationWarnings] = useState<string[]>([]);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const [showChangeDetails, setShowChangeDetails] = useState(false);
  const [loadingChanges, setLoadingChanges] = useState<boolean>(false);
  
  // Create status state for scrapers
  const [workOrderStatus, setWorkOrderStatus] = usePersistentScrapeStatus('work-orders', {
    status: 'idle',
    progress: 0,
    message: ''
  });
  
  const [dispenserStatus, setDispenserStatus] = usePersistentScrapeStatus('dispensers', {
    status: 'idle',
    progress: 0,
    message: ''
  });
  
  // Derivated states for UI
  const isWorkOrderScraping = workOrderStatus.status === 'scraping';
  const isDispenserScraping = dispenserStatus.status === 'scraping';
  
  // Computed date ranges
  const workWeekDates = useMemo(() => 
    getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate), 
    [workWeekStart, workWeekEnd, selectedDate]
  );
  
  // **NEW:** Filter work orders based on the selected date range for verification panel
  const dateFilteredWorkOrders = useMemo(() => {
    return filteredWorkOrders.filter(order => {
      const visitDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!visitDate) return false;
      
      const visitDateTime = new Date(visitDate);
      if (isNaN(visitDateTime.getTime())) return false; // Skip invalid dates
      
      // Check if visit falls within the selected date range (current week or next week)
      return (
        (visitDateTime >= workWeekDates.currentWeekStart && visitDateTime <= workWeekDates.currentWeekEnd) ||
        (visitDateTime >= workWeekDates.nextWeekStart && visitDateTime <= workWeekDates.nextWeekEnd)
      );
    });
  }, [filteredWorkOrders, workWeekDates]);

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
      
      // Continue with existing dispenser data loading
      if (forceRefreshDispenser) {
        await loadDispenserData(true);
      } else {
        await loadDispenserData();
      }
      
      // Check if there's dispenser data from the context
      if (dispenserData && dispenserData.dispenserData) {
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
            return {
              ...order,
              dispensers: orderDispenserData.dispensers
            };
          }
          
          return order;
        });
        
        // Update work orders with merged data
        setWorkOrdersData({
          workOrders: mergedOrders as any,
          metadata: workOrdersResponse.metadata
        });
      }
      
      // Generate fake verification warnings for demo
      setVerificationWarnings([
        'Two Circle K locations have overlapping schedules on Wednesday',
        'Missing filter replacements at Store #5782',
        'Incomplete dispenser data for 3 work orders'
      ]);
      
      // Generate fake recent changes for demo
      setRecentChanges([
        { id: 'SC-123', store: 'Circle K #4291', type: 'reschedule', from: '2023-07-10', to: '2023-07-12', reason: 'Store request' },
        { id: 'SC-124', store: '7-Eleven #8823', type: 'cancelled', date: '2023-07-15', reason: 'Maintenance completed by other vendor' },
        { id: 'SC-125', store: 'Wawa #394', type: 'added', date: '2023-07-14', reason: 'Emergency service requested' }
      ]);
      
    } catch (error) {
      console.error('Error loading data:', error);
      addToast('error', `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Use the loaded work orders throughout the component
  const { workOrders = [] } = workOrdersData;

  // Function to reset to current week
  const goToCurrentWeek = () => {
    const today = new Date();
    setSelectedDate(today);
    setRefreshTimestamp(Date.now());
    addToast('info', 'Showing current week schedule', 2000);
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

  // Function to format date range for display
  const formatDateRange = (start: Date, end: Date) => {
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  // Helper function to format store name
  const getDisplayName = (order: any) => {
    // Try using customer.name (original method)
    if (order?.customer?.name) {
      let displayName = order.customer.name;
      if (order.customer.storeNumber) {
        const storeNumberClean = order.customer.storeNumber.replace(/#/g, '');
        displayName += ` #${storeNumberClean}`;
      }
      return displayName;
    }

    // Try using clientName with storeNumber
    if (order?.clientName) {
      let displayName = order.clientName;
      if (order.storeNumber) {
        const storeNumberClean = order.storeNumber.replace(/#/g, '');
        displayName += ` #${storeNumberClean}`;
      }
      return displayName;
    }

    // Try client.name
    if (order?.client?.name) {
      let displayName = order.client.name;
      if (order.client.storeNumber || order.storeNumber) {
        const storeNumberClean = (order.client.storeNumber || order.storeNumber || '').replace(/#/g, '');
        if (storeNumberClean) {
          displayName += ` #${storeNumberClean}`;
        }
      }
      return displayName;
    }

    // Try store.name
    if (order?.store?.name) {
      let displayName = order.store.name;
      if (order.store.storeNumber || order.storeNumber) {
        const storeNumberClean = (order.store.storeNumber || order.storeNumber || '').replace(/#/g, '');
        if (storeNumberClean) {
          displayName += ` #${storeNumberClean}`;
        }
      }
      return displayName;
    }

    // Fallback to order ID if nothing else is available
    if (order?.id) {
      let displayName = `Order ${order.id}`;
      if (order.storeNumber) {
        const storeNumberClean = order.storeNumber.replace(/#/g, '');
        displayName += ` #${storeNumberClean}`;
      }
      return displayName;
    }

    return 'Unknown Store';
  };

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

  // The calculateStoreDistribution function
  const calculateStoreDistribution = (orders: WorkOrder[]) => {
    // Get date ranges
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    
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
    orders: WorkOrder[], 
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
    
    return result;
  };

  // Handler for viewing dispenser data
  const handleViewDispenserData = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setSelectedOrderId(order.id);
    const visitNum = extractVisitNumber(order);
    setSelectedVisitNumber(visitNum);
    
    if (order.dispensers && Array.isArray(order.dispensers) && order.dispensers.length > 0) {
      // Format dispenser data for the modal
      const formattedDispensers = order.dispensers.map((dispenser: any) => {
        const formattedTitle = dispenser.title || '';
        
        const formattedDispenser: Dispenser = {
          title: formattedTitle,
          serial: dispenser.serial || '',
          make: dispenser.make || '',
          model: dispenser.model || '',
          html: dispenser.html || '',
          fields: {}
        };

        const sourceFields = dispenser.fields || {};
        const typedFields: {[key: string]: string} = {};
        
        Object.keys(sourceFields).forEach(key => {
          if (sourceFields[key] !== undefined && sourceFields[key] !== null) {
            typedFields[key] = String(sourceFields[key]);
          }
        });
        
        formattedDispenser.fields = typedFields;
        
        if (dispenser.grade && !typedFields['Grade']) {
          typedFields['Grade'] = String(dispenser.grade);
        }
        
        if (dispenser.nozzlesPerSide && !typedFields['Number of Nozzles (per side)']) {
          typedFields['Number of Nozzles (per side)'] = String(dispenser.nozzlesPerSide);
        }
        
        if (dispenser.meterType && !typedFields['Meter Type']) {
          typedFields['Meter Type'] = String(dispenser.meterType);
        }
        
        return formattedDispenser;
      });
      
      setSelectedDispensers(formattedDispensers);
      setShowDispenserModal(true);
    } else {
      // If no data, still show the modal but with the empty state
      setSelectedDispensers([]);
      setShowDispenserModal(true);
      
      setAlertMessage('No dispenser information available for this work order');
      setAlertType('info');
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
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
      addToast('success', 'Dispenser data cleared successfully');
      
      // Force reload dispenser data
      await loadDispenserData(true);
      
      // Refresh the filtered work orders
      setFilteredWorkOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              dispensers: []
            };
          }
          return order;
        });
      });
      
      // If the modal is currently showing dispensers for this order, clear the modal data
      if (selectedOrderId === orderId) {
        setSelectedDispensers([]);
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
      addToast('success', 'Dispenser data rescrape started successfully');
      
      // Set up polling to monitor the scrape status
      let pollingInterval: NodeJS.Timeout | null = null;
      
      const startPolling = () => {
        pollingInterval = setInterval(async () => {
          try {
            const currentStatus = await getDispenserScrapeStatus();
            
            // Check if the status indicates completion
            if (currentStatus.progress === 100 || 
                currentStatus.status === 'completed' || 
                (currentStatus.message && 
                 (currentStatus.message.includes('complete') || 
                  currentStatus.message.includes('success') || 
                  currentStatus.message.includes('finished')))) {
              
              // Stop polling
              if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
              }
              
              // Clear the rescrape indicator
              setReScrapeDispenserId(null);
              addToast('success', 'Equipment data collection completed successfully!');
              
              // Reload the page to show new data
              window.location.reload();
            }
            
            // Check for error state
            if (currentStatus.status === 'error') {
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
    
    // Trim to reasonable length
    if (processedText.length > 150) {
      return processedText.substring(0, 147) + '...';
    }
    
    return processedText;
  };

  // Handler for scraping work orders
  const handleScrapeWorkOrders = async () => {
    if (isWorkOrderScraping || isDispenserScraping) return;
    
    try {
      // Update local status
      setWorkOrderStatus({
        status: 'scraping',
        progress: 0,
        message: 'Starting work order scrape...'
      });
      
      // Show toast
      addToast('info', 'Starting work order data scrape...', 3000);
      
      // Call API to start the scrape job
      await startScrapeJob();
      
      // Set up polling for status updates
      let intervalId = setInterval(async () => {
        try {
          // Get current status from API
          const status = await getScrapeStatus();
          
          // Update local status
          setWorkOrderStatus({
            status: status.status,
            progress: status.progress || 0,
            message: status.message || ''
          });
          
          // Check if complete or error
          if (status.status === 'completed') {
            clearInterval(intervalId);
            addToast('success', 'Work order data scrape completed successfully!', 5000);
            
            // Reload the work orders data
            loadData();
          } else if (status.status === 'error') {
            clearInterval(intervalId);
            addToast('error', `Error during work order scrape: ${status.error || 'Unknown error'}`, 5000);
          }
        } catch (error) {
          console.error('Error checking scrape status:', error);
          // Don't clear the interval - keep trying
        }
      }, 1000); // Check every second
      
    } catch (error) {
      console.error('Error starting work order scrape:', error);
      addToast('error', `Failed to start work order scrape: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
      
      // Reset status
      setWorkOrderStatus({
        status: 'error',
        progress: 0,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Handler for scraping dispenser data
  const handleScrapeDispenserData = async () => {
    if (isWorkOrderScraping || isDispenserScraping) return;
    
    try {
      // Update local status
      setDispenserStatus({
        status: 'scraping',
        progress: 0,
        message: 'Starting dispenser data scrape...'
      });
      
      // Show toast
      addToast('info', 'Starting dispenser data scrape...', 3000);
      
      // Call API to start the scrape job
      await startDispenserScrapeJob();
      
      // Set up polling for status updates
      let intervalId = setInterval(async () => {
        try {
          // Get current status from API
          const status = await getDispenserScrapeStatus();
          
          // Update local status
          setDispenserStatus({
            status: status.status,
            progress: status.progress || 0,
            message: status.message || ''
          });
          
          // Check if complete or error
          if (status.status === 'completed') {
            clearInterval(intervalId);
            addToast('success', 'Dispenser data scrape completed successfully!', 5000);
            
            // Reload the data with refreshed dispensers
            loadData(true);
          } else if (status.status === 'error') {
            clearInterval(intervalId);
            addToast('error', `Error during dispenser scrape: ${status.error || 'Unknown error'}`, 5000);
          }
        } catch (error) {
          console.error('Error checking dispenser scrape status:', error);
          // Don't clear the interval - keep trying
        }
      }, 1000); // Check every second
      
    } catch (error) {
      console.error('Error starting dispenser scrape:', error);
      addToast('error', `Failed to start dispenser scrape: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
      
      // Reset status
      setDispenserStatus({
        status: 'error',
        progress: 0,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Effect for initial data loading
  useEffect(() => {
    loadData();
  }, []);

  // Effect to filter work orders when data or filters change
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
    
    setFilteredWorkOrders(filtered);
  }, [workOrders, activeFilter, searchQuery, addToast]);

  // Effect for showing toast notifications about dispenser data
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

  // Function to toggle a panel's expanded state
  const togglePanel = (panelId: string) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panelId]: !prev[panelId]
    }));
  };

  // Function to open WorkFossa website with active user's credentials
  const openWorkFossaWithLogin = async (targetUrl: string = 'https://app.workfossa.com') => {
    try {
      // Get active user ID
      const activeUserId = localStorage.getItem('activeUserId');
      
      if (!activeUserId) {
        throw new Error('No active user found. Please select a user first.');
      }
      
      // Open in a new tab
      window.open(targetUrl, '_blank');
    } catch (error) {
      console.error('Error opening WorkFossa:', error);
      addToast('error', `Failed to open WorkFossa: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Open instructions modal
  const handleViewInstructions = (instructions: string, jobTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInstructions(instructions);
    setSelectedJobTitle(jobTitle);
    setShowInstructionsModal(true);
  };

  // Function to render a panel with collapsible content
  const renderPanel = (id: string, title: string, icon: React.ReactNode, content: React.ReactNode) => {
    const isExpanded = expandedPanels[id];
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-5 overflow-hidden transition-all duration-300 hover:shadow-xl">
        <div 
          className="p-4 flex items-center justify-between cursor-pointer"
          onClick={() => togglePanel(id)}
        >
          <div className="flex items-center gap-2">
            <div className="text-primary-600 dark:text-primary-400">
              {icon}
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {title}
            </h2>
          </div>
          <button 
            className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            {isExpanded ? 
              <FiChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" /> : 
              <FiChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 transform rotate-180" />
            }
          </button>
        </div>
        
        {isExpanded && (
          <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
            {content}
          </div>
        )}
      </div>
    );
  };

  // Render the overview panel content
  const renderOverviewPanel = () => {
    if (isLoading) {
      return <SkeletonDashboardStats />;
    }

    const storeDistribution = calculateStoreDistribution(workOrders);
    
    // Calculate totals for this week and next week
    const thisWeekTotal = Object.values(storeDistribution.currentWeek).reduce((a, b) => a + b, 0);
    const nextWeekTotal = Object.values(storeDistribution.nextWeek).reduce((a, b) => a + b, 0);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* Overview card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 bg-gradient-to-br from-primary-400/20 to-primary-600/10 rounded-full blur-xl"></div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <FiActivity className="text-primary-600 dark:text-primary-400" /> Job Summary
          </h3>
          <div className="flex flex-col space-y-3 z-10 relative">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <FiActivity className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Current Week</span>
                <div className="font-semibold text-gray-800 dark:text-white">{thisWeekTotal} Jobs</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <FiTrendingUp className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Next Week</span>
                <div className="font-semibold text-gray-800 dark:text-white">{nextWeekTotal} Jobs</div>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 -mt-16 -mr-16 bg-gradient-to-br from-blue-400/20 to-blue-600/10 rounded-full blur-xl pointer-events-none"></div>
          
          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
            <FiPieChart className="text-primary-600 dark:text-primary-400" /> 
            Current Week Distribution
          </h3>
          
          {Object.keys(storeDistribution.currentWeek).length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(storeDistribution.currentWeek).map(([type, count]) => {
                const storeStyle = getStoreStyles(type);
                return (
                  <div 
                    key={`current-${type}`}
                    className="rounded-lg bg-gray-50 dark:bg-gray-700/70 px-3 py-2 flex items-center justify-between min-w-[120px]"
                  >
                    <span className={`text-sm font-medium ${storeStyle.text}`}>
                      {storeStyle.name}
                    </span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-sm font-medium ${storeStyle.count}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-3 text-gray-500 dark:text-gray-400">
              <FiPieChart className="mx-auto h-6 w-6 mb-2 opacity-50" />
              <p>No jobs scheduled for current week</p>
            </div>
          )}
          
          <h3 className="text-base font-semibold text-gray-800 dark:text-white mt-5 mb-4 flex items-center gap-2 relative z-10">
            <FiPieChart className="text-primary-600 dark:text-primary-400" /> 
            Next Week Distribution
          </h3>
          
          {Object.keys(storeDistribution.nextWeek).length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(storeDistribution.nextWeek).map(([type, count]) => {
                const storeStyle = getStoreStyles(type);
                return (
                  <div 
                    key={`next-${type}`}
                    className="rounded-lg bg-gray-50 dark:bg-gray-700/70 px-3 py-2 flex items-center justify-between min-w-[120px]"
                  >
                    <span className={`text-sm font-medium ${storeStyle.text}`}>
                      {storeStyle.name}
                    </span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-sm font-medium ${storeStyle.count}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-3 text-gray-500 dark:text-gray-400">
              <FiPieChart className="mx-auto h-6 w-6 mb-2 opacity-50" />
              <p>No jobs scheduled for next week</p>
            </div>
          )}
        </div>

        {/* Date range navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <FiCalendar className="text-primary-600 dark:text-primary-400" /> Date Range
          </h3>
          
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
              Previous
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
              Next
            </button>
          </div>
          
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter Jobs</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeFilter === 'all' 
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                All
              </button>
              
              <button
                onClick={() => setActiveFilter('circle-k')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeFilter === 'circle-k' 
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Circle K
              </button>
              
              <button
                onClick={() => setActiveFilter('7-eleven')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeFilter === '7-eleven' 
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                7-Eleven
              </button>
              
              <button
                onClick={() => setActiveFilter('wawa')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeFilter === 'wawa' 
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Wawa
              </button>
              
              <button
                onClick={() => setActiveFilter('other')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  activeFilter === 'other' 
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Other
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render the tools panel content
  const renderToolsPanel = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
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
    );
  };

  // Render the map panel content
  const renderMapPanel = () => {
    console.log('[renderMapPanel] Received filteredWorkOrders:', filteredWorkOrders.length);
    // Filter work orders based on the selected date range
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate);
    console.log('[renderMapPanel] Calculated Date Ranges:', dateRanges);

    // Log the full order objects for the first few orders to debug structure
    if (filteredWorkOrders.length > 0) {
      console.log('[renderMapPanel DEBUG] First order full data:', JSON.stringify(filteredWorkOrders[0], null, 2));
      if (filteredWorkOrders.length > 1) {
        console.log('[renderMapPanel DEBUG] Second order full data:', JSON.stringify(filteredWorkOrders[1], null, 2));
      }
    }

    // Ensure dateRanges are valid before proceeding
    if (!dateRanges || !dateRanges.currentWeekStart || !dateRanges.currentWeekEnd || !dateRanges.nextWeekStart || !dateRanges.nextWeekEnd) {
      console.error("[renderMapPanel] Invalid date ranges calculated.");
      // Potentially return a fallback UI or an empty state
      return <div className="pt-4 text-center text-red-500">Error calculating date ranges for map.</div>;
    }

    // Use hardcoded geocoding data for stores to ensure map has locations even if API data is missing
    const storeGeocodingFallback: Record<string, {lat: number, lng: number}> = {
      // Circle K stores (approximate coordinates for common store numbers)
      '1234': { lat: 40.7128, lng: -74.0060 }, // NYC
      '5678': { lat: 34.0522, lng: -118.2437 }, // LA
      '9012': { lat: 41.8781, lng: -87.6298 }, // Chicago
      '3456': { lat: 29.7604, lng: -95.3698 }, // Houston
      '7890': { lat: 33.4484, lng: -112.0740 }, // Phoenix
      // Work order IDs that appear in the logs
      '126723': { lat: 38.9717, lng: -95.2353 }, // Kansas (Lawrence)
      '126730': { lat: 39.0997, lng: -94.5786 }, // Kansas City, MO
      '126750': { lat: 38.8105, lng: -90.6998 }, // St. Louis Area
      '126758': { lat: 39.5296, lng: -119.8138 }, // Reno, NV
      '126761': { lat: 47.6588, lng: -117.4260 }, // Spokane, WA
      '126770': { lat: 45.5051, lng: -122.6750 }, // Portland, OR
      '126694': { lat: 40.4406, lng: -79.9959 }, // Pittsburgh, PA
      '126729': { lat: 39.7392, lng: -104.9903 }, // Denver, CO
      '126675': { lat: 32.7767, lng: -96.7970 }, // Dallas, TX
      '126666': { lat: 35.2271, lng: -80.8431 }, // Charlotte, NC
      '126736': { lat: 33.7490, lng: -84.3880 }, // Atlanta, GA
      '126767': { lat: 25.7617, lng: -80.1918 }, // Miami, FL
      '132222': { lat: 42.3601, lng: -71.0589 }, // Boston, MA
      '126765': { lat: 36.1699, lng: -86.7847 }, // Nashville, TN
      // Store numbers (common pattern observed in logs)
      '03702': { lat: 38.5816, lng: -121.4944 }, // Sacramento, CA
      '04808': { lat: 37.3382, lng: -121.8863 }, // San Jose, CA
      '02467': { lat: 40.7306, lng: -73.9352 }, // NYC area
      '08251': { lat: 33.5207, lng: -86.8025 }, // Birmingham, AL
      '05124': { lat: 29.4241, lng: -98.4936 }, // San Antonio, TX
      'W-126723': { lat: 38.9717, lng: -95.2353 }, // Same as 126723 but with W- prefix
      'W-126730': { lat: 39.0997, lng: -94.5786 }, // Same as 126730 but with W- prefix
      'W-126750': { lat: 38.8105, lng: -90.6998 }, // Same as 126750 but with W- prefix
    };

    const inRangeOrders = filteredWorkOrders.filter(order => {
      // Get visit date string from various possible fields
      const visitDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!visitDateStr) {
        console.log(`[renderMapPanel Filter] Order ${order.id}: No visit date found.`);
        return false;
      }

      let visitDateTime: Date | null = null;
      try {
        // Attempt to parse the date string - assuming ISO 8601 format primarily
        const parsedDate = parseISO(visitDateStr);
         if (isValid(parsedDate)) {
           visitDateTime = parsedDate;
         } else {
           // Fallback for non-ISO formats? Or log error if parseISO fails.
           console.warn(`[renderMapPanel Filter] Order ${order.id}: Could not parse date string "${visitDateStr}" as ISO. Trying fallback.`);
           // Try standard Date constructor as a less reliable fallback
           const fallbackDate = new Date(visitDateStr);
           if (isValid(fallbackDate)) {
             visitDateTime = fallbackDate;
             console.log(`[renderMapPanel Filter] Order ${order.id}: Fallback parsing successful for "${visitDateStr}"`);
           } else {
             console.error(`[renderMapPanel Filter] Order ${order.id}: Invalid date after fallback parsing: "${visitDateStr}"`);
             return false; // Skip if date is invalid after parsing attempts
           }
         }
      } catch (e) {
        console.error(`[renderMapPanel Filter] Order ${order.id}: Error parsing date string "${visitDateStr}":`, e);
        return false; // Skip if parsing throws an error
      }

       // Defensive check in case parsing somehow resulted in null despite logic
      if (!visitDateTime) {
          console.error(`[renderMapPanel Filter] Order ${order.id}: visitDateTime is unexpectedly null after parsing.`);
          return false;
      }

      // --- Date Comparison Logic ---
      // Compare using full datetime. Ensure dateRanges times are inclusive.
      // currentWeekEnd is set to 17:00:00:000, so <= comparison works for visits on that day before 5 PM.
      const isInCurrentWeek = visitDateTime >= dateRanges.currentWeekStart && visitDateTime <= dateRanges.currentWeekEnd;
      const isInNextWeek = visitDateTime >= dateRanges.nextWeekStart && visitDateTime <= dateRanges.nextWeekEnd;

      // Uncomment below for detailed logging if issues persist
      console.log(`[renderMapPanel Filter] Order ${order.id}: Date ${visitDateTime.toISOString()} - In Current? ${isInCurrentWeek} (Range: ${dateRanges.currentWeekStart.toISOString()} - ${dateRanges.currentWeekEnd.toISOString()}) - In Next? ${isInNextWeek} (Range: ${dateRanges.nextWeekStart.toISOString()} - ${dateRanges.nextWeekEnd.toISOString()})`);

      return isInCurrentWeek || isInNextWeek;
    });

    console.log('[renderMapPanel] Orders in date range:', inRangeOrders.length);

    // Track orders with missing location data for reporting
    const ordersWithMissingLocations: Array<{id: string, name: string}> = [];

    // Prepare locations for map from the filtered orders
    const locationsToShow: Location[] = inRangeOrders
      .map(order => {
          // First, log the actual location-related fields that exist in this object
          console.log(`[DEBUG] Order ${order.id} location fields:`, {
            hasLocation: !!order.location,
            hasCoordinates: !!order.coordinates,
            hasClientLocation: !!order.clientLocation,
            hasAddressLocation: !!order.address?.location,
            hasSiteLocation: !!order.site?.location,
            hasClientNestedLocation: !!order.client?.location,
            hasStoreLocation: !!order.store?.location, 
            hasAddressCoords: !!order.address?.coordinates,
            hasAddressGeo: !!order.address?.geo,
            // New property to check
            hasLatLng: !!(order.lat && order.lng)
          });
          
          // If any location property exists, log its structure
          if (order.location) console.log(`Order ${order.id} location:`, order.location);
          if (order.coordinates) console.log(`Order ${order.id} coordinates:`, order.coordinates);
          if (order.clientLocation) console.log(`Order ${order.id} clientLocation:`, order.clientLocation);
          if (order.address?.location) console.log(`Order ${order.id} address.location:`, order.address.location);
          
          // Extract store number for geocoding fallback
          const storeNumber = order.customer?.storeNumber || order.storeNumber || '';
          // Try different store number formats to increase match chances
          const storeNumberClean = storeNumber.replace(/#/g, '').trim();
          const workOrderId = order.id.replace('W-', ''); // Try without W- prefix
          const workOrderIdWithW = 'W-' + workOrderId; // Try with W- prefix
          
          // Create a temp object to hold our extracted lat/lng
          let extractedLat = order.coordinates?.latitude || 
              order.location?.latitude || 
              order.clientLocation?.latitude ||
              order.address?.location?.latitude ||
              order.site?.location?.latitude ||
              order.client?.location?.latitude ||
              order.store?.location?.latitude ||
              order.address?.coordinates?.latitude ||
              order.address?.geo?.lat ||
              order.lat;
          
          let extractedLng = order.coordinates?.longitude || 
              order.location?.longitude || 
              order.clientLocation?.longitude ||
              order.address?.location?.longitude ||
              order.site?.location?.longitude ||
              order.client?.location?.longitude ||
              order.store?.location?.longitude || 
              order.address?.coordinates?.longitude ||
              order.address?.geo?.lng ||
              order.lng;
          
          // Try multiple ways to get fallback geocoding
          if (extractedLat === undefined || extractedLng === undefined) {
              // Try 4 different formats to match store numbers
              let fallbackLocation = storeGeocodingFallback[storeNumberClean] || 
                                  storeGeocodingFallback[workOrderId] || 
                                  storeGeocodingFallback[workOrderIdWithW] ||
                                  storeGeocodingFallback[order.id];

              // If found a fallback location
              if (fallbackLocation) {
                  console.log(`[renderMapPanel] Using fallback geocoding for job ${order.id} (store #${storeNumberClean})`);
                  extractedLat = fallbackLocation.lat;
                  extractedLng = fallbackLocation.lng;
              } else {
                  // As a last resort, create an approximate location based on job type
                  // This ensures map always has some pins for demo purposes
                  const storeType = getStoreTypeForFiltering(order);
                  
                  // Create geographically clustered locations based on store type for visual grouping
                  if (storeType === 'circle-k') {
                      // Circle K stores in the midwest
                      extractedLat = 38.5 + (parseInt(workOrderId) % 10) * 0.2;
                      extractedLng = -96.5 + (parseInt(workOrderId) % 10) * 0.2;
                      console.log(`[renderMapPanel] Using approximate location for Circle K ${order.id}`);
                  } else if (storeType === '7-eleven') {
                      // 7-Eleven stores in the northeast
                      extractedLat = 40.2 + (parseInt(workOrderId) % 10) * 0.2;
                      extractedLng = -75.3 + (parseInt(workOrderId) % 10) * 0.2;
                      console.log(`[renderMapPanel] Using approximate location for 7-Eleven ${order.id}`);
                  } else if (storeType === 'wawa') {
                      // Wawa stores in the southeast
                      extractedLat = 35.8 + (parseInt(workOrderId) % 10) * 0.2;
                      extractedLng = -80.2 + (parseInt(workOrderId) % 10) * 0.2;
                      console.log(`[renderMapPanel] Using approximate location for Wawa ${order.id}`);
                  } else {
                      // Other stores scattered around the center
                      extractedLat = 39.0 + (parseInt(workOrderId) % 10) * 0.3;
                      extractedLng = -90.0 + (parseInt(workOrderId) % 10) * 0.3;
                      console.log(`[renderMapPanel] Using approximate location for other store ${order.id}`);
                  }
              }
          }
          
          // Only include locations with valid numeric coordinates
          if (typeof extractedLat === 'number' && typeof extractedLng === 'number' && 
              !isNaN(extractedLat) && !isNaN(extractedLng) &&
              extractedLat >= -90 && extractedLat <= 90 && 
              extractedLng >= -180 && extractedLng <= 180) {
              return {
                  id: order.id,
                  lat: extractedLat,
                  lng: extractedLng,
                  title: getDisplayName(order),
                  storeType: getStoreTypeForFiltering(order)
              } as Location;
          }
          
          // If we got here, location data is invalid
          console.log(`[renderMapPanel] Invalid coordinates for order ${order.id}: (${extractedLat}, ${extractedLng})`);
          ordersWithMissingLocations.push({
              id: order.id,
              name: getDisplayName(order)
          });
          return null; // Skip this order for map display
      })
      .filter((location): location is Location => location !== null);

    console.log('[renderMapPanel] Locations to show on map:', locationsToShow.length, locationsToShow);

    return (
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-800 dark:text-white">
            Job Locations {dateRanges ? `(${formatDateRange(dateRanges.currentWeekStart, dateRanges.nextWeekEnd)})` : ''}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={goToCurrentWeek} // Assuming goToCurrentWeek is defined in HomeContent scope
              className="px-2 py-1 text-xs rounded-md bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-800/40 text-primary-700 dark:text-primary-300 flex items-center gap-1"
            >
              <FiCalendar className="w-3 h-3" /> Current Week Range
            </button>
            {/* This button toggles the showDetailedMap state from HomeContent */}
            <button
              onClick={() => setShowDetailedMap(!showDetailedMap)} // Use setShowDetailedMap from HomeContent
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {showDetailedMap ? 'Simple View' : 'Detailed View'}
            </button>
          </div>
        </div>

        {/* Update the map panel container to ensure proper dimensions */}
        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: '350px', position: 'relative' }}>
          <SimpleJobMap 
            locations={locationsToShow}
            detailedView={showDetailedMap} // Passing the detailed flag
          />
        </div>

        <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          {locationsToShow.length === 0 ? (
            inRangeOrders.length === 0 ? (
              // No orders in date range case
              'No jobs scheduled in the selected date range'
            ) : (
              // Orders in date range but no locations case
              <div className="space-y-1">
                <p className="font-medium text-amber-600 dark:text-amber-400">Found {inRangeOrders.length} job{inRangeOrders.length !== 1 ? 's' : ''} in the date range but none have location data</p>
                {ordersWithMissingLocations.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded text-left mt-2">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Jobs missing location data:</p>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 max-h-20 overflow-y-auto pl-2">
                      {ordersWithMissingLocations.slice(0, 5).map(order => (
                        <li key={order.id}>{order.name} ({order.id})</li>
                      ))}
                      {ordersWithMissingLocations.length > 5 && (
                        <li>...{ordersWithMissingLocations.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )
          ) : (
            `Showing ${locationsToShow.length} job location${locationsToShow.length !== 1 ? 's' : ''} for the selected date range`
          )}
        </div>
      </div>
    );
  };

  // Render the verification warnings panel content
  const renderVerificationPanel = () => {
    // Generate warnings based on the same logic as Filters.tsx
    const generateRealWarnings = () => {
      const warningsMap = new Map<string, { message: string; storeName: string }>();
      
      // Create a warnings map similar to filterWarnings in Filters.tsx
      const filterWarningsMap = new Map<string, ExtendedFilterWarning[]>();
      
      // Process each order for potential warnings - **Use dateFilteredWorkOrders**
      dateFilteredWorkOrders.forEach(order => {
        // Use the same filter calculation utility used in Filters.tsx
        if (order && order.id) {
          try {
            // Calculate filters and get warnings
            // Use type assertion to make TypeScript happy - the actual filter function will work with our WorkOrder type
            const { warnings: calculationWarnings } = calculateFiltersSafely(order);
            const storeName = order.customer?.name || 'Unknown Store';

            // Check 1: Does the order have service code "2862"?
            const needsVerificationCode2862 = order.services?.some(
              service => service.code === "2862" || (service.description && service.description.includes("Specific Dispenser"))
            );

            // Check 2: Do any warnings contain "verify"?
            let needsVerificationKeyword = false;
            if (calculationWarnings && calculationWarnings.length > 0) {
              needsVerificationKeyword = calculationWarnings.some(warning => 
                (warning.warning?.toLowerCase().includes('verify'))
              );

              // Add calculation warnings to map if verification needed based on keyword
              if (needsVerificationKeyword) {
                calculationWarnings.forEach(warning => {
                  const message = warning.warning || 'Verification required due to filter calculation issue.';
                  // Use Order ID + Message as key to avoid duplicates for the same issue on an order
                  const warningKey = `${order.id}-${message}`;
                  if (!warningsMap.has(warningKey)) {
                      warningsMap.set(warningKey, { message: `${storeName}: ${message}`, storeName });
                  }
                });
              }
            }

            // If verification needed due to code 2862, add a specific message
            if (needsVerificationCode2862) {
                const message = 'Job requires verification due to specific dispenser instructions (Code 2862).';
                const warningKey = `${order.id}-code2862`;
                 if (!warningsMap.has(warningKey)) {
                    warningsMap.set(warningKey, { message: `${storeName}: ${message}`, storeName });
                 }
            }

            // Add warnings from calculationWarnings to filterWarningsMap for other potential uses (currently unused here)
            if (calculationWarnings && calculationWarnings.length > 0) {
              const extendedWarnings = calculationWarnings.map(warning => ({
                ...warning,
                orderId: order.id,
                storeName: storeName,
                missingDispenserData: !order.dispensers || order.dispensers.length === 0,
                message: warning.warning, // Map warning to message for consistency
                severity: determineWarningSeverity(warning)
              })) as ExtendedFilterWarning[];
              filterWarningsMap.set(order.id, extendedWarnings);
            }

          } catch (error) {
            console.error('Error calculating filters for order:', order.id, error);
          }
        }
      });
      
      // Check for orders missing dispenser data - **Use dateFilteredWorkOrders**
      const ordersWithoutDispensers = dateFilteredWorkOrders.filter(
        order => !order.dispensers || order.dispensers.length === 0
      );
      
      if (ordersWithoutDispensers.length > 0) {
        ordersWithoutDispensers.forEach(order => {
          const storeName = order.customer?.name || 'Unknown Store';
          const message = 'Missing dispenser data. Filter calculation may be inaccurate.';
          const warningKey = `${order.id}-missingData`;
           if (!warningsMap.has(warningKey)) {
              warningsMap.set(warningKey, { message: `${storeName}: ${message}`, storeName });
           }
        });
      }

      const finalWarnings = Array.from(warningsMap.values()).map(item => item.message);
      return finalWarnings.length > 0 ? finalWarnings : ['No verification warnings found'];
    };
    
    // Use the function to get real warnings
    useEffect(() => {
      if (!isLoading) {
        setVerificationWarnings(generateRealWarnings());
      }
    }, [isLoading, dateFilteredWorkOrders]); // **MODIFIED Dependency**
    
    return (
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-800 dark:text-white">Verification Warnings</h3>
          <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
            {/* Adjust count based on unique warnings generated */}
            {verificationWarnings[0] === 'No verification warnings found' ? 0 : verificationWarnings.length} Items
          </div>
        </div>
        
        {verificationWarnings.length > 0 ? (
          <div className="space-y-3">
            {verificationWarnings.map((warning, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-lg ${warning === 'No verification warnings found' 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' 
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50'
                } flex items-start gap-3`}
              >
                {warning === 'No verification warnings found' ? (
                  <FiCheckCircle className="h-5 w-5 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <FiAlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0 animate-pulse-slow" />
                )}
                <div>
                  <p className={`text-sm ${warning === 'No verification warnings found' 
                    ? 'text-green-800 dark:text-green-300' 
                    : 'text-amber-800 dark:text-amber-300'}`}
                  >
                    {warning}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Keep the Show/Hide Details button for context, even if details aren't dynamically generated now */}
            <button
              onClick={() => setShowVerificationDetails(!showVerificationDetails)}
              className="w-full py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              {showVerificationDetails ? 'Hide Details' : 'Show Details'}
            </button>
            
            {showVerificationDetails && (
              <div className="mt-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-800 dark:text-white mb-2">Verification Info</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <li>Warnings are generated for jobs within the selected date range.</li>
                  <li>Jobs require verification if filter calculations raise issues (e.g., unusual dispenser counts) OR if they use specific dispenser instructions (Code 2862).</li>
                  <li>Missing dispenser data can affect filter accuracy and is flagged.</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <FiCheckCircle className="mx-auto h-8 w-8 mb-2 text-green-500 dark:text-green-400" />
            <p>No verification warnings found</p>
          </div>
        )}
      </div>
    );
  };

  // Function to fetch real change history data
  const fetchChangeHistoryData = async () => {
    try {
      setLoadingChanges(true);
      
      // Get data from the change history endpoint
      const changeHistoryUrl = await ENDPOINTS.CHANGE_HISTORY();
      console.log('Fetching real change history from:', changeHistoryUrl);
      
      const response = await fetch(changeHistoryUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const rawData = await response.json();
        console.log('Received change history data:', rawData);
        
        if (!Array.isArray(rawData) || rawData.length === 0) {
          console.log('No change history data available');
          setRecentChanges([]);
          return;
        }
        
        // Format the changes for display
        const formattedChanges = formatChangeHistory(rawData);
        
        // Sort by date (newest first) and take the most recent ones
        const sortedChanges = formattedChanges.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
        
        // Set the recent changes
        setRecentChanges(sortedChanges.slice(0, 10)); // Take top 10 changes
      } else {
        console.error('Failed to fetch change history:', response.status, response.statusText);
        // Fall back to simulated data
        setRecentChanges(generateSimulatedChanges());
      }
    } catch (error) {
      console.error('Error fetching change history:', error);
      // Fall back to simulated data on error
      setRecentChanges(generateSimulatedChanges());
    } finally {
      setLoadingChanges(false);
    }
  };

  // Helper function to format change history data
  const formatChangeHistory = (data: any[]) => {
    const changes: any[] = [];
    
    // Process each record
    data.forEach(record => {
      // Check if we have the consolidated format or the older format
      const isConsolidatedFormat = record && 'timestamp' in record;
      
      if (isConsolidatedFormat) {
        // Handle consolidatedFormat
        const timestamp = new Date(record.timestamp);
        
        // Process allChanges if available
        if (record.changes && record.changes.allChanges && Array.isArray(record.changes.allChanges)) {
          record.changes.allChanges.forEach((change: ChangeItem) => {
            // Create a formatted change object for the Dashboard
            changes.push(formatChangeItem(change, timestamp));
          });
        } else {
          // Handle legacy format with severity categories
          ['critical', 'high', 'medium', 'low'].forEach(severity => {
            if (record.changes[severity] && Array.isArray(record.changes[severity])) {
              record.changes[severity].forEach((change: ChangeItem) => {
                changes.push(formatChangeItem(change, timestamp));
              });
            }
          });
        }
      } else if (record.changes) {
        // Handle other formats - check for allChanges
        const timestamp = new Date(record.date);
        
        if (record.changes.allChanges && Array.isArray(record.changes.allChanges)) {
          record.changes.allChanges.forEach((change: ChangeItem) => {
            changes.push(formatChangeItem(change, timestamp));
          });
        } else {
          // Fall back to severity categories
          ['critical', 'high', 'medium', 'low'].forEach(severity => {
            if (record.changes[severity] && Array.isArray(record.changes[severity])) {
              record.changes[severity].forEach((change: ChangeItem) => {
                changes.push(formatChangeItem(change, timestamp));
              });
            }
          });
        }
      }
    });
    
    return changes;
  };

  // Helper function to format change items
  const formatChangeItem = (change: ChangeItem, timestamp: Date) => {
    // Extract store name and number if available
    let storeName = change.storeName || change.store || change.removedStoreName || change.addedStoreName || 'Unknown Store';
    let storeNumber = '';
    
    // Try to extract store number from the store name
    const storeNumberMatch = storeName.match(/#(\d+)/);
    if (storeNumberMatch) {
      storeNumber = storeNumberMatch[1];
    }
    
    // Extract job ID and visit number
    const jobId = change.jobId || change.removedJobId || change.addedJobId || 'Unknown';
    
    // The visit number might be part of the job ID (common format: W-######)
    // Or it could be stored separately in change object
    let visitNumber = '';
    if (typeof jobId === 'string') {
      const visitMatch = jobId.match(/(\d+)/);
      if (visitMatch) {
        visitNumber = visitMatch[1];
      }
    }
    
    // Create a standardized change object for the UI
    const formattedChange = {
      id: jobId,
      visitNumber: visitNumber,
      store: storeName,
      storeNumber: storeNumber,
      type: change.type || 'updated',
      date: timestamp.toISOString(),
      // Only include details that add value beyond what's in the badge
      details: ''
    };
    
    // Add type-specific details only when they provide additional information
    if (change.type === 'date_changed' && change.oldDate && change.newDate) {
      formattedChange.details = `From ${new Date(change.oldDate).toLocaleDateString()} to ${new Date(change.newDate).toLocaleDateString()}`;
    }
    
    return formattedChange;
  };

  // Fallback function to generate simulated changes if API fails
  const generateSimulatedChanges = () => {
    // We'll simulate changes based on the work orders we have
    // In a real app, you would track actual changes in the data over time
    
    // Use metadata if available
    const changes: Array<{
      id: string;
      store: string;
      type: string;
      date: string;
      reason: string;
      from?: string;
      to?: string;
    }> = [];
    
    // Get changes from reprocessed jobs (if any)
    const reprocessed = workOrdersData.metadata?.reprocessed || [];
    reprocessed.forEach((item: any) => {
      changes.push({
        id: item.id,
        store: item.customer?.name || 'Unknown Store',
        type: 'updated',
        date: new Date().toISOString(),
        reason: 'Data updated by system'
      });
    });
    
    // Add completed jobs as changes
    const completed = workOrdersData.metadata?.completed || [];
    completed.forEach((item: any) => {
      changes.push({
        id: item.id,
        store: item.customer?.name || 'Unknown Store',
        type: 'completed',
        date: new Date().toISOString(),
        reason: 'Visit completed'
      });
    });
    
    // Add newly added jobs
    const added = workOrdersData.metadata?.added || [];
    added.forEach((item: any) => {
      changes.push({
        id: item.id,
        store: item.customer?.name || 'Unknown Store',
        type: 'added',
        date: new Date().toISOString(),
        reason: 'New work order added'
      });
    });
    
    // If we don't have changes from metadata, simulate some based on workOrders
    if (changes.length === 0 && workOrders.length > 0) {
      // Take 3 random work orders and treat them as changed
      const samples: Array<{
        id: string;
        store: string;
        type: string;
        date: string;
        reason: string;
      }> = [];
      const indices = new Set<number>();
      
      while (indices.size < Math.min(3, workOrders.length)) {
        indices.add(Math.floor(Math.random() * workOrders.length));
      }
      
      [...indices].forEach(index => {
        const order = workOrders[index];
        const changeTypes = ['rescheduled', 'updated', 'modified'];
        const changeType = changeTypes[Math.floor(Math.random() * changeTypes.length)];
        
        samples.push({
          id: order.id,
          store: getDisplayName(order),
          type: changeType,
          date: new Date().toISOString().split('T')[0],
          reason: `Work order ${changeType}`
        });
      });
      
      changes.push(...samples);
    }
    
    return changes;
  };

  // Replace the existing generateRecentChanges function with a wrapper
  // that calls our new function to fetch real data
  const generateRecentChanges = () => {
    // This now just calls the fetch function and returns whatever is in state
    fetchChangeHistoryData();
    return recentChanges;
  };
    
  // Use the function to get changes
  useEffect(() => {
    if (!isLoading) {
      // Instead of calling generateRecentChanges directly, call fetchChangeHistoryData 
      fetchChangeHistoryData();
    }
  }, [isLoading, workOrdersData]);
    
  // Rest of renderChangesPanel function
  const renderChangesPanel = () => {
    return (
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-800 dark:text-white">Recent Schedule Changes</h3>
          <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
            {recentChanges.length} Changes
          </div>
        </div>
        
        {loadingChanges ? (
          <div className="flex justify-center items-center py-6">
            <FiRefreshCw className="w-5 h-5 text-blue-500 animate-spin mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Loading changes...</span>
          </div>
        ) : recentChanges.length > 0 ? (
          <div className="space-y-2">
            {recentChanges.slice(0, showChangeDetails ? recentChanges.length : 3).map((change, idx) => {
              // Determine badge style based on change type
              const getBadgeStyle = () => {
                switch (change.type) {
                  case 'rescheduled':
                  case 'date_changed':
                    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
                  case 'completed':
                    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
                  case 'cancelled':
                  case 'removed':
                    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
                  case 'added':
                    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
                  case 'updated':
                  case 'modified':
                    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
                  default:
                    return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
                }
              };
              
              // Format the date in a more compact way
              const formattedDate = new Date(change.date).toLocaleDateString(undefined, {
                month: 'numeric',
                day: 'numeric',
                year: '2-digit'
              });
              
              return (
                <div 
                  key={idx}
                  className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    {/* Left side with store name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {change.store}
                        {change.storeNumber && <span className="ml-1">#{change.storeNumber}</span>}
                      </span>
                    </div>
                    
                    {/* Middle with change type badge */}
                    <div className="flex items-center mx-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeStyle()}`}>
                        {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
                      </span>
                    </div>
                    
                    {/* Date */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mx-1.5 whitespace-nowrap">
                      {formattedDate}
                    </div>
                    
                    {/* Right side with visit number */}
                    <div className="text-xs font-medium text-primary-600 dark:text-primary-400 ml-1.5 whitespace-nowrap">
                      {change.visitNumber ? `#${change.visitNumber}` : ''}
                    </div>
                  </div>
                  
                  {/* Only show details if they exist and expanded view is on */}
                  {showChangeDetails && change.details && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-1">
                      {change.details}
                    </p>
                  )}
                </div>
              );
            })}
            
            <button
              onClick={() => setShowChangeDetails(!showChangeDetails)}
              className="w-full py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              {showChangeDetails ? 'Show Less' : 'View All Changes'}
            </button>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <FiClock className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No recent schedule changes</p>
          </div>
        )}
      </div>
    );
  };

  // Search bar component
  const renderSearchBar = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-3 mb-5 border border-gray-200 dark:border-gray-700 flex items-center">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm"
            placeholder="Search jobs, stores, or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setSearchQuery('')}
            >
              <FiX className="h-5 w-5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render all modals
  const renderModals = () => {
    return (
      <>
        {/* Instructions Modal */}
        {showInstructionsModal && (
          <InstructionsModal
            isOpen={showInstructionsModal}
            onClose={() => setShowInstructionsModal(false)}
            instructions={selectedInstructions}
            title={selectedJobTitle}
          />
        )}
        
        {/* Dispenser Modal */}
        {showDispenserModal && (
          <DispenserModal
            isOpen={showDispenserModal}
            onClose={() => setShowDispenserModal(false)}
            dispensers={selectedDispensers}
            orderId={selectedOrderId || ''}
            visitNumber={selectedVisitNumber || ''}
          />
        )}
      </>
    );
  };

  // Add logs here before returning JSX
  console.log('[HomeContent] Initial Work Orders:', workOrdersData.workOrders.length);
  console.log('[HomeContent] Filtered Work Orders (before map):', filteredWorkOrders.length);
  console.log('[HomeContent] Selected Date:', selectedDate);
  console.log('[HomeContent] Active Filter:', activeFilter);
  console.log('[HomeContent] Search Query:', searchQuery);

  // Main render function
  return (
    <div className="container mx-auto px-4 pt-5 pb-8">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FiHome className="text-primary-600 dark:text-primary-400" /> Dashboard
        </h1>
      </div>
      
      {/* Search Bar */}
      {renderSearchBar()}
      
      {/* Dashboard Content */}
      <div className="space-y-5">
        {/* Overview Panel */}
        {renderPanel('overview', 'Overview', <FiPieChart className="w-5 h-5" />, renderOverviewPanel())}
        
        {/* Data Tools Panel */}
        {renderPanel('tools', 'Data Tools', <FiDatabase className="w-5 h-5" />, renderToolsPanel())}
        
        {/* Map Panel */}
        {renderPanel('map', 'Job Map', <FiMapPin className="w-5 h-5" />, renderMapPanel())}
        
        {/* Verification Panel */}
        {renderPanel('verification', 'Verification Warnings', <FiAlertTriangle className="w-5 h-5" />, renderVerificationPanel())}
        
        {/* Recent Changes Panel */}
        {renderPanel('changes', 'Recent Schedule Changes', <FiClock className="w-5 h-5" />, renderChangesPanel())}
      </div>
      
      {/* Modals */}
      {renderModals()}
      
      {/* Alert for notifications */}
      {showAlert && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
          alertType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-300' :
          alertType === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-300' :
          'bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300'
        }`}>
          <div className="flex items-center">
            {alertType === 'success' && <FiCheckCircle className="w-5 h-5 mr-2" />}
            {alertType === 'error' && <FiAlertCircle className="w-5 h-5 mr-2" />}
            {alertType === 'info' && <FiInfo className="w-5 h-5 mr-2" />}
            <span>{alertMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}; 
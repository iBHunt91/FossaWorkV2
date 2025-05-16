import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FiActivity, 
  FiAlertTriangle,
  FiCalendar,
  FiClock, 
  FiDatabase,
  FiExternalLink, 
  FiFileText, 
  FiFilter,
  FiInfo,
  FiList,
  FiMapPin,
  FiPieChart,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { useNavigate } from 'react-router-dom';
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
import { SkeletonDashboardStats, SkeletonJobsList } from '../components/Skeleton';
import fuelGrades from '../data/fuel_grades';

// Type definitions
type ViewType = 'weekly' | 'calendar' | 'compact';
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
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
};

interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
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
} 
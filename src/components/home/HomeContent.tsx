import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FiHome, 
  FiPieChart, 
  FiDatabase, 
  FiFilter, 
  FiAlertTriangle, 
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiPlusCircle,
  FiTrash2,
  FiArrowRight
} from 'react-icons/fi';
import FilterVerificationPanel from './FilterVerificationPanel';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  clearDispenserData, 
  forceRescrapeDispenserData, 
  getDispenserScrapeStatus, 
  getWorkOrders, 
  startDispenserScrapeJob, 
  startScrapeJob 
} from '../../services/scrapeService';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { useDispenserData } from '../../context/DispenserContext';
import { useScrapeStatus } from '../../context/ScrapeContext';
import { usePersistentViewContext } from '../PersistentView';
import { WorkOrder } from '../../types/workOrder';
import { ChangeRecord, ChangeItem } from '../../types/ChangeHistory';
import { ExtendedFilterWarning } from '../../types/FilterWarning';
import { calculateFiltersForWorkOrder, determineWarningSeverity } from '../../utils/filterCalculation';
import { SkeletonDashboardStats } from '../Skeleton';

// Component imports
import Panel from './Panel';
import SearchBar from './SearchBar';
import OverviewPanel from './OverviewPanel';
import ToolsPanel from './ToolsPanel';
import FilterBreakdownPanel from './FilterBreakdownPanel';
import VerificationPanel from './VerificationPanel';
import ChangesPanel from './ChangesPanel';
import DispenserModal from '../DispenserModal';
import InstructionsModal from '../InstructionsModal';
// Import utilities from separate file
import HomeUtils from './HomeUtils';

// Type definitions for component-specific types
interface FilterNeedType {
  partNumber: string;
  type: string;
  quantity: number;
  stores: string[];
  orderId?: string;
  filterType?: string;
}

interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

// Interface for the daily distribution data structure
interface DailyDistributionType {
  [key: string]: number[];
}

type ViewType = 'weekly' | 'calendar' | 'compact';
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

// Helper function to render appropriate icon for change type
const renderChangeIcon = (type: string) => {
  switch (type) {
    case 'added':
      return <FiPlusCircle className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />;
    case 'removed':
      return <FiTrash2 className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />;
    case 'date_changed':
    case 'modified':
      return <FiClock className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />;
    case 'replacement':
      return <FiArrowRight className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5" />;
    default:
      return <FiInfo className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />;
  }
};

// Function to extract visit number from job ID
const extractVisitNumber = (jobId: string | undefined): string => {
  if (!jobId) return '';
  const match = jobId.match(/\d+$/);
  return match ? match[0] : jobId;
};

// Function to render change details in a compact format
const renderChangeDetails = (change: ChangeItem) => {
  if (!change || !change.type) {
    return <span className="text-gray-500 dark:text-gray-400 italic">Invalid change data</span>;
  }
  
  switch (change.type) {
    case 'removed':
      return (
        <span className="text-sm">
          <span className="text-red-600 dark:text-red-400 font-medium">Removed:</span> Visit #{extractVisitNumber(change.jobId)}
          {change.storeName && <span> at {change.storeName}</span>}
        </span>
      );
    
    case 'added':
      return (
        <span className="text-sm">
          <span className="text-green-600 dark:text-green-400 font-medium">Added:</span> Visit #{extractVisitNumber(change.jobId)}
          {change.storeName && <span> at {change.storeName}</span>}
        </span>
      );
    
    case 'date_changed':
      return (
        <span className="text-sm">
          <span className="text-blue-600 dark:text-blue-400 font-medium">Rescheduled:</span> Visit #{extractVisitNumber(change.jobId)}
          {change.storeName && <span> at {change.storeName}</span>}
          {change.oldDate && change.newDate && (
            <span className="ml-1 font-medium">
              {format(new Date(change.oldDate), 'MM/dd')} → {format(new Date(change.newDate), 'MM/dd')}
            </span>
          )}
        </span>
      );
    
    case 'replacement':
      return (
        <span className="text-sm">
          <span className="text-purple-600 dark:text-purple-400 font-medium">Replaced:</span> Visit #{extractVisitNumber(change.removedJobId)}
          {change.removedStoreName && <span> at {change.removedStoreName}</span>}
          <span className="ml-1">with #{extractVisitNumber(change.jobId)}</span>
        </span>
      );
    
    default:
      return (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {change.type}: {change.jobId || ''}
        </span>
      );
  }
};

const HomeContent: React.FC = () => {
  // Debug counter for tracking re-renders
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  
  // Log render counts
  useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;
    
    console.log(`===== HomeContent RENDER #${renderCountRef.current} =====`);
    console.log(`Time since last render: ${timeSinceLastRender}ms`);
    
    // Detect potential render loops
    if (renderCountRef.current > 10 && timeSinceLastRender < 100) {
      console.error('POSSIBLE RENDER LOOP DETECTED! Multiple renders in quick succession.');
    }
  });
  
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { dispenserData } = useDispenserData();
  const { 
    workOrderStatus: scrapeWorkOrdersStatus, 
    dispenserStatus: scrapeDispensersStatus,
    updateScrapeStatus
  } = useScrapeStatus();

  // State
  const [loading, setLoading] = useState(true);
  const [workOrdersData, setWorkOrdersData] = useState<{ workOrders: WorkOrder[] }>({ workOrders: [] });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    overview: true,
    tools: true,
    filters: true,
    verification: true,
    changes: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<StoreFilter>('all');
  const [consoleHeight, setConsoleHeight] = useState(300);
  const [recentChanges, setRecentChanges] = useState<ChangeRecord[]>([]);
  const [changeHistoryLoading, setChangeHistoryLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');
  const [showAlert, setShowAlert] = useState(false);
  const [filterWarnings, setFilterWarnings] = useState<ExtendedFilterWarning[]>([]);
  const [filterNeeds, setFilterNeeds] = useState<FilterNeedType[]>([]);
  
  // Modal state
  const [showDispenserModal, setShowDispenserModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [selectedDispensers, setSelectedDispensers] = useState<any[]>([]);
  const [selectedInstructions, setSelectedInstructions] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedVisitNumber, setSelectedVisitNumber] = useState<string | null>(null);
  const [selectedJobTitle, setSelectedJobTitle] = useState('');

  // Persistent view context for persisting view state across navigation
  const persistentViewContext = usePersistentViewContext();

  // Date ranges for current and next work week
  const dateRanges = useMemo(() => 
    HomeUtils.getWorkWeekDateRanges(1, 5, selectedDate), 
    [selectedDate]
  );

  // Filter work orders based on search query and active filter
  const filteredWorkOrders = useMemo(() => {
    if (!workOrdersData.workOrders) return [];
    
    return workOrdersData.workOrders.filter(order => {
      const matchesSearch = searchQuery 
        ? HomeUtils.getDisplayName(order).toLowerCase().includes(searchQuery.toLowerCase()) 
        : true;
      
      const matchesFilter = activeFilter === 'all' 
        ? true 
        : HomeUtils.getStoreTypeForFiltering(order) === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [workOrdersData.workOrders, searchQuery, activeFilter]);

  // Calculate category counts based on filtered work orders
  const categoryCounts = useMemo(() => 
    HomeUtils.calculateCategoryCounts(filteredWorkOrders), 
    [filteredWorkOrders]
  );

  // Calculate store distribution
  const storeDistribution = useMemo(() => 
    HomeUtils.calculateStoreDistribution(filteredWorkOrders), 
    [filteredWorkOrders]
  );

  // Calculate daily distribution
  const dailyDistribution = useMemo((): { currentWeek: DailyDistributionType; nextWeek: DailyDistributionType } => {
    // Make sure to pass date ranges to properly filter jobs
    const result = HomeUtils.calculateDistribution(
      filteredWorkOrders, 
      dateRanges.currentWeekStart, 
      dateRanges.currentWeekEnd, 
      dateRanges.nextWeekStart, 
      dateRanges.nextWeekEnd
    );
    
    // Ensure the result has the correct structure
    return {
      currentWeek: result.currentWeek || {},
      nextWeek: result.nextWeek || {}
    };
  }, [filteredWorkOrders, dateRanges]);
  
  // Track filteredWorkOrders and dateRanges changes to detect potential loops
  const prevFilteredWorkOrdersRef = useRef<WorkOrder[]>([]);
  const prevDateRangesRef = useRef(dateRanges);
  const filterCalcCountRef = useRef(0);
  
  // Filter work orders based on date ranges for components that need it
  const dateFilteredWorkOrders = useMemo(() => {
    filterCalcCountRef.current += 1;
    
    // Anti-loop protection - limit recalculations per session
    const MAX_CALCULATIONS = 50;
    if (filterCalcCountRef.current > MAX_CALCULATIONS) {
      console.error(`Exceeded maximum filter calculations (${MAX_CALCULATIONS})! Using previous results to break potential loop.`);
      return prevFilteredWorkOrdersRef.current;
    }
    
    // Check if inputs have changed
    const filteredWorkOrdersChanged = prevFilteredWorkOrdersRef.current !== filteredWorkOrders;
    const dateRangesChanged = 
      prevDateRangesRef.current.currentWeekStart.getTime() !== dateRanges.currentWeekStart.getTime() ||
      prevDateRangesRef.current.currentWeekEnd.getTime() !== dateRanges.currentWeekEnd.getTime() ||
      prevDateRangesRef.current.nextWeekStart.getTime() !== dateRanges.nextWeekStart.getTime() ||
      prevDateRangesRef.current.nextWeekEnd.getTime() !== dateRanges.nextWeekEnd.getTime();
    
    console.log('===== dateFilteredWorkOrders calculation triggered =====');
    console.log(`Calculation #${filterCalcCountRef.current}`);
    console.log('Inputs changed:', {
      filteredWorkOrdersChanged,
      dateRangesChanged
    });
    console.log('Source filtered work orders count:', filteredWorkOrders?.length || 0);
    console.log('Date ranges:', {
      currentWeekStart: dateRanges.currentWeekStart.toISOString(),
      currentWeekEnd: dateRanges.currentWeekEnd.toISOString(),
      nextWeekStart: dateRanges.nextWeekStart.toISOString(),
      nextWeekEnd: dateRanges.nextWeekEnd.toISOString()
    });
    
    // Debug counters
    let totalProcessed = 0;
    let includedOrders = 0;
    let skippedDueToNoDate = 0;
    let skippedDueToDateRange = 0;
    let errorCount = 0;

    const result = filteredWorkOrders.filter(order => {
      totalProcessed++;
      try {
        // Try to get date from various possible locations in the WorkOrder object
        let jobDate = null;
        
        // First check visits.nextVisit.date if available
        if (order.visits?.nextVisit?.date) {
          jobDate = new Date(order.visits.nextVisit.date);
        }
        // Then try scheduledDate at top level
        else if (order.scheduledDate) {
          jobDate = new Date(order.scheduledDate);
        }
        // Try createdDate as fallback
        else if (order.createdDate) {
          jobDate = new Date(order.createdDate);
        }
        
        if (!jobDate) {
          skippedDueToNoDate++;
          return false;
        }
        
        // Include jobs within current week or next week
        const isInDateRange = (jobDate >= dateRanges.currentWeekStart && jobDate <= dateRanges.nextWeekEnd);
        
        if (isInDateRange) {
          includedOrders++;
        } else {
          skippedDueToDateRange++;
        }
        
        return isInDateRange;
      } catch (error) {
        errorCount++;
        console.error('Error filtering work order by date:', error);
        console.error('Problem order:', order.id);
        return false;
      }
    });
    
    console.log('Date filtering summary:', {
      totalProcessed,
      includedOrders,
      skippedDueToNoDate,
      skippedDueToDateRange,
      errorCount,
      resultCount: result.length
    });
    
    // Log some details of included orders for debugging
    if (result.length > 0) {
      console.log('First included order:', {
        id: result[0].id,
        scheduledDate: result[0].scheduledDate,
        nextVisitDate: result[0].visits?.nextVisit?.date,
        hasDispensers: result[0].dispensers && result[0].dispensers.length > 0,
        dispenserCount: result[0].dispensers?.length
      });
    }
    
    // Update refs for next comparison
    prevFilteredWorkOrdersRef.current = result;
    prevDateRangesRef.current = dateRanges;
    
    return result;
  }, [filteredWorkOrders, dateRanges]);

  // Load data when component mounts
  useEffect(() => {
    // Create an abort controller for cleanup
    const abortController = new AbortController();
    console.log('===== HomeContent component mounted =====');
    console.log('Initial state - loading:', loading);
    console.log('Initial state - workOrdersData:', workOrdersData);
    console.log('Date ranges:', dateRanges);

    async function fetchAllData() {
      console.log('Starting data fetch sequence');
      setLoading(true);
      setChangeHistoryLoading(true);

      try {
        // Load work orders first
        console.log('Calling loadData() for work orders');
        const workOrdersResult = await loadData();
        console.log('loadData() result:', workOrdersResult?.workOrders?.length || 0, 'orders');

        // Then load change history data
        if (!abortController.signal.aborted) {
          try {
            console.log('Fetching change history data');
            const changes = await HomeUtils.fetchChangeHistoryData();
            console.log('Change history data received:', changes?.length || 0, 'changes');
            setRecentChanges(changes);
          } catch (error) {
            console.error('Error loading change history:', error);
            // Fallback already handled in the HomeUtils function
          }
        }
      } catch (error) {
        console.error('Error in data loading sequence:', error);
        addToast('error', 'Failed to load dashboard data. Please try again.');
      } finally {
        if (!abortController.signal.aborted) {
          console.log('Completing data fetch sequence - setting loading states to false');
          setChangeHistoryLoading(false);
          setLoading(false);
        }
      }
    }

    fetchAllData();

    // Cleanup function
    return () => {
      console.log('===== HomeContent component unmounting =====');
      abortController.abort();
    };
  }, [addToast, dateRanges]); // Added dateRanges to dependencies to track date-related refreshes

  // Generate filter warnings when work orders or dispenser data changes
  useEffect(() => {
    console.log('===== Filter generation effect triggered =====');
    console.log('Filtered work orders count:', dateFilteredWorkOrders?.length || 0);
    console.log('dispenser data available:', !!dispenserData);
    
    const filteredOrderIds = dateFilteredWorkOrders ? dateFilteredWorkOrders.map(o => o.id).join(',') : 'none';
    console.log('Current filtered order IDs:', filteredOrderIds.substring(0, 100) + (filteredOrderIds.length > 100 ? '...' : ''));
    
    // Add debounce/throttle to prevent rapid re-renders
    const timeoutId = setTimeout(() => {
      try {
        // Only process if we have work orders
        if (dateFilteredWorkOrders && dateFilteredWorkOrders.length > 0) {
          console.log('Starting filter generation for', dateFilteredWorkOrders.length, 'work orders');
          
          // Generate warnings using the verification panel logic
          console.time('generateWarningsFromWorkOrders');
          const warnings = generateWarningsFromWorkOrders(dateFilteredWorkOrders, dispenserData);
          console.timeEnd('generateWarningsFromWorkOrders');
          console.log('Generated', warnings.length, 'filter warnings');
          setFilterWarnings(warnings);
          
          // Generate filter needs
          console.time('generateFilterNeeds');
          const filterNeeds = generateFilterNeeds(dateFilteredWorkOrders);
          console.timeEnd('generateFilterNeeds');
          console.log('Generated', filterNeeds.length, 'filter needs');
          setFilterNeeds(filterNeeds);
          
          console.log('Filter generation completed successfully');
        } else {
          // Reset filter warnings and needs if no work orders
          console.log('No filtered work orders, resetting filter data');
          setFilterWarnings([]);
          setFilterNeeds([]);
        }
      } catch (error) {
        console.error('Error in filter generation effect:', error);
        console.error('Error stack:', error.stack);
        // Set default empty values to prevent UI issues
        setFilterWarnings([]);
        setFilterNeeds([]);
      }
    }, 100); // Small delay to prevent excessive processing
    
    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
    };
  }, [dateFilteredWorkOrders, dispenserData]);

  // Function to generate warnings from work orders
  const generateWarningsFromWorkOrders = (workOrders: WorkOrder[], dispenserData: any): ExtendedFilterWarning[] => {
    const warnings: ExtendedFilterWarning[] = [];
    
    workOrders.forEach(order => {
      try {
        // Calculate filter warnings for this order using imported utility
        const result = HomeUtils.calculateFiltersSafely(order);
        const orderWarnings = Array.isArray(result) ? result : [];
        
        // Convert basic warnings to extended warnings with additional data
        orderWarnings.forEach((warning: any) => {
          warnings.push({
            ...warning,
            orderId: order.id,
            storeName: HomeUtils.getDisplayName(order),
            severity: warning.severity || 'medium'
          });
        });
      } catch (error) {
        console.error('Error calculating filter warnings for order:', order.id, error);
      }
    });
    
    return warnings;
  };

  // Function to generate filter needs from work orders
  const generateFilterNeeds = (workOrders: WorkOrder[]): FilterNeedType[] => {
    const filterNeeds: FilterNeedType[] = [];
    const filterMap: Record<string, FilterNeedType> = {};

    workOrders.forEach(order => {
      const { hasDEF, hasDieselHighFlow } = HomeUtils.checkForSpecialFuelTypes(order);
      const filterWarningsResult = HomeUtils.calculateFiltersSafely(order);
      const filterWarnings = Array.isArray(filterWarningsResult) ? filterWarningsResult : [];

      // Handle possible array of filterWarnings
      if (filterWarnings && Array.isArray(filterWarnings) && filterWarnings.length > 0) {
        filterWarnings.forEach((warning: any) => {
          if (warning.partNumber) {
            const partNumber = warning.partNumber;
            const storeName = HomeUtils.getDisplayName(order);
            let filterType = '';

            if (partNumber.includes('PCP')) {
              filterType = 'premierplus';
            } else if (partNumber.includes('PCN')) {
              filterType = 'phasecoalescer';
            } else if (hasDEF && partNumber.includes('DEF')) {
              filterType = 'def';
            } else {
              filterType = 'particulate';
            }

            const key = `${partNumber}-${filterType}`;
            if (filterMap[key]) {
              filterMap[key].quantity += 1;
              if (!filterMap[key].stores.includes(storeName)) {
                filterMap[key].stores.push(storeName);
              }
            } else {
              filterMap[key] = {
                partNumber,
                type: filterType,
                quantity: 1,
                stores: [storeName],
                orderId: order.id,
                filterType
              };
            }
          }
        });
      }
    });

    return Object.values(filterMap);
  };

  // Show an alert message
  const showAlertMessage = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  };

  // Load data from API
  const loadData = async (forceRefreshDispenser = false) => {
    console.log('===== loadData called =====');
    console.log('forceRefreshDispenser:', forceRefreshDispenser);
    
    try {
      console.log('Calling getWorkOrders API');
      const startTime = Date.now();
      const result = await getWorkOrders();
      const endTime = Date.now();
      console.log(`getWorkOrders API completed in ${endTime - startTime}ms`);
      console.log('Work order data received:', result?.workOrders?.length || 0, 'orders');
      
      // Check if we have valid data
      if (result && result.workOrders && Array.isArray(result.workOrders)) {
        console.log('Valid work orders array received, setting state');
        // Log first order as sample
        if (result.workOrders.length > 0) {
          console.log('Sample order:', {
            id: result.workOrders[0].id,
            scheduledDate: result.workOrders[0].scheduledDate,
            hasDispensers: result.workOrders[0].dispensers && result.workOrders[0].dispensers.length > 0,
            customer: result.workOrders[0].customer
          });
        }
        
        setWorkOrdersData(result);
        console.log('workOrdersData state updated');
        return result;
      } else {
        console.warn('Invalid response format or empty work orders array');
        console.log('Raw result:', result);
        
        // If result exists but workOrders is empty, use it anyway to prevent crashes
        if (result) {
          console.log('Using partial result with empty workOrders array');
          setWorkOrdersData({ ...result, workOrders: result.workOrders || [] });
          return result;
        } else {
          console.error('No result data available');
          throw new Error('Invalid response format');
        }
      }
    } catch (error) {
      console.error('Error loading work orders:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      addToast(
        'error', 
        'Failed to load work order data. Please try again.'
      );
      // Return a default structure to prevent crashes
      console.log('Returning empty workOrders array as fallback');
      return { workOrders: [] };
    }
  };

  // Handle scrape work orders
  const handleScrapeWorkOrders = async () => {
    try {
      // We can't directly update the status through context, so we'll use
      // the API call that will trigger status updates
      await startScrapeJob();
      
      // Manually fetch updated data
      loadData();
      showAlertMessage('Work orders scraped successfully!', 'success');
      await updateScrapeStatus();
    } catch (error) {
      console.error('Error scraping work orders:', error);
      showAlertMessage('Failed to scrape work orders.', 'error');
    }
  };

  // Handle scrape dispenser data
  const handleScrapeDispenserData = async () => {
    try {
      // We can't directly update the status through context, so we'll use
      // the API call that will trigger status updates
      await startDispenserScrapeJob();
      
      // Manually fetch updated data
      loadData(true);
      showAlertMessage('Dispenser data scraped successfully!', 'success');
      await updateScrapeStatus();
    } catch (error) {
      console.error('Error scraping dispenser data:', error);
      showAlertMessage('Failed to scrape dispenser data.', 'error');
    }
  };

  // View dispenser data handler
  const handleViewDispenserData = (order: WorkOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!order.dispensers || order.dispensers.length === 0) {
      showAlertMessage('No dispenser data available. Try scraping dispenser data first.', 'info');
      return;
    }
    
    setSelectedDispensers(order.dispensers);
    setSelectedOrderId(order.id);
    setSelectedVisitNumber(HomeUtils.extractVisitNumber(order));
    setShowDispenserModal(true);
  };

  // Clear dispenser data handler
  const handleClearDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Pass orderId to clearDispenserData as required by its signature
      await clearDispenserData(orderId);
      // Pass true to force refreshing dispenser data
      loadData(true);
      showAlertMessage('Dispenser data cleared successfully.', 'success');
    } catch (error) {
      console.error('Error clearing dispenser data:', error);
      showAlertMessage('Failed to clear dispenser data.', 'error');
    }
  };

  // Force rescrape dispenser data
  const handleForceRescrapeDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      showAlertMessage('Starting dispenser rescrape...', 'info');
      await forceRescrapeDispenserData(orderId);
      
      // Start polling for status
      const startPolling = async () => {
        let completed = false;
        let attempts = 0;
        
        while (!completed && attempts < 30) {
          attempts++;
          try {
            // Call without arguments as the function doesn't expect any
            const status = await getDispenserScrapeStatus();
            
            if (status.status === 'completed') {
              completed = true;
              loadData(true);
              showAlertMessage('Dispenser data rescrape completed!', 'success');
            } else if (status.status === 'error') {
              completed = true;
              showAlertMessage('Error scraping dispenser data: ' + status.message, 'error');
            } else {
              // Still in progress
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error('Error checking dispenser scrape status:', error);
            completed = true;
            showAlertMessage('Failed to check dispenser scrape status.', 'error');
          }
        }
        
        if (!completed) {
          showAlertMessage('Dispenser scrape is taking longer than expected. Check back later.', 'info');
        }
      };
      
      startPolling();
    } catch (error) {
      console.error('Error forcing dispenser rescrape:', error);
      showAlertMessage('Failed to force dispenser rescrape.', 'error');
    }
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  // Toggle panel expanded state
  const togglePanel = (panelId: string) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panelId]: !prev[panelId]
    }));
  };

  // Open WorkFossa website with login
  const openWorkFossaWithLogin = (targetUrl = 'https://app.workfossa.com') => {
    // Implementation would depend on how authentication is handled
    window.open(targetUrl, '_blank');
  };

  // Handle view instructions
  const handleViewInstructions = (instructions: string, jobTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInstructions(instructions);
    setSelectedJobTitle(jobTitle);
    setShowInstructionsModal(true);
  };

  // Format date range for display
  const formatDateRange = (start: Date, end: Date) => {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  // Format change item text
  const formatChangeItem = (change: ChangeItem, timestamp: Date) => {
    // Handle based on the ChangeItem structure from ChangeHistory.ts
    return `Change occurred on ${format(timestamp, 'MMM d, yyyy h:mm a')}: ${change.type}`;
  };

  // Callback for processing warning severity
  const processSeverity = (warning: ExtendedFilterWarning) => {
    // Return a sensible default severity if the function is not available
    return warning.severity || 'medium';
  };

  // Daily distribution chart data
  const chartData = useMemo(() => {
    if (!dailyDistribution) return {};

    try {
      // Cast the dailyDistribution to ensure TypeScript understands the structure
      // Create a properly typed structure for the daily distribution data
      const currentWeek: Record<string, any[]> = dailyDistribution.currentWeek || {};
      const nextWeek: Record<string, any[]> = dailyDistribution.nextWeek || {};

      // Safe function to format dates with validation
      const safeFormatDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          // Check if date is valid
          if (isNaN(date.getTime())) {
            return dateStr; // Fallback to the original string if invalid
          }
          return format(date, 'EEE, MMM d');
        } catch (e) {
          return dateStr; // Fallback to the original string on error
        }
      };

      const currentWeekKeys = Object.keys(currentWeek);
      const nextWeekKeys = Object.keys(nextWeek);

      // Safety check for distribution data
      if (currentWeekKeys.length === 0 && nextWeekKeys.length === 0) {
        return {}; // Return empty object if no data available
      }

      return {
        labels: currentWeekKeys.map(safeFormatDate),
        datasets: [
          {
            label: 'Current Week',
            data: Object.values(currentWeek).map((counts) => counts?.length || 0),
            backgroundColor: `rgba(${isDarkMode ? '59, 130, 246' : '37, 99, 235'}, 0.8)`,
            borderColor: `rgba(${isDarkMode ? '59, 130, 246' : '37, 99, 235'}, 1)`,
            borderWidth: 1
          },
          {
            label: 'Next Week',
            data: Object.values(nextWeek).map((counts) => counts?.length || 0),
            backgroundColor: `rgba(${isDarkMode ? '147, 197, 253' : '96, 165, 250'}, 0.8)`,
            borderColor: `rgba(${isDarkMode ? '147, 197, 253' : '96, 165, 250'}, 1)`,
            borderWidth: 1
          }
        ]
      };
    } catch (error) {
      console.error('Error generating chart data:', error);
      return {}; // Return empty object on error
    }
  }, [dailyDistribution, isDarkMode]);

  return (
    <div className="container mx-auto px-4 pt-5 pb-8">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FiHome className="text-primary-600 dark:text-primary-400" /> Dashboard
        </h1>
      </div>
      
      {/* Search Bar */}
      <SearchBar 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
      />
      
      {/* Dashboard Content */}
      <div className="space-y-5">
        {/* Removed the Overview Panel as requested */}
        
        {/* Data Tools Panel */}
        <Panel 
          id="tools" 
          title="Data Tools" 
          icon={<FiDatabase className="w-5 h-5" />} 
          expanded={expandedPanels.tools} 
          onToggle={togglePanel}
        >
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Work Order Data</h3>
                <div className="flex flex-col space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Status: {scrapeWorkOrdersStatus?.status === 'running' ? 
                      <span className="text-yellow-600 dark:text-yellow-400">Updating...</span> : 
                      <span className="text-green-600 dark:text-green-400">Ready</span>}
                  </p>
                  <button
                    onClick={handleScrapeWorkOrders}
                    disabled={scrapeWorkOrdersStatus?.status === 'running'}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {scrapeWorkOrdersStatus?.status === 'running' ? 'Updating...' : 'Update Work Orders'}
                  </button>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Dispenser Data</h3>
                <div className="flex flex-col space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Status: {scrapeDispensersStatus?.status === 'running' ? 
                      <span className="text-yellow-600 dark:text-yellow-400">Updating...</span> : 
                      <span className="text-green-600 dark:text-green-400">Ready</span>}
                  </p>
                  <button
                    onClick={handleScrapeDispenserData}
                    disabled={scrapeDispensersStatus?.status === 'running'}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {scrapeDispensersStatus?.status === 'running' ? 'Updating...' : 'Update Dispenser Data'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <button
                onClick={() => openWorkFossaWithLogin()}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md text-sm w-full md:w-auto"
              >
                Open Work Fossa Dashboard
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                For detailed logs, visit the dedicated <a href="/logs" className="text-primary-600 dark:text-primary-400 hover:underline">Logs</a> section.
              </p>
            </div>
          </div>
        </Panel>
        
        {/* Filter Verification Panel (Combined) */}
        <Panel 
          id="filters" 
          title="Filters & Verification" 
          icon={<FiFilter className="w-5 h-5" />} 
          expanded={expandedPanels.filters} 
          onToggle={togglePanel}
        >
          <FilterVerificationPanel 
            workOrders={dateFilteredWorkOrders}
            dispenserData={dispenserData}
            loading={loading}
            dateRanges={dateRanges}
          />
        </Panel>
        
        {/* Distribution Panel */}
        <Panel 
          id="distribution" 
          title="Weekly Job Distribution" 
          icon={<FiPieChart className="w-5 h-5" />} 
          expanded={expandedPanels.distribution} 
          onToggle={togglePanel}
        >
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Job Distribution for Current and Next Week
            </h3>
            
            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Current Week */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Current Week</h4>
                  {Object.entries(dailyDistribution.currentWeek).map(([weekLabel, orders]) => (
                    <div key={weekLabel} className="relative pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block text-primary-600">{weekLabel}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold inline-block text-primary-600">{orders.length} jobs</span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-200 dark:bg-primary-900/30">
                        <div 
                          style={{ width: `${Math.min(100, (orders.length / 30) * 100)}%` }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500">
                        </div>
                      </div>
                      
                      {/* List of jobs in this week */}
                      {orders.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Job Details:</div>
                          {orders.map((order, index) => (
                            <div key={`${order.id}-${index}`} className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                              <span className="w-3 h-3 rounded-full bg-primary-400 mr-2"></span>
                              <span className="font-medium">{HomeUtils.getDisplayName(order)}</span>
                              <span className="ml-2 text-gray-500">
                                {order.scheduledDate ? format(new Date(order.scheduledDate), 'MM/dd/yyyy') : 
                                 order.visits?.nextVisit?.date ? format(new Date(order.visits.nextVisit.date), 'MM/dd/yyyy') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Next Week */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Next Week</h4>
                  {Object.entries(dailyDistribution.nextWeek).map(([weekLabel, orders]) => (
                    <div key={weekLabel} className="relative pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block text-indigo-600">{weekLabel}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold inline-block text-indigo-600">{orders.length} jobs</span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200 dark:bg-indigo-900/30">
                        <div 
                          style={{ width: `${Math.min(100, (orders.length / 30) * 100)}%` }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500">
                        </div>
                      </div>
                      
                      {/* List of jobs in next week */}
                      {orders.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Job Details:</div>
                          {orders.map((order, index) => (
                            <div key={`${order.id}-${index}`} className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                              <span className="w-3 h-3 rounded-full bg-indigo-400 mr-2"></span>
                              <span className="font-medium">{HomeUtils.getDisplayName(order)}</span>
                              <span className="ml-2 text-gray-500">
                                {order.scheduledDate ? format(new Date(order.scheduledDate), 'MM/dd/yyyy') : 
                                 order.visits?.nextVisit?.date ? format(new Date(order.visits.nextVisit.date), 'MM/dd/yyyy') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
        
        {/* Recent Changes Panel */}
        <Panel 
          id="changes" 
          title="Recent Schedule Changes" 
          icon={<FiClock className="w-5 h-5" />} 
          expanded={expandedPanels.changes} 
          onToggle={togglePanel}
        >
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Recent Changes (Current & Next Week Jobs Only)
            </h3>
            {changeHistoryLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading changes...</span>
              </div>
            ) : recentChanges.length === 0 ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md flex items-center">
                <FiInfo className="text-blue-500 dark:text-blue-400 mr-2" />
                <span className="text-blue-700 dark:text-blue-300">No recent changes found for current and next week jobs.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {recentChanges
                  // Filter to show only changes for current and next week jobs
                  .filter(record => {
                    // Check if it affects a job in current or next week timeframe
                    const date = record.timestamp ? new Date(record.timestamp) : null;
                    return date && date >= dateRanges.currentWeekStart && date <= dateRanges.nextWeekEnd;
                  })
                  .slice(0, 5) // Only show the 5 most recent changes for the dashboard
                  .map((record, index) => {
                    // Get change summary for the header
                    const summary = record.changes.summary || { added: 0, removed: 0, modified: 0, swapped: 0 };
                    const totalChanges = summary.added + summary.removed + summary.modified + (summary.swapped || 0);
                    
                    return (
                      <div
                        key={`change-${index}`}
                        className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-800 dark:text-white">
                            {format(new Date(record.timestamp), 'MMM d, yyyy h:mm a')}
                          </div>
                          <div className="flex space-x-2">
                            {summary.added > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200">
                                <FiPlusCircle className="w-3 h-3 mr-1" />
                                {summary.added}
                              </span>
                            )}
                            {summary.removed > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:bg-opacity-30 dark:text-red-200">
                                <FiTrash2 className="w-3 h-3 mr-1" />
                                {summary.removed}
                              </span>
                            )}
                            {summary.modified > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:bg-opacity-30 dark:text-blue-200">
                                <FiClock className="w-3 h-3 mr-1" />
                                {summary.modified}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                          {record.changes && Object.entries(record.changes).map(([key, items], i) => {
                            if (key === 'summary') return null;
                            // Check if items is an array before mapping
                            if (Array.isArray(items)) {
                              return items.slice(0, 3).map((item: any, j: number) => (
                                <div key={`${index}-${i}-${j}`} className="flex items-start">
                                  {renderChangeIcon(item.type)}
                                  <div className="ml-2">
                                    {renderChangeDetails(item)}
                                  </div>
                                </div>
                              ));
                            } else {
                              return null;
                            }
                          })}
                          {totalChanges > 3 && (
                            <div className="text-xs text-primary-600 dark:text-primary-400 mt-2 text-right">
                              + {totalChanges - 3} more changes
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        </Panel>
      </div>
      
      {/* Modals */}
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
          orderId={selectedOrderId || ''}
          visitNumber={selectedVisitNumber || ''}
        />
      )}
      
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

export default HomeContent;

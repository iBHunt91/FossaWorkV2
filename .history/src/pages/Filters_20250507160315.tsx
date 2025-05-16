import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  FiFilter, 
  FiDownload,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiAlertCircle,
  FiAlertTriangle,
  FiX,
  FiInfo,
  FiEdit,
  FiRefreshCw,
  FiChevronRight,
  FiChevronLeft,
  FiArrowUp,
  FiArrowDown,
  FiSearch,
  FiExternalLink,
  FiCheckCircle,
  FiSliders,
  FiCalendar,
  FiMapPin,
  FiTool,
  FiBox,
  FiBarChart2,
  FiGrid,
  FiEye,
  FiList
} from 'react-icons/fi';
import { CSVLink } from 'react-csv';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import scrapedData from '../data/scraped_content.json';
import DispenserModal from '../components/DispenserModal';
import { WorkOrder, FilterNeed } from '../types';
import { calculateFiltersForWorkOrder, FilterWarning } from '../utils/filterCalculation';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useDispenserData } from '../context/DispenserContext';
import { format, startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, subDays, addDays, isSameDay, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Add custom styles for the date picker
import "./datePickerStyles.css";

// Interface for date range calculation (imported from Home.tsx)
interface WorkWeekDateRanges {
  currentWeekStart: Date;
  currentWeekEnd: Date;
  nextWeekStart: Date;
  nextWeekEnd: Date;
}

// Helper function from Home.tsx to ensure consistent date calculations
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

// FilterDataType interface definition
interface FilterDataType {
  id: string;
  type: 'GAS' | 'DIESEL';
  quantity: number;
  visitDate: Date;
  store: string;
  visitId: string;
}

// Extended FilterNeed interface with additional properties we need
interface ExtendedFilterNeed extends FilterNeed {
  orderId: string;
  visitId: string;
  visitDate: string;
  storeName: string;
  filterType?: string;
}

// Extended FilterWarning interface with additional properties we need
interface ExtendedFilterWarning extends FilterWarning {
  partNumber?: string;
  message?: string;
  severity?: number;
  orderId?: string;
  storeName?: string;
}

// Define types for CSV data
interface CSVFilterSummary {
  'Part Number': string;
  'Type': string;
  'Quantity': number | string;
  'Boxes Needed': number | string;
  'Stores': string;
  'Warnings'?: string;
  'Visit ID'?: string;
  'Date'?: string;
}

// Extended Dispenser interface
interface Dispenser {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: Record<string, string>;
  html?: string;
}

// Station-specific filter part numbers
const STATION_FILTERS = {
  '7-Eleven': {
    GAS: {
      'Electronic': '400MB-10',
      'HD Meter': '400MB-10',
      'Ecometer': '40510A-AD',
      'default': '400MB-10'
    },
    DIESEL: {
      'Electronic': '400HS-10',
      'HD Meter': '400HS-10',
      'Ecometer': '40510W-AD',
      'default': '400HS-10'
    },
    DEF: '800HS-30' // Add DEF filter type for 7-Eleven
  },
  'Wawa': {
    GAS: '450MB-10',
    DIESEL: '450MG-10'
  },
  'Circle K': {
    GAS: '40510D-AD',
    DIESEL: '40530W-AD'
  }
};

// Debounce utility to prevent multiple rapid calls
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

// Correctly type the component as React.FC for React 18 compatibility
const FiltersRedesign: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { addToast } = useToast();
  const { dispenserData, loadDispenserData, isLoaded } = useDispenserData();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(scrapedData.workOrders);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterNeeds, setFilterNeeds] = useState<ExtendedFilterNeed[]>([]);
  const [filterWarnings, setFilterWarnings] = useState<Map<string, ExtendedFilterWarning[]>>(new Map());
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'visitId' | 'store' | 'date'; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dispenserToastShown, setDispenserToastShown] = useState(() => {
    return sessionStorage.getItem('dispenserToastShown') === 'true';
  });
  
  // Use ref to prevent recursive loading
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(Date.now());
  
  // Define default work week as Monday (1) to Friday (5)
  const workWeekStart = 1; // Monday
  const workWeekEnd = 5;   // Friday
  
  // Dispenser Modal States
  const [currentDispenserInfo, setCurrentDispenserInfo] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [currentDispenserData, setCurrentDispenserData] = useState<any[]>([]);
  const [hasDispenserInfo, setHasDispenserInfo] = useState(false);
  
  // Filter Type Selection
  const [selectedFilterType, setSelectedFilterType] = useState<string | null>(null);
  
  // Visualization
  const [showVisualization, setShowVisualization] = useState(false);

  // State variables
  const [filters, setFilters] = useState<FilterDataType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // State for tracking which filter need is being edited
  const [editingFilterNeed, setEditingFilterNeed] = useState<string | null>(null);
  const [editedQuantity, setEditedQuantity] = useState<number>(0);
  
  // Store edited quantities in localStorage to persist across refreshes
  const saveEditedQuantity = (orderId: string, partNumber: string, quantity: number) => {
    try {
      // Load existing edited quantities
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      const edits = storedEdits ? JSON.parse(storedEdits) : {};
      
      // Update the quantity for this specific order and part
      const key = `${orderId}_${partNumber}`;
      edits[key] = quantity;
      
      // Save back to localStorage
      localStorage.setItem('filterQuantityEdits', JSON.stringify(edits));
    } catch (error) {
      console.error('Error saving edited quantity to localStorage', error);
    }
  };
  
  // Load edited quantity from localStorage
  const getEditedQuantity = (orderId: string, partNumber: string, defaultQuantity: number | null): number | null => {
    try {
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      if (!storedEdits) return defaultQuantity;
      
      const edits = JSON.parse(storedEdits);
      const key = `${orderId}_${partNumber}`;
      return edits[key] !== undefined ? edits[key] : defaultQuantity;
    } catch (error) {
      console.error('Error loading edited quantity from localStorage', error);
      return defaultQuantity;
    }
  };
  
  // Load all edited quantities after filter needs are calculated
  useEffect(() => {
    if (filterNeeds.length === 0) return;
    
    try {
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      if (!storedEdits) return;
      
      const edits = JSON.parse(storedEdits);
      let hasUpdates = false;
      
      // Apply saved edits to the current filter needs
      const updatedNeeds = filterNeeds.map(need => {
        const key = `${need.orderId}_${need.partNumber}`;
        if (edits[key] !== undefined) {
          hasUpdates = true;
          return { ...need, quantity: edits[key] };
        }
        return need;
      });
      
      // Only update state if there were actually changes
      if (hasUpdates) {
        setFilterNeeds(updatedNeeds);
      }
    } catch (error) {
      console.error('Error applying saved quantity edits', error);
    }
  }, [filterNeeds.length]);
  
  // Function to clear all saved edits (reset to defaults)
  const clearAllSavedEdits = () => {
    try {
      localStorage.removeItem('filterQuantityEdits');
      
      // Reset all needs to their default quantities by recalculating
      // This requires a page reload to re-run all the filter calculations
      window.location.reload();
    } catch (error) {
      console.error('Error clearing saved quantity edits', error);
    }
  };
  
  // Handle keyboard shortcuts for admin functions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+Shift+R: Reset all saved filter quantities
      if (e.altKey && e.shiftKey && e.key === 'R') {
        if (window.confirm('Reset all edited filter quantities to calculated defaults?')) {
          clearAllSavedEdits();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Update selectedDateRange to use the same getWorkWeekDateRanges function as Home.tsx
  const [selectedDateRange, setSelectedDateRange] = useState<[Date, Date]>(() => {
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, new Date());
    return [dateRanges.currentWeekStart, dateRanges.currentWeekEnd];
  });
  
  const [dispenserInfoOpen, setDispenserInfoOpen] = useState<boolean>(false);
  const [selectedDispensers, setSelectedDispensers] = useState<string>('');
  const [dispenserHtml, setDispenserHtml] = useState<string>('');
  
  // Context for date format
  const dateFormat = "MMM d";
  const fullDateFormat = "MMM d, yyyy";
  
  // Format a range of dates for display
  const formatDateRange = (dateRange: [Date, Date]) => {
    // Get month and day for start and end dates
    const startMonth = dateRange[0].toLocaleDateString('en-US', { month: 'short' });
    const startDay = dateRange[0].getDate();
    const endMonth = dateRange[1].toLocaleDateString('en-US', { month: 'short' });
    const endDay = dateRange[1].getDate();
    const endYear = dateRange[1].getFullYear();
    
    // Different formats based on whether the month is the same
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  };
  
  // Week navigation functions using the consistent date calculation
  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
    
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, newDate);
    setSelectedDateRange([dateRanges.currentWeekStart, dateRanges.currentWeekEnd]);
  };
  
  const handleNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
    
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, newDate);
    setSelectedDateRange([dateRanges.currentWeekStart, dateRanges.currentWeekEnd]);
  };
  
  const goToCurrentWeek = () => {
    const today = new Date();
    setCurrentWeek(today);
    
    const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, today);
    setSelectedDateRange([dateRanges.currentWeekStart, dateRanges.currentWeekEnd]);
  };

  // Main useEffect for loading data
  useEffect(() => {
    // Only run this effect once when the component mounts
    const loadInitialData = async () => {
      if (isLoadingRef.current) {
        console.log('Initial data load already in progress, skipping');
        return;
      }
      
      console.log('Starting initial data load');
      isLoadingRef.current = true;
      setIsLoading(true);
      
      try {
        // First try to load data from the API
        const apiResponse = await fetch('/api/workorders');
        
        if (!apiResponse.ok) {
          throw new Error(`Failed to load work orders: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        console.log('Loaded work orders from API with', apiData.workOrders?.length || 0, 'work orders');
        
        // If API data is valid, use it
        if (apiData.workOrders && Array.isArray(apiData.workOrders)) {
          // Load dispenser data if not already loaded
          if (!isLoaded) {
            await loadDispenserData();
          }
          
          // Get the dispenser data and merge
          const currentDispenserData = dispenserData.dispenserData || {};
          const enhancedWorkOrders = apiData.workOrders.map((order: WorkOrder) => {
            if (currentDispenserData[order.id]) {
              const dispenserInfo = currentDispenserData[order.id] as { dispensers: Dispenser[] };
              const dispensers = dispenserInfo.dispensers || [];
              return { ...order, dispensers };
            }
            return order;
          });
          
          // Update the state with the merged data
          setWorkOrders(enhancedWorkOrders);
        } else {
          throw new Error('Invalid API data format');
        }
      } catch (error) {
        console.error('Error loading work order data:', error);
        
        try {
          // Fall back to local JSON file if API fails
          console.log('Trying to load local JSON file as fallback');
          const fileResponse = await fetch('/src/data/scraped_content.json');
          
          if (!fileResponse.ok) {
            throw new Error(`Failed to load local data: ${fileResponse.status}`);
          }
          
          const fileData = await fileResponse.json();
          console.log('Successfully loaded local JSON file with', fileData.workOrders?.length || 0, 'work orders');
          
          setWorkOrders(fileData.workOrders);
        } catch (localError) {
          console.error('Error loading local work order data:', localError);
          
          // Fall back to imported data if all else fails
          console.log('Using static imported data as final fallback');
          setWorkOrders(scrapedData.workOrders);
        }
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
        lastLoadTimeRef.current = Date.now();
      }
    };
    
    // Use a small timeout to ensure everything is properly initialized
    setTimeout(() => {
      loadInitialData();
    }, 100);
    
    // Empty dependency array means this only runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Listen for fossa-data-updated events to refresh data automatically
  useEffect(() => {
    // Create a local reference to avoid stale closure issues
    const currentLoadDispenserData = loadDispenserData;
    const currentDispenserData = dispenserData; // Capture current value for reference
    
    // Function to handle data reloading
    const reloadData = async () => {
      // Set the loading flag to prevent other calls
      if (isLoadingRef.current) {
        console.log('Data reload already in progress, skipping');
        return;
      }
      
      console.log('Reloading Filter data...');
      isLoadingRef.current = true;
      
      try {
        // Try loading from API first with cache prevention headers
        const apiResponse = await fetch('/api/workorders', {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store'
        });
        
        if (!apiResponse.ok) {
          throw new Error(`Failed to reload work orders: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (!apiData.workOrders || !Array.isArray(apiData.workOrders)) {
          throw new Error('Invalid API data format');
        }
        
        console.log('Successfully loaded work orders data with', apiData.workOrders.length, 'work orders');
        
        // Load fresh dispenser data without updating loading state
        await currentLoadDispenserData(true, false);
        
        // Create enhanced work orders with dispenser data - get fresh data from context
        const latestDispenserData = dispenserData.dispenserData || {};
        const enhancedWorkOrders = apiData.workOrders.map((order: WorkOrder) => {
          if (latestDispenserData[order.id]) {
            const dispenserInfo = latestDispenserData[order.id] as { dispensers: Dispenser[] };
            const dispensers = dispenserInfo.dispensers || [];
            return { ...order, dispensers };
          }
          return order;
        });
        
        // Update work orders state
        setWorkOrders(enhancedWorkOrders);
        
      } catch (error) {
        console.error('Error reloading work order data:', error);
        
        try {
          // Fall back to local file
          const fileResponse = await fetch('/src/data/scraped_content.json', {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            if (fileData.workOrders) {
              setWorkOrders(fileData.workOrders);
              console.log('Fallback: loaded data from local file');
            }
          }
        } catch (fallbackError) {
          console.error('Failed to load fallback data:', fallbackError);
        }
      } finally {
        // Reset the loading flag
        isLoadingRef.current = false;
        lastLoadTimeRef.current = Date.now();
      }
    };
    
    // Create a debounced version that only executes after 1 second of inactivity
    const debouncedReload = debounce(reloadData, 1000);
    
    // Event handler that uses the debounced reload function
    const handleDataUpdated = (event: CustomEvent) => {
      // Call the debounced function - it will only execute once even if called multiple times
      debouncedReload();
    };
    
    // Add event listener
    window.addEventListener('fossa-data-updated', handleDataUpdated as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('fossa-data-updated', handleDataUpdated as EventListener);
    };
  // Only depend on loadDispenserData which should be stable
  }, [loadDispenserData]);
  
  // Separate useEffect for toast notifications
  useEffect(() => {
    // Only show toast if it hasn't been shown yet during this session
    if (!dispenserToastShown && !isLoading && workOrders.length > 0) {
      const ordersWithDispensers = workOrders.filter(
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
  }, [isLoading, workOrders, dispenserToastShown, addToast]);

  // Determine weekend status based on current day
  const isWeekend = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentHour = today.getHours();
    // Check if today is weekend (Saturday or Sunday) or Friday after 5:00pm
    return dayOfWeek === 6 || dayOfWeek === 0 || (dayOfWeek === 5 && currentHour >= 17);
  }, []);

  // Memoize start and end of week
  const dateRanges = useMemo(() => {
    // Use the consistent getWorkWeekDateRanges function 
    return getWorkWeekDateRanges(workWeekStart, workWeekEnd, currentWeek);
  }, [currentWeek, workWeekStart, workWeekEnd]);
  
  // Create readable date range string for display
  const weekRangeText = useMemo(() => {
    return `${dateRanges.currentWeekStart.toLocaleDateString()} - ${dateRanges.currentWeekEnd.toLocaleDateString()}`;
  }, [dateRanges]);

  // Format date for display in a compact way
  const formatShortDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };
  
  // These functions are no longer needed as we replaced them with the ones above
  // that use getWorkWeekDateRanges
  const goToPreviousWeek = handlePreviousWeek;
  const goToNextWeek = handleNextWeek;
  
  // Format week label for the date picker
  const formatWeekLabel = (start: Date, end: Date) => {
    // Format dates like "Apr 15 - Apr 19"
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endDay = end.getDate();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  };
  
  // Get a formatted representation of the current work week
  const getWorkWeekLabel = (date: Date) => {
    // Use the consistent getWorkWeekDateRanges function
    const ranges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, date);
    return formatWeekLabel(ranges.currentWeekStart, ranges.currentWeekEnd);
  };

  // Function to parse instructions for specific dispenser jobs (code 2862)
  const parseSpecificDispenserInstructions = (instructions: string): number[] => {
    if (!instructions) return [];
    
    const dispenserNumbers: number[] = [];
    
    // Pattern 1: Look for paired dispenser numbers like #3/4 or #19/20
    const pairedPattern = /#(\d+)[\/-](\d+)/g;
    const pairedMatches = [...instructions.matchAll(pairedPattern)];
    
    pairedMatches.forEach(match => {
      if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
      if (match[2]) dispenserNumbers.push(parseInt(match[2], 10));
    });
    
    // Pattern 2: Look for regular dispenser numbers
    // Common patterns like "Dispensers 1, 2, 3" or "Specific Dispensers: 1,2,3" or "#1, #2, #3"
    const regularPattern = /(?:(?:[Dd]ispenserss?|[Dd]isp)(?:\s*:)?\s*(?:#?\s*\d+(?:\s*,\s*#?\s*\d+)*)|(?:#\s*\d+(?:\s*,\s*#?\s*\d+)*))/g;
    const regularMatches = instructions.match(regularPattern);
    
    if (regularMatches) {
      regularMatches.forEach(match => {
        // Extract all numbers from the match
        const numberMatches = match.match(/\d+/g);
        if (numberMatches) {
          numberMatches.forEach(num => {
            dispenserNumbers.push(parseInt(num, 10));
          });
        }
      });
    }
    
    // Pattern 3: Look for individual dispenser numbers preceded by # in any context
    const individualPattern = /#(\d+)(?![\/\-\d])/g;
    const individualMatches = [...instructions.matchAll(individualPattern)];
    
    individualMatches.forEach(match => {
      if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
    });
    
    return [...new Set(dispenserNumbers)]; // Remove duplicates and return
  };
  
  // Function to determine if a dispenser should be included based on specific dispenser instructions
  const shouldIncludeDispenser = (dispenserTitle: string | undefined, specificDispenserNumbers: number[]): boolean => {
    if (!dispenserTitle || !specificDispenserNumbers.length) return true; // Include if no title or no specific numbers
    
    // Extract the dispenser number(s) from the title (typically in format "X/Y - ...")
    const titleMatch = dispenserTitle.match(/^(\d+)[\/-](\d+)/);
    
    if (titleMatch && titleMatch[1] && titleMatch[2]) {
      const dispenser1 = parseInt(titleMatch[1]);
      const dispenser2 = parseInt(titleMatch[2]);
      
      // Include if either dispenser number is in the specific list
      return specificDispenserNumbers.includes(dispenser1) || 
             specificDispenserNumbers.includes(dispenser2);
    }
    
    return false; // If can't determine dispenser number, exclude
  };

  // Fix the useEffect that calculates filter needs
  useEffect(() => {
    // Only run when workOrders have been loaded and isLoading is false
    if (isLoading) return;

    // Process work orders and calculate filter needs
    const filteredOrders = workOrders.filter(order => {
      // Extract dates from visits
      const visits = order.visits || {};
      const visitData = Object.values(visits)[0] || {};
      const visitDateStr = visitData.date;
      
      if (!visitDateStr) return false;
      
      // Parse the date consistently using the same format as on Home page
      const visitDate = new Date(visitDateStr);
      visitDate.setHours(0, 0, 0, 0);
      
      // Use the selected date range for filtering
      return (
        (visitDate >= selectedDateRange[0] && visitDate <= selectedDateRange[1])
      );
    });
    
    // Calculate filter needs and warnings for each work order
    const needs: ExtendedFilterNeed[] = [];
    const warnings = new Map<string, ExtendedFilterWarning[]>();
    
    filteredOrders.forEach(order => {
      // Check if this is a "Specific Dispenser(s)" job (code 2862)
      const isSpecificDispensersJob = order.services?.some(
        service => service.code === "2862" || (service.description && service.description.includes("Specific Dispenser"))
      );
      
      let specificDispenserNumbers: number[] = [];
      
      // If specific dispenser job, parse the instructions to get dispenser numbers
      if (isSpecificDispensersJob && order.instructions) {
        specificDispenserNumbers = parseSpecificDispenserInstructions(order.instructions);
      }
      
      // Calculate filters based on dispensers, handling specific dispenser jobs differently
      let gasFilters = 0;
      let dieselFilters = 0;
      let filterWarnings: FilterWarning[] = [];
      
      if (isSpecificDispensersJob && specificDispenserNumbers.length > 0 && order.dispensers && order.dispensers.length > 0) {
        // For specific dispenser jobs, only count filters for the specified dispensers
        const specificDispensers = order.dispensers.filter(
          dispenser => shouldIncludeDispenser(dispenser.title, specificDispenserNumbers)
        );
        
        // Create a modified order with only the specific dispensers for calculation
        const modifiedOrder = {
          ...order,
          dispensers: specificDispensers
        };
        
        // Calculate filters using the utility function with the modified order
        const result = calculateFiltersForWorkOrder(modifiedOrder);
        gasFilters = result.gasFilters;
        dieselFilters = result.dieselFilters;
        filterWarnings = result.warnings;
      } else {
        // For regular jobs, calculate filters normally
        const result = calculateFiltersForWorkOrder(order);
        gasFilters = result.gasFilters;
        dieselFilters = result.dieselFilters;
        filterWarnings = result.warnings;
      }
      
      // Check if this job needs verification
      const needsVerification = filterWarnings.some(w => 
        (w.warning?.toLowerCase().includes('verify') || w.warning?.toLowerCase().includes('check')) ||
        order.services?.some(s => s.code === "2862")
      );
      
      // Determine station type
      const stationType = order.customer.name.includes('7-Eleven') || 
                         (order.rawHtml && (order.rawHtml.includes('Speedway') || 
                                          order.rawHtml.includes('Marathon'))) ? 
                         '7-Eleven' : 
                         order.customer.name.includes('Wawa') ? 'Wawa' : 'Circle K';
      
      // Map the gas/diesel filters to the specific part numbers for this station type
      let gasFilterPart: string;
      let dieselFilterPart: string;
      
      if (stationType === '7-Eleven') {
        // For 7-Eleven/Speedway/Marathon, filter depends on meter type
        const meterType = getMeterType(order);
        const meterTypeKey = meterType.includes('HD') ? 'HD Meter' : 
                             meterType.includes('Eco') ? 'Ecometer' : 'Electronic';
        
        gasFilterPart = STATION_FILTERS['7-Eleven'].GAS[meterTypeKey] || STATION_FILTERS['7-Eleven'].GAS.default;
        dieselFilterPart = STATION_FILTERS['7-Eleven'].DIESEL[meterTypeKey] || STATION_FILTERS['7-Eleven'].DIESEL.default;
        
        // Check for DEF at 7-Eleven
        const { hasDEF } = checkForSpecialFuelTypes(order);
        if (hasDEF) {
          // Extract visit information
          const visitData = Object.values(order.visits || {})[0] || {};
          const visitId = visitData.visitId || 'Unknown';
          const visitDate = visitData.date || new Date().toISOString();
          const storeName = order.customer.name || 'Unknown Store';
          
          // Add DEF filter need
          const defQuantity = getEditedQuantity(order.id, STATION_FILTERS['7-Eleven'].DEF, 1);
          needs.push({
            partNumber: STATION_FILTERS['7-Eleven'].DEF,
            type: 'DIESEL', // Use DIESEL type since DEF is a diesel product
            quantity: defQuantity, // Use persisted quantity if available
            stores: [storeName],
            stationType,
            orderId: order.id,
            visitId,
            visitDate,
            storeName,
            filterType: 'DEF' // Mark it as DEF in the filterType field
          } as ExtendedFilterNeed);
        }
      } else if (stationType === 'Wawa') {
        // For Wawa, use standard filters
        gasFilterPart = STATION_FILTERS['Wawa'].GAS;
        dieselFilterPart = STATION_FILTERS['Wawa'].DIESEL;
      } else {
        // For Circle K, always use the same filters
        gasFilterPart = STATION_FILTERS['Circle K'].GAS;
        dieselFilterPart = STATION_FILTERS['Circle K'].DIESEL;
      }
      
      // Extract visit information
      const visitData = Object.values(order.visits || {})[0] || {};
      const visitId = visitData.visitId || 'Unknown';
      const visitDate = visitData.date || new Date().toISOString();
      const storeName = order.customer.name || 'Unknown Store';
      
      // Add gas filters if needed
      if (gasFilters > 0) {
        // Use persisted quantity if available
        const persistedQuantity = getEditedQuantity(order.id, gasFilterPart, gasFilters);
        needs.push({
          partNumber: gasFilterPart,
          type: 'GAS',
          quantity: persistedQuantity,
          stores: [storeName],
          stationType,
          orderId: order.id,
          visitId,
          visitDate,
          storeName
        } as ExtendedFilterNeed);
      }
      
      // Add diesel filters if needed
      if (dieselFilters > 0) {
        // Use persisted quantity if available
        const persistedQuantity = getEditedQuantity(order.id, dieselFilterPart, dieselFilters);
        needs.push({
          partNumber: dieselFilterPart,
          type: 'DIESEL',
          quantity: persistedQuantity,
          stores: [storeName],
          stationType,
          orderId: order.id,
          visitId,
          visitDate,
          storeName
        } as ExtendedFilterNeed);
      }
      
      // For Circle K jobs that need verification, always add 40530W-AD filter option (even with 0 quantity)
      if (stationType === 'Circle K' && needsVerification) {
        // Check if this filter was already added above
        const hasSecondaryDieselFilter = needs.some(
          need => need.orderId === order.id && need.partNumber === '40530W-AD'
        );
        
        // Only add if not already present
        if (!hasSecondaryDieselFilter) {
          // Use persisted quantity if available, default to 0
          const persistedQuantity = getEditedQuantity(order.id, '40530W-AD', 0);
          needs.push({
            partNumber: '40530W-AD',
            type: 'DIESEL',
            quantity: persistedQuantity,
            stores: [storeName],
            stationType,
            orderId: order.id,
            visitId,
            visitDate,
            storeName
          } as ExtendedFilterNeed);
        }
      }
      
      // Store warnings if any
      if (filterWarnings.length > 0) {
        // Convert to ExtendedFilterWarning
        const extendedWarnings = filterWarnings.map(warning => ({
          ...warning,
          message: warning.warning // Map warning to message
        })) as ExtendedFilterWarning[];
        warnings.set(order.id, extendedWarnings);
      }
      
      // If no filters were detected but this job is in our date range,
      // add a placeholder entry to ensure the job appears on the filters page
      if (gasFilters === 0 && dieselFilters === 0) {
        // Check if DEF is present first
        const { hasDEF } = checkForSpecialFuelTypes(order);
        
        // Only add placeholder if no filters detected and no DEF
        if (!hasDEF) {
          // Look in the job's data to determine the most likely filter type
          const isGasOrder = order.instructions?.toLowerCase().includes('gas') || 
                           order.instructions?.toLowerCase().includes('gasoline');
          const isDieselOrder = order.instructions?.toLowerCase().includes('diesel');
          
          // Determine most appropriate default filter type based on job data
          let defaultFilterPart: string;
          let defaultFilterType: 'GAS' | 'DIESEL';
          
          if (isDieselOrder && !isGasOrder) {
            defaultFilterPart = dieselFilterPart;
            defaultFilterType = 'DIESEL';
          } else {
            // Default to gas if unclear or both
            defaultFilterPart = gasFilterPart;
            defaultFilterType = 'GAS';
          }
          
          // Add a placeholder entry with quantity 0 to ensure the job appears
          const persistedQuantity = getEditedQuantity(order.id, defaultFilterPart, 0);
          needs.push({
            partNumber: defaultFilterPart,
            type: defaultFilterType,
            quantity: persistedQuantity, // Use persisted quantity if available
            stores: [storeName],
            stationType,
            orderId: order.id,
            visitId,
            visitDate,
            storeName,
            filterType: 'Unknown' // Mark as unknown filter type
          } as ExtendedFilterNeed);
        }
      }
    });
    
    setFilterNeeds(needs);
    setFilterWarnings(warnings);
  }, [workOrders, isLoading, selectedDateRange]);

  // Format date for display
  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();
    
    if (isToday) {
      return (
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-2 py-0.5 rounded-full text-center">Today</span>
          <span className="text-sm mt-1 text-gray-700 dark:text-gray-300">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      );
    }
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    
    return (
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{dayName}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{month} {day}</span>
      </div>
    );
  }, []);

  // Handle sort
  const handleSort = (key: 'visitId' | 'store' | 'date') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSortConfig(null);
    setCurrentWeek(new Date());
    setSelectedFilterType(null);
  };

  // Get meter type for a work order
  const getMeterType = (order: WorkOrder): string => {
    // Check if the work order has a meter type listed in the instructions
    const instructions = order.instructions?.toLowerCase() || '';
    
    if (instructions.includes('electronic meter') || instructions.includes('electronics')) {
      return 'Electronic';
    } else if (instructions.includes('hd meter')) {
      return 'HD Meter';
    } else if (instructions.includes('ecometer')) {
      return 'Ecometer';
    }
    
    // If no meter type is found in instructions, check the services
    const services = order.services || [];
    for (const service of services) {
      const description = service.description?.toLowerCase() || '';
      
      if (description.includes('electronic meter')) {
        return 'Electronic';
      } else if (description.includes('hd meter')) {
        return 'HD Meter';
      } else if (description.includes('ecometer')) {
        return 'Ecometer';
      }
    }
    
    // Default to "Unknown" if meter type can't be determined
    return 'Unknown';
  };

  // Calculate total quantity for a specific filter type
  const getTotalQuantity = (partNumber: string) => {
    return filterNeeds
      .filter(need => need.partNumber === partNumber)
      .reduce((sum, need) => sum + need.quantity, 0);
  };

  // Get all unique filter types
  const getAllFilterTypes = () => {
    return [...new Set(filterNeeds.map(need => need.partNumber))];
  };

  // Calculate boxes needed for a quantity
  const getBoxesNeeded = (quantity: number) => {
    return Math.ceil(quantity / 12); // Assuming 12 filters per box
  };

  // Calculate total boxes needed
  const getTotalBoxesNeeded = () => {
    return getAllFilterTypes().reduce((sum, type) => {
      return sum + getBoxesNeeded(getTotalQuantity(type));
    }, 0);
  };

  // Get total number of filters needed
  const getTotalFiltersNeeded = () => {
    return filterNeeds.reduce((sum, need) => sum + need.quantity, 0);
  };

  // Prepare data for CSV export
  const prepareCSVData = () => {
    const csvData: CSVFilterSummary[] = [];
    
    // Group by part number
    const groupedByPartNumber = new Map<string, ExtendedFilterNeed[]>();
    
    filterNeeds.forEach(need => {
      if (!groupedByPartNumber.has(need.partNumber)) {
        groupedByPartNumber.set(need.partNumber, []);
      }
      groupedByPartNumber.get(need.partNumber)?.push(need);
    });
    
    // Convert groups to CSV rows
    groupedByPartNumber.forEach((needs, partNumber) => {
      const totalQuantity = needs.reduce((sum, need) => sum + need.quantity, 0);
      const boxesNeeded = getBoxesNeeded(totalQuantity);
      
      // Get unique stores for this part number
      const stores = [...new Set(needs.map(need => need.storeName))].join(', ');
      
      // Collect warnings for this part number
      const allWarnings: string[] = [];
      needs.forEach(need => {
        const orderWarnings = filterWarnings.get(need.orderId);
        if (orderWarnings) {
          orderWarnings.forEach(warning => {
            const warningMessage = warning.message || warning.warning;
            if ((warning.partNumber === partNumber || !warning.partNumber) && warningMessage) {
              allWarnings.push(`${warningMessage} (${need.storeName})`);
            }
          });
        }
      });
      
      csvData.push({
        'Part Number': partNumber,
        'Type': needs[0]?.filterType || needs[0]?.type || 'Unknown',
        'Quantity': totalQuantity,
        'Boxes Needed': boxesNeeded,
        'Stores': stores,
        'Warnings': allWarnings.join('; ')
      });
    });
    
    // Add individual order filter needs
    filterNeeds.forEach(need => {
      const visitId = need.visitId || 'Unknown';
      const orderWarnings = filterWarnings.get(need.orderId) || [];
      const relevantWarnings = orderWarnings
        .filter(warning => warning.partNumber === need.partNumber || !warning.partNumber)
        .map(warning => warning.message || warning.warning)
        .filter(Boolean) // Remove any undefined values
        .join('; ');
      
      csvData.push({
        'Part Number': need.partNumber,
        'Type': need.filterType || need.type,
        'Quantity': need.quantity,
        'Boxes Needed': getBoxesNeeded(need.quantity),
        'Stores': need.storeName,
        'Warnings': relevantWarnings,
        'Visit ID': visitId,
        'Date': need.visitDate
      });
    });
    
    return csvData;
  };

  // Render weekly summary cards
  const renderWeeklySummaryCards = () => {
    const filterTypes = getAllFilterTypes();
    const totalBoxes = getTotalBoxesNeeded();
    const totalFilters = getTotalFiltersNeeded();
    const warningsCount = Array.from(filterWarnings.values()).reduce((count, arr) => count + arr.length, 0);
    
    // Calculate filter efficiency (this is a simplified example)
    const totalStores = new Set(filterNeeds.map(need => need.storeName)).size;
    const averageFiltersPerStore = totalStores > 0 ? Math.round(totalFilters / totalStores) : 0;
    const storesWithWarnings = new Set(Array.from(filterWarnings.keys()).map(orderId => 
      filterNeeds.find(need => need.orderId === orderId)?.storeName
    )).size;
    const warningPercentage = totalStores > 0 ? Math.round((storesWithWarnings / totalStores) * 100) : 0;
    
    // Performance metrics
    const efficiency = Math.min(100, Math.max(0, 100 - warningPercentage));
    const efficiencyColor = 
      efficiency >= 90 ? 'text-accent-green-500 dark:text-accent-green-400' :
      efficiency >= 75 ? 'text-primary-500 dark:text-primary-400' :
      efficiency >= 50 ? 'text-accent-amber-500 dark:text-accent-amber-400' :
      'text-red-500 dark:text-red-400';
    
    const progressBgColor =
      efficiency >= 90 ? 'bg-accent-green-500 dark:bg-accent-green-600' :
      efficiency >= 75 ? 'bg-primary-500 dark:bg-primary-600' :
      efficiency >= 50 ? 'bg-accent-amber-500 dark:bg-accent-amber-600' :
      'bg-red-500 dark:bg-red-600';
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card animate-fadeIn hover-lift">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Filters</h3>
            <div className="p-2 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400">
              <FiBox className="text-xl" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{totalFilters}</span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">filters needed</span>
            </div>
            <div className="flex items-center mt-2">
              <span className="badge badge-primary mr-2">{totalBoxes} {totalBoxes === 1 ? 'box' : 'boxes'}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{Math.ceil(totalFilters / totalBoxes)} filters per box (avg)</span>
            </div>
          </div>
        </div>
        
        <div className="card animate-fadeIn delay-100 hover-lift">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Efficiency</h3>
            <div className="p-2 rounded-full bg-gray-50 dark:bg-gray-800 text-primary-500 dark:text-primary-400">
              <FiBarChart2 className={`text-xl ${efficiencyColor}`} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline">
              <span className={`text-3xl font-bold ${efficiencyColor}`}>{efficiency}%</span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">service efficiency</span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${progressBgColor}`}
                style={{ width: `${efficiency}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {storesWithWarnings} of {totalStores} stores have warnings
            </p>
          </div>
        </div>
        
        <div className="card animate-fadeIn delay-200 hover-lift">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Warnings</h3>
            <div className="p-2 rounded-full bg-gray-50 dark:bg-gray-800">
              <FiAlertTriangle className={`text-xl ${warningsCount > 0 ? 'text-accent-amber-500 dark:text-accent-amber-400 animate-pulse' : 'text-accent-green-500 dark:text-accent-green-400'}`} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{warningsCount}</span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{warningsCount === 1 ? 'issue' : 'issues'}</span>
            </div>
            <div className="mt-2">
              {warningsCount > 0 ? (
                <span className="inline-flex items-center text-xs text-accent-amber-700 dark:text-accent-amber-400">
                  <FiAlertTriangle className="mr-1" /> Action required
                </span>
              ) : (
                <span className="inline-flex items-center text-xs text-accent-green-700 dark:text-accent-green-400">
                  <FiCheckCircle className="mr-1" /> All clear
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render filter breakdown
  const renderFilterBreakdown = () => {
    const filterTypes = getAllFilterTypes();
    
    // Add indicators for special fuel types
    const storesWithDEF = new Set<string>();
    const storesWithHighFlow = new Set<string>();
    
    workOrders.forEach(order => {
      const { hasDEF, hasDieselHighFlow } = checkForSpecialFuelTypes(order);
      if (hasDEF && order.customer?.name) {
        storesWithDEF.add(order.customer.name);
      }
      if (hasDieselHighFlow && order.customer?.name) {
        storesWithHighFlow.add(order.customer.name);
      }
    });
    
    // Group similar filter types (gas/diesel pairs)
    // Define the standard filter pairs with improved descriptions
    const filterPairs = [
      {
        types: ['450MB-10', '450MG-10'],
        description: 'Standard Flow'
      },
      {
        types: ['400MB-10', '400HS-10'],
        description: 'High Flow'
      },
      {
        types: ['40510D-AD', '40530W-AD'],
        description: 'Electronic Dispenser'
      },
      {
        types: ['40510A-AD', '40510W-AD'],
        description: 'Standard Dispenser'
      }
    ];
    
    // Find which pairs are present in our data
    const presentPairs = filterPairs.filter(pair => 
      pair.types.some(type => filterTypes.includes(type))
    );
    
    // Get filters that don't belong to any pair
    const singleFilters = filterTypes.filter(type => 
      !filterPairs.flatMap(pair => pair.types).includes(type)
    );
    
    // Calculate grid columns based on number of cards
    const getGridColumnsClass = (itemCount: number) => {
      // For mobile, always 1 column
      // For medium screens and up, adjust based on item count
      switch (itemCount) {
        case 1: return 'grid-cols-1 md:grid-cols-1';
        case 2: return 'grid-cols-1 md:grid-cols-2';
        case 3: return 'grid-cols-1 md:grid-cols-3';
        case 4: return 'grid-cols-1 md:grid-cols-4';
        case 5: return 'grid-cols-1 md:grid-cols-5';
        case 6: return 'grid-cols-1 md:grid-cols-6';
        default: return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4';
      }
    };
    
    return (
      <div className="panel mb-6 animate-fadeIn delay-100">
        <div className="panel-header flex items-center justify-between">
          <div>
            <h3 className="panel-title flex items-center">
              <FiBox className="mr-2 text-primary-500 dark:text-primary-400" /> 
              Filter Breakdown
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed analysis of filter inventory needs by type</p>
          </div>
          <div className="panel-actions">
            {/* Reset Edited Quantities button */}
            <button
              onClick={() => {
                if (window.confirm('Reset all edited filter quantities to calculated defaults? This action cannot be undone.')) {
                  clearAllSavedEdits();
                }
              }}
              className="btn btn-secondary text-xs flex items-center"
              title="Reset all edited quantities to calculated defaults"
            >
              <FiRefreshCw className="mr-1" />
              Reset Edits
            </button>
          </div>
        </div>
        
        <div className="space-y-6 mt-4">
          {/* Paired filters section */}
          {presentPairs.length > 0 && (
            <div>
              <div className={`grid ${getGridColumnsClass(presentPairs.length)} gap-4 auto-rows-fr w-full`}>
                {presentPairs.map((pair, idx) => {
                  const presentTypes = pair.types.filter(type => filterTypes.includes(type));
                  
                  // Get quantities for comparison
                  const quantities = pair.types.map(type => {
                    if (!filterTypes.includes(type)) return 0;
                    return getTotalQuantity(type);
                  });
                  
                  // Sum of all quantities for this pair
                  const totalQuantity = quantities.reduce((sum, qty) => sum + qty, 0);
                  
                  // Calculate how many boxes each filter type needs
                  const boxesNeeded = pair.types.map(type => {
                    if (!filterTypes.includes(type)) return 0;
                    return getBoxesNeeded(getTotalQuantity(type));
                  });
                  
                  return (
                    <div key={idx} className="card h-full flex flex-col animate-fadeIn hover-lift" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <span className="text-primary-500 dark:text-primary-400 mr-2">
                          <FiFilter />
                        </span>
                        {presentTypes.join(' / ')}
                        <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md">
                          {pair.description}
                        </span>
                      </div>
                      
                      <div className="p-3 flex-grow flex flex-col">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Filters</div>
                            <div className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mt-1">{totalQuantity}</div>
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Boxes</div>
                            <div className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mt-1">
                              {boxesNeeded.reduce((sum, boxes) => sum + boxes, 0)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-1.5">
                          {pair.types.map((type, index) => {
                            if (!filterTypes.includes(type)) return null;
                            const quantity = getTotalQuantity(type);
                            // Calculate width as percentage of total for this pair
                            const widthPercent = totalQuantity > 0 ? (quantity / totalQuantity) * 100 : 0;
                            // Determine if gas or diesel based on part number pattern
                            const isGas = type.includes('MB') || type.includes('510A') || type.includes('510D');
                            
                            return (
                              <div 
                                key={type} 
                                className={`h-2 rounded-full ${isGas ? 'bg-primary-500 dark:bg-primary-600' : 'bg-accent-amber-500 dark:bg-accent-amber-600'}`} 
                                style={{ 
                                  width: `${widthPercent}%`,
                                  float: 'left',
                                  borderTopRightRadius: index === pair.types.length - 1 ? '0.25rem' : '0',
                                  borderBottomRightRadius: index === pair.types.length - 1 ? '0.25rem' : '0'
                                }}
                                title={`${type}: ${quantity} filters`}
                              ></div>
                            );
                          })}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-auto pt-4">
                          {pair.types.map((type, i) => {
                            if (!filterTypes.includes(type)) return null;
                            
                            const quantity = getTotalQuantity(type);
                            const boxesNeeded = getBoxesNeeded(quantity);
                            // Determine if gas or diesel based on part number pattern
                            const isGas = type.includes('MB') || type.includes('510A') || type.includes('510D');
                            const filterCategory = isGas ? 'Gas' : 'Diesel';
                            const bgColorClass = isGas ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-accent-amber-50 dark:bg-accent-amber-900/20';
                            const borderColorClass = isGas ? 'border-primary-100 dark:border-primary-800/30' : 'border-accent-amber-100 dark:border-accent-amber-800/30';
                            
                            return (
                              <div key={type} className={`border ${borderColorClass} rounded-lg p-3 ${bgColorClass} h-full flex flex-col hover:shadow-inner transition-shadow`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center">
                                    <span className={`inline-block w-3 h-3 rounded-full mr-1.5 ${isGas ? 'bg-primary-500' : 'bg-accent-amber-500'}`}></span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                      {filterCategory}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{type}</span>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between">
                                  <span className="text-xl font-bold text-gray-700 dark:text-gray-300">{quantity}</span>
                                  <span className="badge-subtle">
                                    {boxesNeeded} {boxesNeeded === 1 ? 'box' : 'boxes'}
                                  </span>
                                </div>
                                <div className="mt-auto pt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                                  <div 
                                    className={`h-1.5 rounded-full ${isGas ? 'bg-primary-500' : 'bg-accent-amber-500'}`} 
                                    style={{ width: `${Math.min(100, (quantity / (boxesNeeded * 12)) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Individual filters section */}
          {singleFilters.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <FiSliders className="mr-2 text-primary-500 dark:text-primary-400" />
                Individual Filters
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 auto-rows-fr">
                {singleFilters.map((type, idx) => {
                  const quantity = getTotalQuantity(type);
                  const boxesNeeded = getBoxesNeeded(quantity);
                  // Determine if gas or diesel based on part number pattern
                  const isGas = type.includes('MB') || type.includes('510A') || type.includes('510D');
                  const colorClass = isGas ? 'bg-primary-500 dark:bg-primary-600' : 'bg-accent-amber-500 dark:bg-accent-amber-600';
                  const bgColorClass = isGas ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-accent-amber-50 dark:bg-accent-amber-900/20';
                  const borderColorClass = isGas ? 'border-primary-100 dark:border-primary-800/30' : 'border-accent-amber-100 dark:border-accent-amber-800/30';
                  
                  return (
                    <div key={type} className={`border ${borderColorClass} rounded-lg p-3 ${bgColorClass} h-full flex flex-col hover-lift animate-fadeIn`} style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {isGas ? 'Gas' : 'Diesel'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{type}</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div>
                          <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{quantity}</span>
                          <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">filters</span>
                        </div>
                        <span className="badge-subtle">
                          {boxesNeeded} {boxesNeeded === 1 ? 'box' : 'boxes'}
                        </span>
                      </div>
                      <div className="mt-auto pt-4">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div 
                            className={`h-2 rounded-full ${colorClass}`}
                            style={{ width: `${Math.min(100, (quantity / (boxesNeeded * 12)) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="mt-1 text-xs text-right text-gray-500 dark:text-gray-400">
                          {quantity} of {boxesNeeded * 12}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check for DEF or Diesel High Flow in the dispenser information
  const checkForSpecialFuelTypes = (order: WorkOrder): { hasDEF: boolean; hasDieselHighFlow: boolean; isSpecificDispensersJob: boolean } => {
    const result = { hasDEF: false, hasDieselHighFlow: false, isSpecificDispensersJob: false };
    
    // Check instructions and service descriptions for DEF mentions
    const instructions = order.instructions?.toLowerCase() || '';
    const serviceFuel = order.services?.some(service => 
      (service.description?.toLowerCase() || '').includes('def') || 
      (service.description?.toLowerCase() || '').includes('diesel exhaust fluid')
    ) || false;
    
    // Check if this is a "Specific Dispenser(s)" job (code 2862)
    result.isSpecificDispensersJob = order.services?.some(
      service => service.code === "2862" || (service.description && service.description.includes("Specific Dispenser"))
    ) || false;
    
    if (
      instructions.includes('def') || 
      serviceFuel ||
      instructions.includes('diesel exhaust fluid')
    ) {
      result.hasDEF = true;
    }
    
    // Check for Diesel High Flow mentions
    if (
      instructions.includes('high flow diesel') || 
      instructions.includes('diesel high flow') ||
      order.services?.some(service => 
        (service.description?.toLowerCase() || '').includes('high flow diesel') ||
        (service.description?.toLowerCase() || '').includes('diesel high flow')
      )
    ) {
      result.hasDieselHighFlow = true;
    }
    
    // Check dispenser data if available
    if (order.dispensers && order.dispensers.length > 0) {
      order.dispensers.forEach(dispenser => {
        const dispenserTitle = dispenser.title?.toLowerCase() || '';
        const dispenserFields = dispenser.fields || {};
        
        // Check dispenser title for DEF
        if (dispenserTitle.includes('def') || dispenserTitle.includes('diesel exhaust fluid')) {
          result.hasDEF = true;
        }
        
        // Check for high flow information in fields
        Object.entries(dispenserFields).forEach(([key, value]) => {
          const fieldKey = key.toLowerCase();
          const fieldValue = (value as string)?.toLowerCase() || '';
          
          if (
            fieldValue.includes('def') || 
            fieldValue.includes('diesel exhaust fluid')
          ) {
            result.hasDEF = true;
          }
          
          if (
            fieldValue.includes('high flow') && 
            (fieldValue.includes('diesel') || fieldKey.includes('diesel'))
          ) {
            result.hasDieselHighFlow = true;
          }
        });
      });
    }
    
    return result;
  };

  // Render filter warnings
  const renderFilterWarnings = () => {
    if (filterWarnings.size === 0) {
      return (
        <div className="panel mb-6 animate-fadeIn">
          <h3 className="panel-title mb-2">Filter Warnings</h3>
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FiCheckCircle className="w-10 h-10 mx-auto mb-2 text-accent-green-500" />
            <p>No filter warnings detected</p>
          </div>
        </div>
      );
    }

    // Enhanced deduplication by normalizing messages and grouping by key identifiers
    const flattenedWarnings: ExtendedFilterWarning[] = [];
    Array.from(filterWarnings.entries()).forEach(([orderId, warnings]) => {
      warnings.forEach(warning => {
        // Add order ID to warning for store lookup
        const needWithStore = filterNeeds.find(need => need.orderId === orderId);
        const extendedWarning: ExtendedFilterWarning = {
          ...warning,
          orderId,
          storeName: needWithStore?.storeName
        };
        flattenedWarnings.push(extendedWarning);
      });
      
      // We no longer add warnings for DEF and Diesel High Flow
      // They're now handled in the filter needs section for 7-Eleven
      // and displayed as indicators in the UI
    });
    
    interface WarningGroup {
      type: string;
      filterType: string;
      station: string;
      count: number;
      instances: ExtendedFilterWarning[];
      severity: number;
      stores: string[];
      needsVerification: boolean;
    }

    const groupedWarnings = flattenedWarnings.reduce((acc: Record<string, WarningGroup>, warning: ExtendedFilterWarning) => {
      // Create a normalized key from the warning message that ignores small text differences
      const message = warning.message || warning.warning || '';
      const normalizedMessage = message
        .replace(/\b(\d+)\b/g, 'NUM') // Replace numbers with placeholder
        .replace(/\b([A-Za-z0-9-]+)\b/g, (word: string) => {
          // Check if word is a filter part number
          return getAllFilterTypes().includes(word) ? 'FILTER_TYPE' : word;
        })
        .toLowerCase();
      
      // Extract the key identifiers - filter type, station, and warning type
      const filterType = message.match(/\b([A-Za-z0-9-]+)\b/g)?.find((word: string) => 
        getAllFilterTypes().includes(word)
      ) || 'unknown';
      
      const stationMatch = message.match(/Station (\d+)/i);
      const station = stationMatch ? stationMatch[1] : 'all';
      
      const warningType = 
        message.includes('low') ? 'low_inventory' :
        message.includes('missing') ? 'missing_filters' :
        message.includes('excessive') ? 'excessive_use' : 'other';
      
      const needsVerification = message.toLowerCase().includes('verify');
      
      // Create a unique key for the warning group
      const key = `${warningType}_${filterType}_${station}`;
      
      if (!acc[key]) {
        acc[key] = {
          type: warningType,
          filterType,
          station,
          count: 0,
          instances: [],
          severity: warning.severity || 5,
          stores: [],
          needsVerification: false
        };
      }
      
      acc[key].count++;
      acc[key].instances.push(warning);
      
      // Collect store names
      if (warning.storeName && !acc[key].stores.includes(warning.storeName)) {
        acc[key].stores.push(warning.storeName);
      }
      
      // If any instance needs verification, the group needs verification
      if (needsVerification) {
        acc[key].needsVerification = true;
      }
      
      // Use the highest severity found for this warning group
      const warningSeverity = warning.severity || 0;
      if (warningSeverity > acc[key].severity) {
        acc[key].severity = warningSeverity;
      }
      
      return acc;
    }, {});

    // Sort warnings by verification need, then severity (high to low)
    const sortedWarningGroups = Object.values(groupedWarnings).sort((a: WarningGroup, b: WarningGroup) => {
      // First sort by verification needed
      if (a.needsVerification && !b.needsVerification) return -1;
      if (!a.needsVerification && b.needsVerification) return 1;
      
      // Then by severity
      return b.severity - a.severity || b.count - a.count;
    });

    return (
      <div className="panel mb-6 animate-fadeIn">
        <div className="panel-header">
          <h3 className="panel-title">Filter Warnings</h3>
        </div>
        
        <div className="space-y-3 mt-4">
          {sortedWarningGroups.map((group, index) => {
            const { type, filterType, count, instances, severity, stores, needsVerification } = group;
            
            // Generate a descriptive title for the warning group
            let title = '';
            if (type === 'low_inventory') {
              title = `Low inventory for ${filterType} filters`;
            } else if (type === 'missing_filters') {
              title = `Missing ${filterType} filters`;
            } else if (type === 'excessive_use') {
              title = `Excessive use of ${filterType} filters`;
            } else {
              title = instances[0].message || instances[0].warning || 'Warning'; // Fallback to first message
            }
            
            // Color based on severity and verification need
            let cardClass = needsVerification
              ? 'card-accent border-accent-amber-500'
              : severity >= 8 
                ? 'card-accent border-red-500' 
                : severity >= 5 
                  ? 'card-accent border-primary-500'
                  : 'card-subtle';
              
            const iconColor = needsVerification
              ? 'text-accent-amber-500 dark:text-accent-amber-400'
              : severity >= 8 
                ? 'text-red-500 dark:text-red-400' 
                : severity >= 5 
                  ? 'text-primary-500 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400';
              
            return (
              <div 
                key={index}
                className={`${cardClass} p-3 animate-fadeIn`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start">
                  <div className={`mt-0.5 p-1.5 rounded-full bg-gray-100 dark:bg-gray-700`}>
                    {needsVerification ? (
                      <FiAlertTriangle className={`w-4 h-4 ${iconColor} animate-pulse-slow`} />
                    ) : severity >= 8 ? (
                      <FiAlertTriangle className={`w-4 h-4 ${iconColor} animate-pulse-slow`} />
                    ) : severity >= 5 ? (
                      <FiAlertCircle className={`w-4 h-4 ${iconColor}`} />
                    ) : (
                      <FiInfo className={`w-4 h-4 ${iconColor}`} />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {title}
                      </h4>
                      {count > 1 && (
                        <span className="badge bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {count}
                        </span>
                      )}
                      {needsVerification && (
                        <span className="badge badge-warning">
                          Needs Verification
                        </span>
                      )}
                    </div>
                    
                    {/* Store and job indicators */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {stores.length > 0 && stores.map((store, i) => (
                        <span 
                          key={i} 
                          className={`text-xs ${getStoreColor(store).bg} ${getStoreColor(store).text} px-1.5 py-0.5 rounded`}
                        >
                          <FiMapPin className="inline-block mr-1 w-3 h-3" />
                          {store}
                        </span>
                      ))}
                      
                      {/* Add job count badge */}
                      <span 
                        className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex items-center"
                        title="Number of visits affected by this warning"
                      >
                        <FiTool className="inline-block mr-1 w-3 h-3" />
                        {(() => {
                          // Get unique visit IDs from all affected jobs
                          const visitIds = new Set();
                          instances.forEach(instance => {
                            const order = workOrders.find(order => order.id === instance.orderId);
                            const visitData = order?.visits ? Object.values(order.visits)[0] : null;
                            if (visitData?.visitId) {
                              visitIds.add(visitData.visitId);
                            }
                          });
                          const count = visitIds.size || new Set(instances.map(instance => instance.orderId)).size;
                          return `${count} visit${count !== 1 ? 's' : ''}`;
                        })()}
                      </span>
                    </div>
                    
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {count > 1 ? (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 dark:text-blue-400 text-xs">
                            View {count} related warnings
                          </summary>
                          <ul className="mt-2 ml-2 space-y-1 text-xs">
                            {instances.map((warning, i) => (
                              <li key={i} className="list-disc ml-4">
                                {warning.message || warning.warning}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {warning.storeName && (() => {
                                    const storeColors = getStoreColor(warning.storeName);
                                    return (
                                      <span className={`text-xs ${storeColors.lightBg} ${storeColors.text} px-1.5 py-0.5 rounded flex items-center`}>
                                        <FiMapPin className="mr-1 w-3 h-3" />
                                        {warning.storeName}
                                      </span>
                                    );
                                  })()}
                                  {warning.orderId && (() => {
                                    const order = workOrders.find(order => order.id === warning.orderId);
                                    const visitData = order?.visits ? Object.values(order.visits)[0] : null;
                                    return (
                                      <span className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded flex items-center">
                                        <FiInfo className="mr-1 w-3 h-3" />
                                        Visit: {visitData?.visitId || 'Unknown'}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <p>{instances[0].message || instances[0].warning}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Add a function to get store-specific colors
  // Get color for store
  const getStoreColor = (storeName: string): { border: string, bg: string, text: string, lightBg: string } => {
    if (!storeName) return {
      border: 'border-gray-300 dark:border-gray-700',
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      lightBg: 'bg-gray-50 dark:bg-gray-900/20'
    };
    
    if (storeName.includes('Wawa')) {
      return {
        border: 'border-purple-300 dark:border-purple-800',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        lightBg: 'bg-purple-50 dark:bg-purple-900/20'
      };
    } else if (storeName.includes('Circle K')) {
      return {
        border: 'border-orange-300 dark:border-orange-800',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        lightBg: 'bg-orange-50 dark:bg-orange-900/20'
      };
    } else if (storeName.includes('7-Eleven')) {
      return {
        border: 'border-green-300 dark:border-green-800',
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        lightBg: 'bg-green-50 dark:bg-green-900/20'
      };
    } else if (storeName.includes('Speedway')) {
      return {
        border: 'border-red-300 dark:border-red-800',
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        lightBg: 'bg-red-50 dark:bg-red-900/20'
      };
    }
    
    // Default colors
    return {
      border: 'border-blue-300 dark:border-blue-800',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      lightBg: 'bg-blue-50 dark:bg-blue-900/20'
    };
  };

  // Function to format dispenser numbers in a readable way, showing pairs when possible
  const formatDispenserNumbers = (dispenserNumbers: number[]): string => {
    if (!dispenserNumbers || dispenserNumbers.length === 0) return 'None';
    
    // Sort the numbers
    const sortedNumbers = [...dispenserNumbers].sort((a, b) => a - b);
    
    // Check if we have pairs (consecutive numbers)
    const pairs: string[] = [];
    const processed = new Set<number>();
    
    // Find pairs of consecutive numbers (like 3,4 or 19,20)
    for (let i = 0; i < sortedNumbers.length; i++) {
      if (processed.has(sortedNumbers[i])) continue;
      
      const current = sortedNumbers[i];
      const next = current + 1;
      
      if (sortedNumbers.includes(next)) {
        // This is a pair
        pairs.push(`${current}/${next}`);
        processed.add(current);
        processed.add(next);
      }
    }
    
    // Add any remaining numbers that weren't paired
    const singles = sortedNumbers.filter(num => !processed.has(num));
    
    // Combine pairs and singles
    let result = '';
    if (pairs.length > 0) {
      result += `#${pairs.join(', #')}`;
    }
    
    if (singles.length > 0) {
      if (result) result += ', ';
      result += `#${singles.join(', #')}`;
    }
    
    return result;
  };

  // Add a timer effect to check for work week transitions at 5:00pm on Friday
  useEffect(() => {
    // Function to check if we're at the end of work week after 5:00pm
    const checkForWorkWeekTransition = () => {
      const now = new Date();
      const currentDayOfWeek = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Check if we're at Friday (5) and it's between 5:00pm and 5:05pm
      // The 5-minute window ensures we don't miss the transition and don't refresh too often
      if (currentDayOfWeek === 5 && 
          currentHour === 17 && 
          currentMinute < 5) {
        console.log("Work week transition detected at 5:00pm - refreshing filters view");
        
        // Calculate next Monday-Friday
        const day = now.getDay(); // 5 = Friday
        const currentMonday = new Date(now);
        const daysToNextMonday = (8 - day) % 7; // Distance to next Monday (3 days: Sat, Sun, Mon)
        
        // Set to next Monday
        currentMonday.setDate(now.getDate() + daysToNextMonday);
        currentMonday.setHours(0, 0, 0, 0);
        
        // Calculate next Friday (4 days after Monday)
        const nextFriday = new Date(currentMonday);
        nextFriday.setDate(currentMonday.getDate() + 4);
        nextFriday.setHours(17, 0, 0, 0);
        
        // Update the selected date range
        setSelectedDateRange([currentMonday, nextFriday]);
        
        // Update current week
        setCurrentWeek(currentMonday);
        
        // Optionally show a toast notification
        addToast('info', 'Switched to weekend mode - next week is now this week', 3000);
      }
    };
    
    // Run the check immediately in case we're already at 5:00pm
    checkForWorkWeekTransition();
    
    // Set up an interval to check every minute
    const intervalId = setInterval(checkForWorkWeekTransition, 60000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [addToast]);

  // Check on initial render if we're already after 5:00pm on Friday
  useEffect(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    
    if (currentDayOfWeek === 5 && currentHour >= 17) {
      // If we're loading after 5:00pm on Friday, update the UI to show next week
      console.log("Page loaded after 5:00pm on Friday - using weekend mode");
      
      // Calculate next Monday-Friday
      const day = now.getDay(); // 5 = Friday
      const currentMonday = new Date(now);
      const daysToNextMonday = (8 - day) % 7; // Distance to next Monday (3 days: Sat, Sun, Mon)
      
      // Set to next Monday
      currentMonday.setDate(now.getDate() + daysToNextMonday);
      currentMonday.setHours(0, 0, 0, 0);
      
      // Calculate next Friday (4 days after Monday)
      const nextFriday = new Date(currentMonday);
      nextFriday.setDate(currentMonday.getDate() + 4);
      nextFriday.setHours(17, 0, 0, 0);
      
      // Update the selected date range
      setSelectedDateRange([currentMonday, nextFriday]);
      
      // Update current week
      setCurrentWeek(currentMonday);
    }
  }, []);

  // Reset edited quantity back to default
  const resetEditedQuantity = (orderId: string, partNumber: string) => {
    try {
      // Load existing edited quantities
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      if (!storedEdits) return;
      
      const edits = JSON.parse(storedEdits);
      const key = `${orderId}_${partNumber}`;
      
      // Remove this specific entry
      if (edits[key] !== undefined) {
        delete edits[key];
        localStorage.setItem('filterQuantityEdits', JSON.stringify(edits));
      }
    } catch (error) {
      console.error('Error resetting edited quantity', error);
    }
  };

  // Define the return type explicitly
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <>
          {/* Header with date picker */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 animate-fadeIn">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight flex items-center">
                <span className="p-2 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400 mr-3">
                  <FiFilter className="h-6 w-6" />
                </span>
                Filter Inventory
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-11">
                Track and manage filter inventory for upcoming service visits
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* CSV Export Button */}
              <CSVLink
                data={prepareCSVData()}
                filename={`filter-inventory-${format(selectedDateRange[0], 'yyyy-MM-dd')}-to-${format(selectedDateRange[1], 'yyyy-MM-dd')}.csv`}
                className="btn btn-secondary flex items-center text-sm"
              >
                <FiDownload className="mr-2" />
                Export CSV
              </CSVLink>
              
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search filters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input py-2 pl-9 pr-4 text-sm w-48 md:w-64"
                />
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Date Range Selector */}
          <div className="mb-6 animate-fadeIn delay-100">
            <div className="card p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between">
                <div className="mb-4 sm:mb-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Work Week Selection
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Filter data by work week period
                  </p>
                </div>
                
                <div className="flex items-center">
                  <button 
                    onClick={handlePreviousWeek}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg border border-gray-300 dark:border-gray-700 transition-colors"
                    aria-label="Previous week"
                  >
                    <FiChevronLeft />
                  </button>
                  
                  <DatePicker
                    selected={currentWeek}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setCurrentWeek(date);
                        
                        // Use the consistent date range calculation
                        const dateRanges = getWorkWeekDateRanges(workWeekStart, workWeekEnd, date);
                        
                        // Update selectedDateRange to match
                        setSelectedDateRange([dateRanges.currentWeekStart, dateRanges.currentWeekEnd]);
                      }
                    }}
                    customInput={
                      <button className="px-4 py-2 h-12 bg-white dark:bg-gray-800 border-t border-b border-gray-300 dark:border-gray-700 flex items-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors justify-center w-48 shadow-sm">
                        <div className="flex flex-col items-center">
                          <div className="text-xs font-medium uppercase tracking-wider text-primary-500 dark:text-primary-400 mb-1">
                            WORK WEEK
                          </div>
                          <div className="text-sm font-semibold">
                            {formatDateRange(selectedDateRange)}
                          </div>
                        </div>
                      </button>
                    }
                    inline={false}
                    highlightDates={[
                      {
                        "react-datepicker__day--highlighted-business": Array.from(
                          { length: 365 }, 
                          (_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() + i - 180); // Generate dates 180 days in past and future
                            const day = date.getDay();
                            return day !== 0 && day !== 6 ? date : null; // Highlight weekdays
                          }
                        ).filter(Boolean) as Date[]
                      }
                    ]}
                    calendarClassName="business-week-calendar"
                    dayClassName={date => {
                      return (date.getDay() === 1) ? "monday-marker" : "";
                    }}
                  />
                  
                  <button 
                    onClick={handleNextWeek}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg border border-gray-300 dark:border-gray-700 transition-colors"
                    aria-label="Next week"
                  >
                    <FiChevronRight />
                  </button>
                  
                  <button 
                    onClick={goToCurrentWeek}
                    className="ml-2 btn btn-secondary text-xs flex items-center"
                    aria-label="Go to current week"
                  >
                    <FiRefreshCw className="mr-1 h-3 w-3" />
                    Today
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {renderWeeklySummaryCards()}
          
          {/* Filter Breakdown */}
          {renderFilterBreakdown()}
          
          {/* Filter Warnings */}
          {renderFilterWarnings()}
          
          {/* Filter Needs Table - Segmented by date and visit ID */}
          <div className="panel overflow-hidden animate-fadeIn">
            <div className="panel-header">
              <h3 className="panel-title flex items-center">
                <FiList className="mr-2 text-primary-500 dark:text-primary-400" />
                Filters Required
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Detailed breakdown of filters needed for upcoming services
              </p>
            </div>
            <div className="overflow-x-auto mt-4">
              {(() => {
                // Group needs by date
                const groupedByDate = new Map<string, ExtendedFilterNeed[]>();
                
                // Sort needs by date first
                const sortedNeeds = [...filterNeeds].sort((a, b) => {
                  const dateA = new Date(a.visitDate).getTime();
                  const dateB = new Date(b.visitDate).getTime();
                  return dateA - dateB;
                });
                
                // Group by date
                sortedNeeds.forEach(need => {
                  const dateKey = new Date(need.visitDate).toLocaleDateString();
                  if (!groupedByDate.has(dateKey)) {
                    groupedByDate.set(dateKey, []);
                  }
                  groupedByDate.get(dateKey)?.push(need);
                });

                // Get list of orders that need verification
                const ordersNeedingVerification = new Set(
                  Array.from(filterWarnings.entries())
                    .filter(([_, warnings]) => 
                      warnings.some(w => 
                        (w.warning && w.warning.toLowerCase().includes('verify')) || 
                        (w.message && w.message.toLowerCase().includes('verify'))
                      )
                    )
                    .map(([orderId]) => orderId)
                );
                
                // Render groups
                return Array.from(groupedByDate.entries()).map(([dateKey, needs], dateIndex) => (
                  <div key={dateKey} className="mb-6 animate-fadeIn" style={{ animationDelay: `${dateIndex * 100}ms` }}>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 rounded-t-lg flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="p-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400 mr-3">
                          <FiCalendar className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white text-lg">{dateKey}</span>
                          {/* <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {needs.length} filter{needs.length !== 1 ? 's' : ''} required
                          </p> */}
                        </div>
                      </div>
                      {/* <span className="badge badge-primary">{needs.length} filters</span> */}
                    </div>
                    
                    {/* Group by visit ID within each date */}
                    {(() => {
                      const visitGroups = new Map<string, ExtendedFilterNeed[]>();
                      
                      // Group by visit ID
                      needs.forEach(need => {
                        const visitKey = need.visitId || 'Unknown';
                        if (!visitGroups.has(visitKey)) {
                          visitGroups.set(visitKey, []);
                        }
                        visitGroups.get(visitKey)?.push(need);
                      });
                      
                      // Return the mapped JSX elements
                      return Array.from(visitGroups.entries()).map(([visitId, visitNeeds], visitIndex) => {
                        // Check if any needs in this group need verification
                        const anyNeedsVerification = visitNeeds.some(need => 
                          ordersNeedingVerification.has(need.orderId)
                        );

                        // Get unique order IDs for this visit
                        const orderIds = [...new Set(visitNeeds.map(need => need.orderId))];
                        
                        // Determine the card type based on verification status
                        const cardClass = anyNeedsVerification ? 'card-accent border-accent-amber-500' : 'card-subtle';
                        
                        return (
                          <div key={visitId} className={`mb-4 animate-fadeIn ${cardClass}`} style={{ animationDelay: `${(dateIndex * 100) + (visitIndex * 50)}ms` }}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                              <div className="flex items-center mb-2 sm:mb-0">
                                <div className="flex flex-col">
                                  <div className="flex items-center">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">Visit ID: {visitId}</span>
                                    {visitNeeds[0]?.storeName && (() => {
                                      const storeColors = getStoreColor(visitNeeds[0].storeName);
                                      return (
                                        <span className={`ml-2 badge ${storeColors.bg} ${storeColors.text}`}>
                                          {visitNeeds[0].storeName}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {anyNeedsVerification && (
                                    <span className="text-xs text-accent-amber-600 dark:text-accent-amber-400 flex items-center mt-1">
                                      <FiAlertCircle className="mr-1 animate-pulse-slow" /> Verification needed
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Indicators and buttons */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {(() => {
                                  const order = workOrders.find(order => orderIds.includes(order.id));
                                  if (!order) return null;
                                  
                                  const { hasDEF, hasDieselHighFlow, isSpecificDispensersJob } = checkForSpecialFuelTypes(order);
                                  const specificDispenserNumbers = isSpecificDispensersJob && order.instructions ? 
                                    parseSpecificDispenserInstructions(order.instructions) : [];
                                  
                                  return (
                                    <React.Fragment>
                                      {hasDEF && (
                                        <span className="badge bg-accent-purple-100 dark:bg-accent-purple-900/30 text-accent-purple-700 dark:text-accent-purple-400">
                                          DEF
                                        </span>
                                      )}
                                      {hasDieselHighFlow && (
                                        <span className="badge bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                          High Flow
                                        </span>
                                      )}
                                      {isSpecificDispensersJob && (
                                        <span className="badge bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center">
                                          <FiGrid className="h-3 w-3 mr-1" />
                                          <span className="whitespace-nowrap">
                                            {specificDispenserNumbers.length > 0 
                                              ? formatDispenserNumbers(specificDispenserNumbers) 
                                              : 'Specific Dispensers'}
                                          </span>
                                        </span>
                                      )}
                                    </React.Fragment>
                                  );
                                })()}
                                <button
                                  onClick={() => {
                                    setSelectedOrderId(orderIds[0]);
                                    setCurrentDispenserInfo('show');
                                  }}
                                  className="btn btn-secondary text-xs flex items-center py-1 px-2 h-auto"
                                >
                                  <FiEye className="mr-1" /> Dispensers
                                </button>
                              </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Part Number
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                                      Quantity
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-700/30 divide-y divide-gray-200 dark:divide-gray-700">
                                  {visitNeeds.map((need, index) => {
                                    const needsVerification = ordersNeedingVerification.has(need.orderId);
                                    const warnings = filterWarnings.get(need.orderId) || [];
                                    const tooltipContent = warnings.map(w => w.message || w.warning).join(', ');
                                    
                                    return (
                                      <tr 
                                        key={`${need.orderId}-${need.partNumber}-${index}`} 
                                        className={`transition-colors ${needsVerification ? 'bg-accent-amber-50/30 dark:bg-accent-amber-900/5' : ''} hover-lift group`}
                                      >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <div className={`h-2 w-2 rounded-full ${need.type === 'GAS' ? 'bg-primary-500' : need.filterType === 'DEF' ? 'bg-accent-purple-500' : 'bg-accent-amber-500'} mr-2`}></div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                              {need.partNumber}
                                            </span>
                                            {filterWarnings.has(need.orderId) && (
                                              <FiAlertCircle 
                                                className={`ml-2 ${needsVerification ? 'text-accent-amber-500 animate-pulse-slow' : 'text-primary-500'}`}
                                                title={tooltipContent}
                                              />
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {need.type === 'GAS' ? 'Gas Filter' : need.filterType === 'DEF' ? 'DEF Filter' : 'Diesel Filter'}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                          {editingFilterNeed === `${need.orderId}-${need.partNumber}-${index}` ? (
                                            <div className="flex items-center justify-center space-x-1">
                                              <input
                                                type="number"
                                                min="0"
                                                className="w-16 px-2 py-1 text-xs font-medium border dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                value={editedQuantity}
                                                onChange={(e) => {
                                                  // Allow empty string (for clearing) or valid numbers
                                                  const value = e.target.value;
                                                  if (value === '') {
                                                    setEditedQuantity(0);
                                                  } else {
                                                    setEditedQuantity(Math.max(0, parseInt(value) || 0));
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    // Same logic as the save button
                                                    const updatedNeeds = filterNeeds.map(item => {
                                                      if (item.orderId === need.orderId && item.partNumber === need.partNumber) {
                                                        return { ...item, quantity: editedQuantity };
                                                      }
                                                      return item;
                                                    });
                                                    setFilterNeeds(updatedNeeds);
                                                    
                                                    // Save edited quantity to localStorage
                                                    saveEditedQuantity(need.orderId, need.partNumber, editedQuantity);
                                                    
                                                    setEditingFilterNeed(null);
                                                    addToast('success', 'Filter quantity updated', 2000);
                                                  }
                                                }}
                                                autoFocus
                                              />
                                              <button 
                                                onClick={() => {
                                                  // Update the quantity in filterNeeds
                                                  const updatedNeeds = filterNeeds.map(item => {
                                                    if (item.orderId === need.orderId && item.partNumber === need.partNumber) {
                                                      return { ...item, quantity: editedQuantity };
                                                    }
                                                    return item;
                                                  });
                                                  setFilterNeeds(updatedNeeds);
                                                  
                                                  // Save edited quantity to localStorage
                                                  saveEditedQuantity(need.orderId, need.partNumber, editedQuantity);
                                                  
                                                  setEditingFilterNeed(null);
                                                  addToast('success', 'Filter quantity updated', 2000);
                                                }}
                                                className="p-1 text-accent-green-600 dark:text-accent-green-400 hover:bg-accent-green-100 dark:hover:bg-accent-green-900/30 rounded transition-colors"
                                              >
                                                <FiCheck className="w-3 h-3" />
                                              </button>
                                              <button 
                                                onClick={() => setEditingFilterNeed(null)}
                                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                              >
                                                <FiX className="w-3 h-3" />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-center">
                                              <span className={`inline-flex px-3 py-1.5 text-sm font-medium ${
                                                // Check if this quantity was edited
                                                getEditedQuantity(need.orderId, need.partNumber, null) !== null ?
                                                'bg-accent-purple-100 dark:bg-accent-purple-900/30 text-accent-purple-800 dark:text-accent-purple-300 border border-accent-purple-200 dark:border-accent-purple-800/30' :
                                                'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                                              } rounded-full`}>
                                                {need.quantity > 0 ? `${need.quantity}` : '0'}
                                                {getEditedQuantity(need.orderId, need.partNumber, null) !== null && 
                                                  <FiEdit className="ml-1 w-3 h-3" title="Manually edited" />
                                                }
                                              </span>
                                              <div className={`ml-2 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                <button 
                                                  onClick={() => {
                                                    setEditingFilterNeed(`${need.orderId}-${need.partNumber}-${index}`);
                                                    setEditedQuantity(need.quantity);
                                                  }}
                                                  className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                                  title="Edit quantity"
                                                >
                                                  <FiEdit className="w-3 h-3" />
                                                </button>
                                                
                                                {/* Only show reset if quantity has been edited before */}
                                                {(() => {
                                                  const editedValue = getEditedQuantity(need.orderId, need.partNumber, null);
                                                  return editedValue !== null && (
                                                    <button 
                                                      onClick={() => {
                                                        // Get original quantity based on the dispenser calculations
                                                        let originalQuantity = 0;
                                                        if (need.type === 'GAS') {
                                                          const result = calculateFiltersForWorkOrder(
                                                            workOrders.find(o => o.id === need.orderId) || {} as WorkOrder
                                                          );
                                                          originalQuantity = result.gasFilters;
                                                        } else if (need.type === 'DIESEL') {
                                                          const result = calculateFiltersForWorkOrder(
                                                            workOrders.find(o => o.id === need.orderId) || {} as WorkOrder
                                                          );
                                                          originalQuantity = result.dieselFilters;
                                                        } else if (need.filterType === 'DEF') {
                                                          originalQuantity = 1; // DEF typically has 1 filter
                                                        }
                                                        
                                                        // Reset to calculated quantity
                                                        resetEditedQuantity(need.orderId, need.partNumber);
                                                        
                                                        // Update the filterNeeds state
                                                        const updatedNeeds = filterNeeds.map(item => {
                                                          if (item.orderId === need.orderId && item.partNumber === need.partNumber) {
                                                            return { ...item, quantity: originalQuantity };
                                                          }
                                                          return item;
                                                        });
                                                        setFilterNeeds(updatedNeeds);
                                                        
                                                        addToast('info', 'Reset to calculated quantity', 2000);
                                                      }}
                                                      className="p-1 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-full transition-colors"
                                                      title="Reset to calculated quantity"
                                                    >
                                                      <FiRefreshCw className="w-3 h-3" />
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                          {needsVerification ? (
                                            <span className="badge badge-warning flex items-center">
                                              <FiAlertTriangle className="mr-1 animate-pulse-slow" /> Verify
                                            </span>
                                          ) : need.quantity === 0 ? (
                                            <span className="badge badge-primary flex items-center">
                                              <FiInfo className="mr-1" /> Check Job
                                            </span>
                                          ) : (
                                            <span className="badge badge-success flex items-center">
                                              <FiCheck className="mr-1" /> Ready
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Dispenser Info Modal */}
          {currentDispenserInfo && (
            <DispenserModal
              isOpen={currentDispenserInfo === 'show'}
              onClose={() => {
                setCurrentDispenserInfo(null);
                setSelectedOrderId(null);
              }}
              dispensers={workOrders.find(order => order.id === selectedOrderId)?.dispensers as any[] || []}
              orderId={selectedOrderId}
              sortFuelTypes={(gradeString: string) => {
                if (!gradeString) return [];
                // Split by commas and sort by fuel grade priority
                return gradeString.split(',').map(g => g.trim()).sort((a, b) => {
                  const aLower = a.toLowerCase();
                  const bLower = b.toLowerCase();
                  
                  if (aLower.includes('regular') && !bLower.includes('regular')) return -1;
                  if (!aLower.includes('regular') && bLower.includes('regular')) return 1;
                  if (aLower.includes('plus') && !bLower.includes('plus')) return -1;
                  if (!aLower.includes('plus') && bLower.includes('plus')) return 1;
                  if (aLower.includes('premium') && !bLower.includes('premium')) return -1;
                  if (!aLower.includes('premium') && bLower.includes('premium')) return 1;
                  if (aLower.includes('diesel') && !bLower.includes('diesel')) return -1;
                  if (!aLower.includes('diesel') && bLower.includes('diesel')) return 1;
                  
                  return a.localeCompare(b);
                });
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FiltersRedesign;
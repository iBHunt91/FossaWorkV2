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

// Function to get meter type (example, ensure this matches your actual logic)
const getMeterType = (order: WorkOrder): string => {
  const instructions = order.instructions?.toLowerCase() || '';
  if (instructions.includes('electronic meter') || instructions.includes('electronics')) return 'Electronic';
  if (instructions.includes('hd meter')) return 'HD Meter';
  if (instructions.includes('ecometer')) return 'Ecometer';
  // Add checks for services description if necessary
  return 'Unknown'; 
};

// Function to check for DEF/HighFlow (example, ensure this matches your actual logic)
const checkForSpecialFuelTypes = (order: WorkOrder): { hasDEF: boolean; hasDieselHighFlow: boolean; } => {
  // Simplified check - needs your detailed logic from original file
  const instructions = order.instructions?.toLowerCase() || '';
  const hasDEF = instructions.includes('def') || order.services?.some(s => s.description?.toLowerCase().includes('def'));
  const hasDieselHighFlow = instructions.includes('high flow diesel') || order.services?.some(s => s.description?.toLowerCase().includes('high flow'));
  return { hasDEF: !!hasDEF, hasDieselHighFlow: !!hasDieselHighFlow };
};

const FiltersRedesign: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { addToast } = useToast();
  const { dispenserData: dispenserDataContextValue, loadDispenserData, isLoaded: isDispenserDataLoaded } = useDispenserData();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(scrapedData.workOrders);
  const [isLoading, setIsLoading] = useState<boolean>(true); // For overall page/data loading
  const [isReloading, setIsReloading] = useState<boolean>(false); // For refresh data button
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
  
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(Date.now());
  
  const workWeekStart = 1; 
  const workWeekEnd = 5;   
  
  const [currentDispenserInfo, setCurrentDispenserInfo] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [currentDispenserDataForModal, setCurrentDispenserDataForModal] = useState<any[]>([]); // Renamed for clarity
  const [hasDispenserInfoForModal, setHasDispenserInfoForModal] = useState(false); // Renamed
  
  const [selectedFilterType, setSelectedFilterType] = useState<string | null>(null);

  // Corrected state for initial loading based on dispenser data context
  useEffect(() => {
    if (!isDispenserDataLoaded) {
      setIsLoading(true);
      // loadDispenserData(); // Assuming loadDispenserData is called elsewhere or by context
    } else {
      setIsLoading(false);
    }
  }, [isDispenserDataLoaded]);


  const { 
    currentWeekStart: cwStart, 
    currentWeekEnd: cwEnd, 
  } = getWorkWeekDateRanges(workWeekStart, workWeekEnd, currentWeek);

  const formatDateRange = (start: Date, end: Date) => {
    if (!start || !end) return "Invalid date range";
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const handlePreviousWeek = () => setCurrentWeek(subDays(cwStart, 7));
  const handleNextWeek = () => setCurrentWeek(addDays(cwStart, 7));
  const goToCurrentWeek = () => setCurrentWeek(new Date());

  const getWorkWeekLabel = (date: Date) => {
    const { currentWeekStart, currentWeekEnd } = getWorkWeekDateRanges(workWeekStart, workWeekEnd, date);
    return `${format(currentWeekStart, 'MMM d')} - ${format(currentWeekEnd, 'MMM d, yyyy')}`;
  };
  
  const loadInitialData = useCallback(async () => { 
    setIsLoading(true);
    console.log("Loading initial data...");
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    setWorkOrders(scrapedData.workOrders); // Assuming this is the base data source for now
    
    const processedNeeds: ExtendedFilterNeed[] = [];
    const processedWarnings = new Map<string, ExtendedFilterWarning[]>();
    const currentDispenserData = dispenserDataContextValue || {}; // Use context value

    // Process all work orders from the source (scrapedData.workOrders for now)
    scrapedData.workOrders.forEach(wo => {
      // Pass necessary context/data if calculateFilters expects it, e.g., dispenser data for the order
      const orderDispenserData = currentDispenserData[wo.id as keyof typeof currentDispenserData] || {};
      // Assuming calculateFilters returns { gasFilters: number, dieselFilters: number, warnings: FilterWarning[] }
      const calcResult = calculateFiltersForWorkOrder(wo, orderDispenserData); 

      const { gasFilters, dieselFilters, warnings } = calcResult;
      
      // Common visit/store info
      const visitData = wo.visits?.nextVisit;
      const visitId = visitData?.visitId || 'N/A';
      const visitDate = visitData?.date || 'N/A';
      const storeName = wo.customer?.name || 'Unknown Store';
      
      // Determine station type (Simplified - use your robust logic)
      let stationType = 'Unknown';
      if (storeName.includes('7-Eleven') || storeName.includes('Speedway')) stationType = '7-Eleven';
      else if (storeName.includes('Wawa')) stationType = 'Wawa';
      else if (storeName.includes('Circle K')) stationType = 'Circle K';

      // Determine filter parts based on station type and potentially meter type
      let gasFilterPart: string | null = null;
      let dieselFilterPart: string | null = null;
      let defFilterPart: string | null = null;

      const stationConfig = STATION_FILTERS[stationType as keyof typeof STATION_FILTERS];
      if (stationConfig) {
        if (stationType === '7-Eleven') {
          const meterType = getMeterType(wo);
          const meterKey = meterType.includes('HD') ? 'HD Meter' : meterType.includes('Eco') ? 'Ecometer' : 'Electronic';
          gasFilterPart = stationConfig.GAS[meterKey as keyof typeof stationConfig.GAS] || stationConfig.GAS.default;
          dieselFilterPart = stationConfig.DIESEL[meterKey as keyof typeof stationConfig.DIESEL] || stationConfig.DIESEL.default;
          if (checkForSpecialFuelTypes(wo).hasDEF) { // Check for DEF
             defFilterPart = stationConfig.DEF;
          }
        } else {
          gasFilterPart = stationConfig.GAS;
          dieselFilterPart = stationConfig.DIESEL;
        }
      }
      
      // Add needs based on calculated counts and determined part numbers
      if (gasFilters > 0 && gasFilterPart) {
        processedNeeds.push({
          partNumber: gasFilterPart,
          type: 'GAS',
          quantity: gasFilters,
          stores: [storeName],
          stationType,
          orderId: wo.id,
          visitId,
          visitDate,
          storeName,
          filterType: 'GAS'
        });
      }
      if (dieselFilters > 0 && dieselFilterPart) {
        processedNeeds.push({
          partNumber: dieselFilterPart,
          type: 'DIESEL',
          quantity: dieselFilters,
          stores: [storeName],
          stationType,
          orderId: wo.id,
          visitId,
          visitDate,
          storeName,
          filterType: 'DIESEL'
        });
      }
      // Add DEF if applicable
       if (defFilterPart) { // Check if defFilterPart was assigned
         processedNeeds.push({
           partNumber: defFilterPart,
           type: 'DIESEL', // Treat DEF as DIESEL type for categorization
           quantity: 1, // Assuming 1 DEF filter needed if detected
           stores: [storeName],
           stationType,
           orderId: wo.id,
           visitId,
           visitDate,
           storeName,
           filterType: 'DEF' // Specific type marker
         });
       }
      
      // Process warnings
      if (warnings && warnings.length > 0) {
        processedWarnings.set(wo.id, warnings.map(w => ({ ...w, orderId: wo.id, storeName })));
      }
    });

    setFilterNeeds(processedNeeds);
    setFilterWarnings(processedWarnings);
    setIsLoading(false);
  }, [dispenserDataContextValue, addToast]);

  const reloadData = useCallback(async () => { 
    setIsReloading(true);
    addToast({ type: 'info', message: 'Refreshing filter data...' }, 3000); // Still needs signature fix
    await loadInitialData(); 
    setIsReloading(false);
    addToast({ type: 'success', message: 'Filter data refreshed!' }, 3000); // Still needs signature fix
  }, [loadInitialData, addToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]); // Initial load

  // --- Original helper functions need to be here or ensure they are correctly defined ---
  // For example:
  const getTotalQuantity = (partNumber: string): number => {
    return filterNeeds.filter(fn => fn.partNumber === partNumber).reduce((sum, fn) => sum + fn.quantity, 0);
  };
  const getAllFilterTypes = (): string[] => {
    const types = new Set(filterNeeds.map(fn => fn.partNumber).filter(pn => pn) as string[]); // Added filter(pn => pn) and type assertion
    return Array.from(types);
  };
  const getBoxesNeeded = (quantity: number): number => Math.ceil(quantity / 10); 
  
  const getTotalFiltersNeeded = (): number => filterNeeds.reduce((sum, fn) => sum + fn.quantity, 0);
  const getTotalBoxesNeeded = (): number => {
    const total = getTotalFiltersNeeded();
    return getBoxesNeeded(total); // This might need more nuanced logic if boxes are per part number
  };

  const prepareCSVData = (): CSVFilterSummary[] => {
    // This needs to be adapted from your original prepareCSVData logic
    // using the `filterNeeds` and `filterWarnings` state.
    const csvData: CSVFilterSummary[] = [];
    const allTypes = getAllFilterTypes();

    allTypes.forEach(partNumber => {
        const relevantNeeds = filterNeeds.filter(fn => fn.partNumber === partNumber);
        const totalQuantity = relevantNeeds.reduce((sum, fn) => sum + fn.quantity, 0);
        const stores = Array.from(new Set(relevantNeeds.map(fn => fn.storeName))).join(', ');
        // Simplified warnings for CSV - you might want more detail
        const warningsSummary = Array.from(filterWarnings.values())
                                .flat()
                                .filter(w => w.partNumber === partNumber)
                                .map(w => w.message)
                                .join('; ');

        csvData.push({
            'Part Number': partNumber,
            'Type': relevantNeeds[0]?.filterType || 'N/A', // Assuming filterType is on ExtendedFilterNeed
            'Quantity': totalQuantity,
            'Boxes Needed': getBoxesNeeded(totalQuantity),
            'Stores': stores,
            'Warnings': warningsSummary,
            'Visit ID': relevantNeeds.map(fn => fn.visitId).join(', ') || 'N/A', // Example
            'Date': relevantNeeds.map(fn => fn.visitDate).join(', ') || 'N/A' // Example
        });
    });
    if (csvData.length === 0) { // Add a row for "No data" if empty
        return [{'Part Number': 'No filter data available', 'Type': '', 'Quantity': '', 'Boxes Needed': '', 'Stores': '', 'Warnings': '', 'Visit ID': '', 'Date': ''}];
    }
    return csvData;
  };
  
  const filteredWorkOrders = useMemo(() => {
    // This is a placeholder for your actual filtering logic based on searchTerm, currentWeek, selectedFilterType etc.
    // It should operate on the `workOrders` state and potentially `filterNeeds`
    let items = workOrders.filter(wo => {
        const visitDateStr = wo.visits?.nextVisit?.date; // Changed from Visit_1 to nextVisit
        if (visitDateStr) {
            const visitDate = parseISO(visitDateStr);
            if (visitDate < cwStart || visitDate > cwEnd) {
                return false;
            }
        }
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            return (
                wo.id?.toLowerCase().includes(lowerSearchTerm) ||
                wo.customer?.name?.toLowerCase().includes(lowerSearchTerm) ||
                (wo as any).workOrderId?.toLowerCase().includes(lowerSearchTerm) || // Added type assertion as fallback
                filterNeeds.some(fn => fn.orderId === wo.id && fn.partNumber?.toLowerCase().includes(lowerSearchTerm))
            );
        }
        return true;
    });

    if (sortConfig !== null) {
        items.sort((a, b) => {
            const key = sortConfig.key;
            let valA = key === 'store' ? a.customer?.name : (key === 'date' ? a.visits?.nextVisit?.date : a.id); // Changed from Visit_1
            let valB = key === 'store' ? b.customer?.name : (key === 'date' ? b.visits?.nextVisit?.date : b.id); // Changed from Visit_1

            if (valA === undefined || valA === null) valA = ''; // Check for null as well
            if (valB === undefined || valB === null) valB = ''; // Check for null as well

            if (String(valA) < String(valB)) { // Convert to string for comparison
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (String(valA) > String(valB)) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
    return items;
  }, [workOrders, searchTerm, sortConfig, currentWeek, filterNeeds, cwStart, cwEnd]); // Added dependencies

  const paginatedWorkOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWorkOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWorkOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredWorkOrders.length / itemsPerPage);

  const handleSort = (key: 'visitId' | 'store' | 'date') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Render functions with new styling
  const renderWeeklySummaryCards = () => {
    const summaryData = [
      { title: "Total Filters Needed", value: getTotalFiltersNeeded(), icon: <FiFilter className="text-primary-500 dark:text-primary-400" />, id: "total-filters" },
      { title: "Total Boxes Needed", value: getTotalBoxesNeeded(), icon: <FiBox className="text-accent-green-500 dark:text-accent-green-400" />, id: "total-boxes" },
      { title: "Work Orders This Week", value: filteredWorkOrders.length, icon: <FiList className="text-accent-blue-500 dark:text-accent-blue-400" />, id: "total-wo" },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        {summaryData.map((item) => (
          <div key={item.id} className="card"> {/* Ensure card class from index.css is applied */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300">{item.title}</h3>
              <span className="text-xl sm:text-2xl">{item.icon}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderFilterBreakdown = () => {
    const allTypes = getAllFilterTypes();
    if (allTypes.length === 0 && !isLoading && !isReloading) return (
        <div className="panel mb-6">
            <div className="panel-header">
                <h2 className="panel-title">Filter Breakdown by Type</h2>
            </div>
            <p className="p-4 text-gray-500 dark:text-gray-400">No filter data processed for the selected period.</p>
        </div>
    );
    
    const gridColsClass = allTypes.length === 1 ? 'md:grid-cols-1' :
                         allTypes.length === 2 ? 'md:grid-cols-2' : 
                         allTypes.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4';

    return (
      <div className="panel mb-6"> {/* Ensure panel class from index.css is applied */}
        <div className="panel-header"> {/* Ensure panel-header class from index.css is applied */}
          <h2 className="panel-title">Filter Breakdown by Type</h2> {/* Ensure panel-title class from index.css is applied */}
        </div>
        { (isLoading || isReloading) && !allTypes.length ? <p className="p-4 text-center text-gray-500 dark:text-gray-400">Calculating breakdown...</p> :
        <div className={`grid grid-cols-1 ${gridColsClass} gap-4 mt-4 p-1`}> {/* Added p-1 to panel content for cards */}
          {allTypes.map(type => {
            const quantity = getTotalQuantity(type);
            const boxes = getBoxesNeeded(quantity);
            return (
              <div key={type} className="card-subtle p-3 sm:p-4"> {/* Ensure card-subtle class from index.css is applied */}
                <h4 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate" title={type}>{type}</h4>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Qty: <span className="font-bold text-primary-600 dark:text-primary-400">{quantity}</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Boxes: <span className="font-bold text-accent-green-600 dark:text-accent-green-400">{boxes}</span>
                </p>
              </div>
            );
          })}
        </div>
        }
      </div>
    );
  };

  const renderFilterWarnings = () => {
    const allWarnings = Array.from(filterWarnings.values()).flat();
    if (allWarnings.length === 0 && !isLoading && !isReloading) return null; // Don't render section if no warnings

    // Group warnings by message or part number for a cleaner display
    const groupedWarnings = allWarnings.reduce((acc, warning) => {
        const key = warning.message || warning.partNumber || 'Unknown Warning';
        if (!acc[key]) {
            acc[key] = { 
                message: warning.message || `Warning for part: ${warning.partNumber}`,
                count: 0, 
                severity: warning.severity || 3, // Default to low severity
                stores: new Set<string>()
            };
        }
        acc[key].count++;
        if(warning.storeName) acc[key].stores.add(warning.storeName);
        // Potentially upgrade severity if a more severe warning of the same type exists
        if(warning.severity && warning.severity < acc[key].severity) {
            acc[key].severity = warning.severity;
        }
        return acc;
    }, {} as Record<string, {message: string, count: number, severity: number, stores: Set<string>}>);


    return (
      <div className="panel mb-6">
        <div className="panel-header">
          <h2 className="panel-title flex items-center">
            <FiAlertTriangle className="mr-2 text-accent-amber-500 dark:text-accent-amber-400" />
            Important Alerts & Warnings
          </h2>
        </div>
        { (isLoading || isReloading) && !Object.keys(groupedWarnings).length ? <p className="p-4 text-center text-gray-500 dark:text-gray-400">Checking for warnings...</p> :
        <div className="mt-4 space-y-3 p-1"> {/* Added p-1 to panel content */}
          {Object.entries(groupedWarnings).map(([key, warningDetails]) => {
            let borderColor = 'border-gray-300 dark:border-gray-600'; // Default
            let iconColor = 'text-gray-500 dark:text-gray-400';
            let IconComponent = FiInfo;

            if (warningDetails.severity === 1) { // Critical
              borderColor = 'border-red-500 dark:border-red-400';
              iconColor = 'text-red-500 dark:text-red-400';
              IconComponent = FiAlertCircle;
            } else if (warningDetails.severity === 2) { // Medium / Warning
              borderColor = 'border-accent-amber-500 dark:border-accent-amber-400';
              iconColor = 'text-accent-amber-500 dark:text-accent-amber-400';
              IconComponent = FiAlertTriangle;
            }
            const affectedStores = Array.from(warningDetails.stores).slice(0,3).join(', ') + (warningDetails.stores.size > 3 ? '...' : '');

            return (
              <div key={key} className={`list-item border-l-4 ${borderColor} p-3 sm:p-4`}> {/* Ensure list-item from index.css */}
                <div className="flex items-start">
                  <IconComponent className={`h-5 w-5 ${iconColor} mr-3 mt-0.5 flex-shrink-0`} />
                  <div className="flex-grow">
                    <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">{warningDetails.message}</p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Instances: <span className="font-medium">{warningDetails.count}</span>
                      {warningDetails.stores.size > 0 && ` (Stores: ${affectedStores})`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
           {Object.keys(groupedWarnings).length === 0 && !isLoading && !isReloading && (
             <p className="p-4 text-gray-500 dark:text-gray-400">No warnings for the selected period.</p>
           )}
        </div>
        }
      </div>
    );
  };


  if (isLoading && !isDispenserDataLoaded) { 
    return (
      <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col items-center justify-center">
        <FiSliders className="text-5xl text-primary-500 dark:text-primary-400 animate-spin-slow mb-4" />
        <p className="text-xl text-gray-700 dark:text-gray-300">Loading initial filter data...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header Section */}
      <header className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Filter Needs & Planning
          </h1>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <CSVLink
              data={prepareCSVData()}
              filename={`filter_summary_${format(cwStart, 'yyyy-MM-dd')}_-_${format(cwEnd, 'yyyy-MM-dd')}.csv`}
              className="btn btn-secondary text-sm sm:text-base" 
            >
              <FiDownload className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Download CSV
            </CSVLink>
            <button 
              onClick={reloadData} 
              className={`btn btn-secondary text-sm sm:text-base ${isReloading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isReloading}
            >
              <FiRefreshCw className={`mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 ${isReloading ? 'animate-spin-slow' : ''}`} /> 
              {isReloading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Date Navigation and Search */}
        <div className="panel p-4 mb-6"> {/* Wrapped in a panel for better grouping */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
            {/* Date Navigation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button onClick={handlePreviousWeek} className="btn btn-secondary p-2 h-full" aria-label="Previous Week">
                  <FiChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={handleNextWeek} className="btn btn-secondary p-2 h-full" aria-label="Next Week">
                  <FiChevronRight className="h-5 w-5" />
                </button>
              </div>
              <DatePicker
                selected={currentWeek}
                onChange={(date: Date | null) => date && setCurrentWeek(date)}
                dateFormat="MMM d, yyyy"
                className="input w-full sm:w-auto text-sm sm:text-base"
                calendarClassName="business-week-calendar"
                popperPlacement="bottom-start"
              />
              <button onClick={goToCurrentWeek} className="btn btn-secondary whitespace-nowrap text-sm sm:text-base h-full">
                Current Week
              </button>
              <div className="p-2.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium text-center sm:text-left text-sm sm:text-base whitespace-nowrap h-full flex items-center justify-center">
                {getWorkWeekLabel(currentWeek)}
              </div>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search WO ID, Store, Part..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full text-sm sm:text-base" 
              />
            </div>
          </div>
        </div>
      </header>

      {renderWeeklySummaryCards()}
      {renderFilterWarnings()} {/* Moved warnings up for visibility */}
      {renderFilterBreakdown()}
      
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Work Orders & Filter Details</h2>
          {/* Add sorting controls, view toggles etc. here if needed */}
        </div>
        <div className="overflow-x-auto">
          { (isLoading || isReloading) && !paginatedWorkOrders.length ? 
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">
                {isLoading ? 'Loading work orders...' : 'Refreshing work orders...'}
            </p> :
            !filteredWorkOrders.length ?
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">
                No work orders found for the selected criteria.
            </p> :
          <table className="w-full min-w-max"> {/* Using a table for structured data */}
            <thead className="bg-gray-100 dark:bg-gray-700/50">
              <tr>
                {/* Example Sortable Header - Repeat for other relevant columns */}
                <th className="p-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => handleSort('visitId')}>
                  WO / Visit ID <FiArrowDown className={`inline ml-1 h-3 w-3 ${sortConfig?.key === 'visitId' && sortConfig.direction === 'desc' ? 'text-primary-500' : ''}`} /> <FiArrowUp className={`inline ml-0.5 h-3 w-3 ${sortConfig?.key === 'visitId' && sortConfig.direction === 'asc' ? 'text-primary-500' : ''}`} />
                </th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => handleSort('store')}>
                  Store <FiArrowDown className={`inline ml-1 h-3 w-3 ${sortConfig?.key === 'store' && sortConfig.direction === 'desc' ? 'text-primary-500' : ''}`} /> <FiArrowUp className={`inline ml-0.5 h-3 w-3 ${sortConfig?.key === 'store' && sortConfig.direction === 'asc' ? 'text-primary-500' : ''}`} />
                </th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => handleSort('date')}>
                  Date <FiArrowDown className={`inline ml-1 h-3 w-3 ${sortConfig?.key === 'date' && sortConfig.direction === 'desc' ? 'text-primary-500' : ''}`} /> <FiArrowUp className={`inline ml-0.5 h-3 w-3 ${sortConfig?.key === 'date' && sortConfig.direction === 'asc' ? 'text-primary-500' : ''}`} />
                </th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Filter Needs</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedWorkOrders.map(order => {
                const orderNeeds = filterNeeds.filter(fn => fn.orderId === order.id);
                const orderWarnings = filterWarnings.get(order.id) || [];
                // Determine overall row severity for potential highlighting (optional)
                // const rowSeverity = orderWarnings.length ? Math.min(...orderWarnings.map(w => w.severity || 3)) : 0;
                // let rowClass = 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50';
                // if (rowSeverity === 1) rowClass = 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50';
                // else if (rowSeverity === 2) rowClass = 'bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50';
                
                return (
                  <tr key={order.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-150">
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{(order as any).workOrderId || order.id}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{order.visits?.nextVisit?.visitId || 'N/A'}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{order.customer?.name || 'N/A'}</td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{order.visits?.nextVisit?.date ? format(parseISO(order.visits.nextVisit.date), 'MMM d, yyyy') : 'N/A'}</td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                      {orderNeeds.length > 0 ? (
                        <ul className="space-y-0.5">
                          {orderNeeds.map(need => (
                            <li key={need.partNumber} className="text-xs">
                              <span className={`badge ${need.filterType === 'GAS' ? 'badge-primary' : need.filterType === 'DIESEL' ? 'badge-success' /* Example */ : 'badge-warning'}`}>{need.partNumber}</span> x {need.quantity}
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-xs text-gray-400 italic">No specific filters calculated</span>}
                    </td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      <button 
                        // onClick={() => handleViewDispenserData(order)} // Ensure this function is defined
                        className="btn btn-secondary btn-sm p-1.5 text-xs" // Smaller button for table
                        title="View Dispenser Data (Placeholder)"
                      >
                        <FiEye className="h-4 w-4" /> 
                      </button>
                      {/* Add other actions like edit if needed */}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          }
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage === 1}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              <FiChevronLeft className="mr-1 h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage === totalPages}
              className="btn btn-secondary text-sm disabled:opacity-50"
            >
              Next <FiChevronRight className="ml-1 h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {currentDispenserInfo && selectedOrderId && (
        <DispenserModal
          isOpen={!!currentDispenserInfo}
          onClose={() => {
            setCurrentDispenserInfo(null);
            setSelectedOrderId(null);
            setCurrentDispenserDataForModal([]);
          }}
          dispensers={currentDispenserDataForModal}
          orderId={selectedOrderId}
        />
      )}
    </div>
  );
};

export default FiltersRedesign;
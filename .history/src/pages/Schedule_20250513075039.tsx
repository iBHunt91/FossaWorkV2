import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  FiCalendar, 
  FiX, 
  FiChevronDown, 
  FiInfo, 
  FiTool, 
  FiFileText, 
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
  FiMinimize,
  FiPieChart,
  FiActivity,
  FiTrendingUp,
  FiBarChart2,
  FiLogIn,
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
import StoreFilterNeedsModal from '../components/StoreFilterNeedsModal';

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

// Helper function to extract visit number (moved from inside Schedule component)
const extractVisitNumber = (order: WorkOrder): string => {
  if (!order || !order.visits?.nextVisit?.url) return 'N/A';
  // Visit URLs typically have format: /app/work/123456/visits/125361/
  const matches = order.visits.nextVisit.url.match(/\/visits\/(\d+)/);
  return matches && matches[1] ? matches[1] : 'N/A';
};

// --- Helper function to parse specific dispenser numbers from instructions ---
const parseSpecificDispenserInstructions = (instructions: string): number[] => {
  if (!instructions) return [];
  const dispenserNumbers: number[] = [];
  
  // Match paired dispensers like #1/2 or #3-4
  const pairedPattern = /#(\d+)[\/-](\d+)/g;
  const pairedMatches = [...instructions.matchAll(pairedPattern)];
  pairedMatches.forEach(match => {
    if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
    if (match[2]) dispenserNumbers.push(parseInt(match[2], 10));
  });
  
  // Match dispenser patterns like "Dispensers: #1, #2, #3"
  const regularPattern = /(?:(?:[Dd]ispenserss?|[Dd]isp)(?:\s*:)?\s*(?:#?\s*\d+(?:\s*,\s*#?\s*\d+)*)|(?:#\s*\d+(?:\s*,\s*#?\s*\d+)*))/g;
  const regularMatches = instructions.match(regularPattern);
  if (regularMatches) {
    regularMatches.forEach(match => {
      const numberMatches = match.match(/\d+/g);
      if (numberMatches) {
        numberMatches.forEach(num => {
          dispenserNumbers.push(parseInt(num, 10));
        });
      }
    });
  }
  
  // Match individual dispensers like #1 (but not part of other patterns)
  const individualPattern = /#(\d+)(?![\/\-\d])/g;
  const individualMatches = [...instructions.matchAll(individualPattern)];
  individualMatches.forEach(match => {
    if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
  });
  
  // Remove duplicates and return
  return [...new Set(dispenserNumbers)];
};

// --- Helper function to determine if a dispenser should be included based on specific numbers ---
const shouldIncludeDispenser = (dispenserTitle: string | undefined, specificDispenserNumbers: number[]): boolean => {
  if (!dispenserTitle || !specificDispenserNumbers.length) return true;
  
  // Check for paired dispensers (e.g., "1/2")
  const titleMatch = dispenserTitle.match(/^(\d+)[\/-](\d+)/);
  if (titleMatch && titleMatch[1] && titleMatch[2]) {
    const dispenser1 = parseInt(titleMatch[1]);
    const dispenser2 = parseInt(titleMatch[2]);
    return specificDispenserNumbers.includes(dispenser1) || specificDispenserNumbers.includes(dispenser2);
  }
  
  // Check for single dispenser number in title
  const singleMatch = dispenserTitle.match(/^#?(\d+)/);
  if (singleMatch && singleMatch[1]) {
    const dispenserNum = parseInt(singleMatch[1]);
    return specificDispenserNumbers.includes(dispenserNum);
  }
  
  return false;
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
    setFilteredWorkOrders(filtered);
  }, [workOrdersData.workOrders, activeFilter]); // favorites removed from dependency array
  
  const handleViewInstructions = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setSelectedInstructions(order.instructions || 'No instructions provided.');
    setSelectedJobTitle(`Instructions for ${order.customer.name} - ${order.workOrderId || order.id}`);
    setShowInstructionsModal(true);
  };

  const renderJobRow = (order: WorkOrder, dateGroupClass?: string) => {
    const storeType = getStoreTypeForFiltering(order);
    const styles = getStoreStyles(storeType);
    const visitNumber = extractVisitNumber(order);
    const filteredInstructionsOnCard = processInstructions(order.instructions, order);
    
    const jobDate = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
    const formattedJobDate = jobDate ? new Date(jobDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date N/A';

    const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
    const hasDispenserData = (order.dispensers && order.dispensers.length > 0) || (contextDispensers && contextDispensers.length > 0);
    
    const currentDispensers = (order.dispensers && order.dispensers.length > 0) 
        ? order.dispensers 
        : (contextDispensers && contextDispensers.length > 0 ? contextDispensers : []);
    const dispenserCount = currentDispensers.length;

    const handleViewDispenserDataUnified = (e: React.MouseEvent, currentOrder: WorkOrder) => {
      e.stopPropagation();
      setSelectedDispensers(currentDispensers);
      setSelectedOrderIdModal(currentOrder.id);
      setSelectedVisitNumberModal(extractVisitNumber(currentOrder));
      setShowDispenserModal(true);
    };

    const getWorkFossaUrl = (workOrderId?: string, visitId?: string) => {
      if (workOrderId && visitId && visitId !== 'N/A') {
        return `https://app.workfossa.com/workorders/${workOrderId}/visits/${visitId}`;
      } else if (workOrderId) {
        return `https://app.workfossa.com/workorders/${workOrderId}`;
      }
      return 'https://app.workfossa.com';
    };
    const fossaUrl = getWorkFossaUrl(order.workOrderId, visitNumber);

    // Styling based on the new screenshot
    const cardBgColor = 'bg-slate-900'; // Dark main background
    const cardHeaderBgColor = 'bg-slate-800'; // Slightly lighter header
    const textColor = 'text-gray-200';
    const subTextColor = 'text-gray-400';
    const iconColor = 'text-gray-400'; // General icon color
    const buttonIconColor = 'text-gray-300';
    
    const woBadgeBg = 'bg-blue-600'; // Blue badge for Work Order ID
    const woBadgeText = 'text-blue-100';
    const visitBadgeBg = 'bg-green-600'; // Green badge for Visit ID
    const visitBadgeText = 'text-green-100';
    const viewInstructionsButtonBg = 'bg-green-700 hover:bg-green-600';
    const viewInstructionsButtonText = 'text-green-100';

    return (
      <div
        key={order.id}
        className={`job-card ${cardBgColor} shadow-lg hover:shadow-xl rounded-md mb-3 border-l-4 ${styles.cardBorder} border border-gray-700 transition-all duration-300 hover:translate-y-[-2px] transform ${dateGroupClass || ''}`}
        data-store-type={storeType}
        data-work-order-id={order.workOrderId || 'N/A'}
        data-visit-id={visitNumber || 'N/A'}
      >
        {/* Header Section - More compact */}
        <div className={`${cardHeaderBgColor} p-2 flex justify-between items-center rounded-t-md relative`}>
          {/* No service count indicator as per request */}
          <div className="flex items-center">
            <h3 className={`text-sm font-semibold ${textColor}`}>
              {order.customer.name}
              {order.customer.storeNumber && (
                <span className={`text-xs ${subTextColor} ml-1`}>
                  #{order.customer.storeNumber.replace(/^#+/, '')}
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            {order.workOrderId && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${woBadgeBg} ${woBadgeText}`}>
                W-{order.workOrderId}
              </span>
            )}
            {visitNumber && visitNumber !== 'N/A' && (
               <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${visitBadgeBg} ${visitBadgeText}`}>
                #{visitNumber}
              </span>
            )}
          </div>
        </div>

        {/* Main Content Area - More compact layout */}
        <div className="p-3">
          <div className="grid grid-cols-12 gap-x-3 gap-y-2 items-start">
            {/* Visit Date - Takes 4/12 columns on all screens */}
            <div className="flex items-start col-span-4">
              <FiCalendar className={`h-3.5 w-3.5 mr-1.5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-xs ${subTextColor} leading-tight`}>Visit Date</p>
                <p className={`text-xs font-medium ${textColor} leading-tight`}>{formattedJobDate}</p>
              </div>
            </div>

            {/* Dispensers - Takes 3/12 columns on all screens */}
            <div className="flex items-start col-span-3">
              <GiGasPump className={`h-3.5 w-3.5 mr-1.5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-xs ${subTextColor} leading-tight`}>Dispensers</p>
                <p className={`text-xs font-medium ${textColor} leading-tight`}>
                  {dispenserCount} {dispenserCount !== 1 ? 'Units' : 'Unit'}
                </p>
              </div>
            </div>
            
            {/* Custom Instructions - Takes 5/12 columns on all screens */}
            <div className="flex items-start col-span-5">
              <FiFileText className={`h-3.5 w-3.5 mr-1.5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div className='flex-grow'>
                <p className={`text-xs ${subTextColor} leading-tight`}>Instructions</p>
                {order.instructions ? (
                  <p className={`text-xs font-medium ${textColor} leading-tight line-clamp-1 hover:line-clamp-2 transition-all`}>
                    {filteredInstructionsOnCard || "None"}
                  </p>
                ) : (
                  <p className={`text-xs font-medium ${textColor} leading-tight`}>None</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Icons Footer */}
        <div className="flex items-center justify-end p-1.5 border-t border-gray-700/50 relative group">
          {/* Primary Actions - Always visible */}
          <div className="flex gap-1.5">
            <button
              onClick={() => navigate(`/app/form-prep?workOrderId=${order.id}&visitId=${visitNumber}`)}
              className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-colors"
              title="Go to Form Prep"
            >
              <FiEdit3 className="h-3.5 w-3.5" />
              <span className="sr-only">Form Prep</span>
            </button>
            <button
              onClick={(e) => handleViewInstructions(e, order)}
              className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md shadow-sm transition-colors"
              title="View Full Instructions"
            >
              <FiEye className="h-3.5 w-3.5" />
              <span className="sr-only">View Instructions</span>
            </button>
            
            {/* More Options Button */}
            <button
              className="p-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md shadow-sm transition-colors relative z-20"
              title="More Options"
            >
              <FiChevronDown className="h-3.5 w-3.5 hidden group-hover:hidden" />
              <FiChevronUp className="h-3.5 w-3.5 group-hover:hidden" />
              <FiChevronDown className="h-3.5 w-3.5 group-hover:block hidden" />
            </button>
          </div>

          {/* Slide-out menu */}
          <div className="absolute right-0 top-0 z-10 bg-slate-800/95 rounded-md shadow-lg py-2 px-2
                        opacity-0 invisible transform translate-x-5
                        group-hover:opacity-100 group-hover:visible group-hover:translate-x-0
                        transition-all duration-300">
            {/* Primary Actions */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigate(`/app/form-prep?workOrderId=${order.id}&visitId=${visitNumber}`)}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Form Prep"
              >
                <FiEdit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => handleViewInstructions(e, order)}
                className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                title="Instructions"
              >
                <FiEye className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const visitData = order.visits?.nextVisit;
                  const relativeUrl = visitData?.url;
                  if (relativeUrl) {
                    const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://app.workfossa.com${relativeUrl.startsWith('/') ? relativeUrl : '/' + relativeUrl}`;
                    openWorkFossaWithLogin(fullUrl);
                  } else {
                    addToast('error', 'Visit URL not found for this order.');
                  }
                }}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                title="Open in WorkFossa"
              >
                <FiExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
            
            {/* Divider */}
            <div className="h-px w-full bg-gray-600 my-1.5"></div>
            
            {/* Dispenser Actions */}
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => handleViewDispenserDataUnified(e, order)}
                className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors"
                title="Dispenser Data"
              >
                <GiGasPump className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
                  if (!order.dispensers?.length && contextDispensers?.length) {
                    const orderWithDispensers = {
                      ...order,
                      dispensers: contextDispensers
                    };
                    setSelectedOrderForModal(orderWithDispensers);
                  } else {
                    setSelectedOrderForModal(order);
                  }
                  setIsFilterModalOpen(true);
                }}
                className="p-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
                title="Filter Needs"
              >
                <FiFilter className="h-3.5 w-3.5" />
              </button>
            </div>
            
            {/* Divider */}
            <div className="h-px w-full bg-gray-600 my-1.5"></div>
            
            {/* Data Management Actions */}
            <div className="flex items-center space-x-1">
              <button 
                onClick={(e) => handleForceRescrapeDispenserData(order.id, e)}
                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                title="Rescrape Dispenser Data"
              >
                <FiRefreshCw className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={(e) => handleClearDispenserData(order.id, e)}
                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                title="Clear Dispenser Data"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
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

    // Helper function to group orders by date
    const groupOrdersByDate = (orders: WorkOrder[]) => {
      const grouped: Record<string, WorkOrder[]> = {};
      
      orders.forEach(order => {
        const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
        if (!orderDateStr) {
          // If no date, put in an "unknown" group
          if (!grouped['unknown']) grouped['unknown'] = [];
          grouped['unknown'].push(order);
          return;
        }
        
        const dateKey = new Date(orderDateStr).toDateString();
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(order);
      });
      
      // Sort by date
      return Object.entries(grouped)
        .sort(([dateA], [dateB]) => {
          if (dateA === 'unknown') return 1;
          if (dateB === 'unknown') return -1;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
    };

    return (
      <>{sections.map(section => {
          if (section.orders.length === 0 && section.id !== 'current-week') return null;
          const isExpanded = expandedSections[section.id] || false;
          const displayLimit = section.id === 'other-dates' ? 4 : (section.id === 'current-week' || section.id === 'next-week' ? 100 : Infinity);
          
          // Group orders by date instead of showing them all in a list
          const groupedByDate = groupOrdersByDate(section.orders);
          const visibleGroups = isExpanded ? groupedByDate : groupedByDate.slice(0, displayLimit);
          const hiddenCount = section.orders.length - visibleGroups.reduce((acc, [_, orders]) => acc + orders.length, 0);

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
                <div className="p-2 sm:p-4 space-y-4">
                  {visibleGroups.map(([dateKey, ordersForDate]) => {
                    // Create a date badge to show as header for this group
                    const dateDisplay = dateKey === 'unknown' 
                      ? 'Unknown Date' 
                      : new Date(dateKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    
                    return (
                      <div key={dateKey} className="rounded-md overflow-hidden">
                                              {/* Date header for this group - More distinctive */}
                      <div className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 flex items-center justify-between rounded-t-md">
                        <div className="flex items-center">
                          <FiCalendar className="mr-2" />
                          <span className="font-medium">{dateDisplay}</span>
                        </div>
                        <div className="flex items-center bg-white dark:bg-blue-800 text-blue-700 dark:text-white px-2 py-1 rounded-md">
                          <span className="text-xs font-bold">{ordersForDate.length}</span>
                          <span className="text-xs ml-1">job{ordersForDate.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      
                      {/* Jobs for this date - New card-stack visual style */}
                      <div className="bg-blue-50 dark:bg-blue-900/10 pt-3 pb-2 px-3 rounded-b-md">
                        {ordersForDate.map((order, index) => {
                          const isLast = index === ordersForDate.length - 1;
                          return (
                            <div key={order.id} className="relative">
                              {/* Job card with visual indicator for grouping */}
                              <div className={`${!isLast ? 'mb-6' : 'mb-2'} relative`}>
                                {/* Same day indicator badge - only on non-first items */}
                                {index > 0 && (
                                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full z-10 whitespace-nowrap shadow-sm">
                                    Same Day
                                  </div>
                                )}
                                
                                {/* Vertical connector line */}
                                {!isLast && (
                                  <div className="absolute left-1/2 transform -translate-x-1/2 top-full h-6 w-0.5 bg-blue-300 dark:bg-blue-600 z-0"></div>
                                )}
                                
                                {renderJobRow(order, 'date-grouped-job')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>
                    );
                  })}
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
              ) : (<div className="p-6 text-center text-gray-500 dark:text-gray-400"><FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />No jobs scheduled for {section.title.toLowerCase()}.</div>)}
            </div>
          );
      })}</>
    );
  };

  // --- Compact View Rendering ---
  const renderCompactJobItem = (order: WorkOrder, index: number, total: number) => {
    const storeType = getStoreTypeForFiltering(order);
    const styles = getStoreStyles(storeType); // Use existing styles for consistency
    const visitNumber = extractVisitNumber(order);
    const isFirst = index === 0;
    const isLast = index === total - 1;

    return (
      <div className="relative">
        {/* Same day indicator - Only show for non-first items */}
        {!isFirst && (
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full z-10 whitespace-nowrap shadow-sm">
            Same Day
          </div>
        )}
        
        {/* Vertical connector line - For everything except the last item */}
        {!isLast && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-2 w-0.5 bg-blue-300 dark:bg-blue-600 z-0"></div>
        )}
        
        <div 
          key={order.id}
          className={`p-2 rounded-lg border ${styles.cardBorder} ${styles.cardBg} hover:shadow-sm transition-all duration-200 cursor-pointer ${!isFirst ? 'mt-3' : ''} ${!isLast ? 'mb-3' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
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
        </div>
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
          {/* Date header - More distinctive */}
          <div className={`p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${isToday ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-500 dark:bg-gray-600'}`}>
            <div className="flex flex-col">
              <span className="text-xs text-white font-medium">
                {date.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="font-semibold text-white">
                {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            {jobsForDay.length > 0 && (
              <div className="flex items-center bg-white dark:bg-gray-800 text-blue-700 dark:text-white px-2 py-1 rounded-md">
                <span className="text-xs font-bold">{jobsForDay.length}</span>
                <span className="text-xs ml-1">job{jobsForDay.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {/* Job cards */}
          <div className="flex-1 p-2 sm:p-3 overflow-y-auto min-h-[100px]">
            {visibleJobs.length > 0 ? visibleJobs.map((job, index) => renderCompactJobItem(job, index, visibleJobs.length)) : (
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
              onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() - 7); setSelectedDate(newStart); }} 
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
              onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() + 7); setSelectedDate(newStart); }} 
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

  const calendarEvents = useMemo((): CalendarEvent[] => {
    return filteredWorkOrders.map(wo => {
      const jobDate = wo.visits?.nextVisit?.date || wo.nextVisitDate || wo.visitDate || wo.scheduledDate || wo.date;
      return {
        id: wo.id,
        title: `${wo.customer.name}${wo.customer.storeNumber ? ` (#${wo.customer.storeNumber.replace(/^#+/, '')})` : ''}`,
        date: jobDate || new Date().toISOString(),
        storeType: getStoreTypeForFiltering(wo),
        storeNumber: wo.customer.storeNumber?.replace(/^#+/, '') || undefined,
        visitNumber: extractVisitNumber(wo) === 'N/A' ? undefined : extractVisitNumber(wo),
        dispensers: wo.dispensers, // This will be used by the modal logic below
        instructions: wo.instructions,
        services: wo.services,
      };
    });
  }, [filteredWorkOrders]); // Removed getStoreTypeForFiltering, extractVisitNumber as they are not directly producing different event structures per call

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
  }, [isLoading, groupAndSortWorkOrders]);

  // Function to open WorkFossa website with active user's credentials (Copied from Home.tsx)
  const openWorkFossaWithLogin = async (targetUrl: string = 'https://app.workfossa.com') => {
    try {
      // Get active user ID
      const activeUserId = localStorage.getItem('activeUserId');
      
      if (!activeUserId) {
        addToast('warning', 'No active user selected. Please select a user from the User Management page.');
        throw new Error('No active user found. Please select a user first.');
      }
      
      // Fetch active user's credentials
      const response = await fetch(`/api/users/${activeUserId}/credentials`);
      
      if (!response.ok) {
        addToast('error', 'Could not fetch user credentials. Ensure a user is selected and credentials are set.');
        throw new Error('Failed to get active user credentials');
      }
      
      const credentials = await response.json();
      
      if (!credentials.email || !credentials.password) {
        addToast('error', 'User credentials incomplete. Please update them in User Management.');
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
        addToast('error', result.message || 'Failed to open WorkFossa. Check console for details.');
        throw new Error(result.message || 'Failed to open WorkFossa');
      }
      
      // Show success toast
      addToast(
        'info',
        'Opening WorkFossa with active user credentials...'
      );
    } catch (error) {
      console.error('Error opening WorkFossa:', error);
      // Error toasts are handled by the specific error conditions above,
      // but a general one can be added here if needed.
      // addToast(
      //   'error',
      //   error instanceof Error ? error.message : 'An unknown error occurred while trying to open WorkFossa.'
      // );
    }
  };

  // --- Helper function to calculate stats for the schedule page header ---
  const calculateScheduleStats = () => {
    const currentWeekJobCount = filteredWorkOrders.filter(order => {
      const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!orderDateStr) return false;
      const orderDate = new Date(orderDateStr);
      orderDate.setHours(0,0,0,0);
      return orderDate >= workWeekDates.currentWeekStart && orderDate <= workWeekDates.currentWeekEnd;
    }).length;

    const nextWeekJobCount = filteredWorkOrders.filter(order => {
      const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!orderDateStr) return false;
      const orderDate = new Date(orderDateStr);
      orderDate.setHours(0,0,0,0);
      return orderDate >= workWeekDates.nextWeekStart && orderDate <= workWeekDates.nextWeekEnd;
    }).length;

    const storeDistributionForCurrentWeek: Record<string, number> = {};
    filteredWorkOrders.forEach(order => {
      const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!orderDateStr) return;
      const orderDate = new Date(orderDateStr);
      orderDate.setHours(0,0,0,0);

      if (orderDate >= workWeekDates.currentWeekStart && orderDate <= workWeekDates.currentWeekEnd) {
        const storeType = getStoreTypeForFiltering(order);
        storeDistributionForCurrentWeek[storeType] = (storeDistributionForCurrentWeek[storeType] || 0) + 1;
      }
    });

    const storeDistributionForNextWeek: Record<string, number> = {};
    filteredWorkOrders.forEach(order => {
      const orderDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date;
      if (!orderDateStr) return;
      const orderDate = new Date(orderDateStr);
      orderDate.setHours(0,0,0,0);

      if (orderDate >= workWeekDates.nextWeekStart && orderDate <= workWeekDates.nextWeekEnd) {
        const storeType = getStoreTypeForFiltering(order);
        storeDistributionForNextWeek[storeType] = (storeDistributionForNextWeek[storeType] || 0) + 1;
      }
    });

    return { currentWeekJobCount, nextWeekJobCount, storeDistributionForCurrentWeek, storeDistributionForNextWeek };
  };

  // --- Render function for the compact schedule page header ---
  const renderSchedulePageHeader = () => {
    if (isLoading) return null; // Or a compact skeleton loader

    const { currentWeekJobCount, nextWeekJobCount, storeDistributionForCurrentWeek, storeDistributionForNextWeek } = calculateScheduleStats();
    
    const currentWeekStoreDistributionArray = Object.entries(storeDistributionForCurrentWeek)
      .map(([type, count]) => ({
        type,
        name: type === '7-eleven' ? '7-Eleven' : type.charAt(0).toUpperCase() + type.slice(1).replace('-k', ' K'),
        count
      }))
      .sort((a,b) => b.count - a.count); // Sort by count desc

    const nextWeekStoreDistributionArray = Object.entries(storeDistributionForNextWeek)
      .map(([type, count]) => ({
        type,
        name: type === '7-eleven' ? '7-Eleven' : type.charAt(0).toUpperCase() + type.slice(1).replace('-k', ' K'),
        count
      }))
      .sort((a,b) => b.count - a.count); // Sort by count desc

    return (
      <div className="mb-3 mx-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Overview Section (Compact) */}
          <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 flex flex-col h-full">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
              <FiPieChart className="h-4 w-4 mr-1.5 text-primary-500" />
              Selected Week Overview
            </h3>
            <div className="flex flex-col space-y-1.5 flex-grow justify-around">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiActivity className="h-3.5 w-3.5 mr-1 text-blue-500" /> Current Week Jobs
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{currentWeekJobCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiTrendingUp className="h-3.5 w-3.5 mr-1 text-green-500" /> Next Week Jobs
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{nextWeekJobCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiList className="h-3.5 w-3.5 mr-1 text-purple-500" /> Total Active Jobs
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{filteredWorkOrders.length}</span>
              </div>
            </div>
          </div>

          {/* Store Distribution (Compact) */}
          <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
              <FiBarChart2 className="h-4 w-4 mr-1.5 text-primary-500" />
              Store Distribution
            </h3>
            {/* Current Week Distribution Sub-section */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 mb-0.5">Current Week:</h4>
              {currentWeekStoreDistributionArray.length > 0 ? (
                <div className="space-y-0.5">
                  {currentWeekStoreDistributionArray.slice(0, 2).map(store => { // Show top 2
                    const styles = getStoreStyles(store.type);
                    return (
                      <div key={`current-${store.type}`} className="flex items-center justify-between text-xs">
                        <span className={`flex items-center font-medium ${styles.text}`}>
                          <span className={`h-2 w-2 rounded-full mr-1.5 ${styles.dot}`}></span>
                          {store.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>{store.count}</span>
                      </div>
                    );
                  })}
                  {currentWeekStoreDistributionArray.length > 2 && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">+ {currentWeekStoreDistributionArray.length - 2} more</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">No jobs this week.</p>
              )}
            </div>

            {/* Next Week Distribution Sub-section */}
            <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-600">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Next Week:</h4>
              {nextWeekStoreDistributionArray.length > 0 ? (
                <div className="space-y-0.5">
                  {nextWeekStoreDistributionArray.slice(0, 2).map(store => { // Show top 2
                    const styles = getStoreStyles(store.type);
                    return (
                      <div key={`next-${store.type}`} className="flex items-center justify-between text-xs">
                        <span className={`flex items-center font-medium ${styles.text}`}>
                          <span className={`h-2 w-2 rounded-full mr-1.5 ${styles.dot}`}></span>
                          {store.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>{store.count}</span>
                      </div>
                    );
                  })}
                  {nextWeekStoreDistributionArray.length > 2 && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">+ {nextWeekStoreDistributionArray.length - 2} more</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">No jobs next week.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // State for the new filter needs modal
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WorkOrder | null>(null);

  return (
    <div className="container mx-auto p-4 animate-fadeIn">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Work Schedule</h1>
      {renderSchedulePageHeader()} {/* Call the new header function here */}
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
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="flex items-center gap-1 py-1.5 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() - 7); setSelectedDate(newStart); }} 
                title="Previous Week"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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
                    const orderContextDispensers = dispenserData?.dispenserData?.[originalOrder.id]?.dispensers;
                    const orderHasDispenserData = (originalOrder.dispensers && originalOrder.dispensers.length > 0) || (orderContextDispensers && orderContextDispensers.length > 0);

                    // For dispenser modal
                    if (orderHasDispenserData) {
                        let dispensersToShowOnClick = originalOrder.dispensers && originalOrder.dispensers.length > 0
                            ? originalOrder.dispensers
                            : (orderContextDispensers && orderContextDispensers.length > 0 ? orderContextDispensers : []);
                        setSelectedDispensers(dispensersToShowOnClick);
                        setSelectedOrderIdModal(originalOrder.id);
                        setSelectedVisitNumberModal(extractVisitNumber(originalOrder));
                        setShowDispenserModal(true);
                    } else {
                        setSelectedDispensers([]);
                        setSelectedOrderIdModal(originalOrder.id);
                        setSelectedVisitNumberModal(extractVisitNumber(originalOrder));
                        setShowDispenserModal(true);
                        addToast('info', 'No dispenser data available for this job.', 2000);
                    }
                    
                    // Set up for filter needs modal (if user clicks that button)
                    if (!originalOrder.dispensers?.length && orderContextDispensers?.length) {
                      // Create a new order object with dispensers from context
                      const orderWithDispensers = {
                        ...originalOrder,
                        dispensers: orderContextDispensers
                      };
                      setSelectedOrderForModal(orderWithDispensers);
                    } else {
                      setSelectedOrderForModal(originalOrder);
                    }
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
      {/* Render the modal */}
      {selectedOrderForModal && (
        <StoreFilterNeedsModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          workOrder={selectedOrderForModal as any} // Using 'as any' for now to bypass strict type checking due to potential Customer type mismatch
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default Schedule; 
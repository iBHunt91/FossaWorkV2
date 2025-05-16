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
  FiDatabase,
  FiBox
} from 'react-icons/fi'
import { GiGasPump } from 'react-icons/gi'
import LastScrapedTime from '../components/LastScrapedTime'
import NextScrapeTime from '../components/NextScrapeTime'
import ScrapeLogsConsole from '../components/ScrapeLogsConsole'
import DispenserModal from '../components/DispenserModal' 
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
type ViewType = 'weekly' | 'calendar';

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
  const [isLoading, setIsLoading] = useState(false); // Set initial loading state to false
  
  // UI state that should persist - use createState
  const [activeView, setActiveView] = createState<ViewType>('activeView', 'weekly');
  const [activeFilter, setActiveFilter] = createState<StoreFilter>('activeFilter', 'all');
  const [searchQuery, setSearchQuery] = createState<string>('searchQuery', '');

  // Filter totals for the filter breakdown component
  const [filterTotals, setFilterTotals] = useState({
    types: {
      '450MB-10': 3,
      '450MG-10': 2,
      '400MB-10': 4,
      '400HS-10': 2,
      '40510D-AD': 1,
      '40530W-AD': 2
    } as Record<string, number>,
    total: 14
  });
  
  // Calendar view state
  const today = new Date();
  const [currentMonth, setCurrentMonth] = createState<number>('currentMonth', today.getMonth());
  const [currentYear, setCurrentYear] = createState<number>('currentYear', today.getFullYear());
  
  // Work orders data state - don't persist these as they're loaded from API
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>(workOrdersData.workOrders as WorkOrder[]);
  const [loading, setLoading] = useState(false); // Set initial loading state to false
  const [selectedTab, setSelectedTab] = createState<string>('selectedTab', 'all');
  
  // Call this when loading data
  useEffect(() => {
    // Simulate loading work orders
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set sample data
        setWorkOrdersData({
          workOrders: [],
          metadata: {}
        });
        
        // Set filtered work orders
        setFilteredWorkOrders([]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter breakdown component
  const renderFilterBreakdown = () => {
    // Get all filter types from the work orders
    const filterTypes = Object.keys(filterTotals.types);
    
    // Group similar filter types (gas/diesel pairs)
    // Define the standard filter pairs with improved descriptions
    const filterPairs = [
      {
        types: ['450MB-10', '450MG-10'],
        description: 'Wayne 450 Filter Set'
      },
      {
        types: ['400MB-10', '400HS-10'],
        description: 'Wayne 400 Filter Set'
      },
      {
        types: ['40510D-AD', '40530W-AD'],
        description: 'Gilbarco Filter Set'
      },
      {
        types: ['40510A-AD', '40510W-AD'],
        description: 'Gilbarco Alternative Set'
      }
    ];
    
    // Find filter pairs that have at least one type present
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
    
    // Generate a descriptive name for a filter pair
    const generatePairName = (types: string[]) => {
      return types.join(' / ');
    };
    
    // Get count of filters needed for a specific type
    const getFilterCount = (type: string) => {
      return filterTotals.types[type] || 0;
    };

    // Function to clear all saved edits
    const clearAllSavedEdits = () => {
      // Implement this based on your requirements
      console.log("Clearing all saved edits");
      // Recalculate filter totals
      setFilterTotals({
        types: {
          '450MB-10': 3,
          '450MG-10': 2,
          '400MB-10': 4,
          '400HS-10': 2,
          '40510D-AD': 1,
          '40530W-AD': 2
        },
        total: 14
      });
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
                    return getFilterCount(type);
                  });
                  
                  // Calculate total needed
                  const totalNeeded = quantities.reduce((sum, qty) => sum + qty, 0);
                  
                  // Special case for styling based on pair contents
                  const isGasDieselPair = pair.types.some(type => type.includes('MB')) && 
                                          pair.types.some(type => type.includes('MG'));
                  
                  return (
                    <div 
                      key={`pair-${idx}`} 
                      className={`bg-white dark:bg-gray-800 rounded-lg border p-4 relative flex flex-col ${
                        isGasDieselPair 
                          ? 'border-l-4 border-l-blue-500 dark:border-l-blue-400' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center">
                          <FiBox className="mr-1.5 text-gray-500 dark:text-gray-400" />
                          {pair.description || generatePairName(pair.types)}
                        </div>
                        
                        {totalNeeded > 0 && (
                          <div className="ml-auto bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full">
                            {totalNeeded} needed
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3 mt-1 flex-grow">
                        {presentTypes.map(type => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                              <span className={`w-2 h-2 rounded-full mr-1.5 ${
                                type.includes('G') || type.includes('HS') 
                                  ? 'bg-blue-500 dark:bg-blue-400' 
                                  : 'bg-amber-500 dark:bg-amber-400'
                              }`}></span>
                              {type}
                            </div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {getFilterCount(type)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
            
          {/* Single filter types section */}
          {singleFilters.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Other Filter Types
              </h4>
              <div className={`grid ${getGridColumnsClass(singleFilters.length)} gap-4`}>
                {singleFilters.map(type => {
                  const count = getFilterCount(type);
                  const isGasFilter = type.includes('MG') || type.includes('HS');
                  
                  return (
                    <div 
                      key={type}
                      className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
                        isGasFilter 
                          ? 'border-l-4 border-l-blue-500 dark:border-l-blue-400' 
                          : 'border-l-4 border-l-amber-500 dark:border-l-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          {type}
                        </div>
                        {count > 0 && (
                          <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isGasFilter 
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' 
                              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                          }`}>
                            {count} needed
                          </div>
                        )}
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

  // Add renderPanel function to use with the filter breakdown
  const renderPanel = (id: string, title: string, icon: React.ReactElement, content: React.ReactNode) => {
    // Check if panel should be rendered based on selected tab
    if (selectedTab !== 'all' && selectedTab !== id) {
      return null;
    }
    
    return (
      <div className="panel mb-6 animate-fadeIn">
        <div className="panel-header">
          <h3 className="panel-title flex items-center">
            {icon} 
            <span className="ml-2">{title}</span>
          </h3>
        </div>
        <div className="panel-content">
          {content}
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-5 text-gray-800 dark:text-white">Dashboard</h1>
      
      {/* Loading state */}
      {isLoading ? (
        <div className="animate-pulse">
          <SkeletonDashboardStats />
          <div className="h-4"></div>
          <SkeletonJobsList />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Last Scraped Time */}
          <div className="panel p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300 flex items-center">
              <FiClock className="mr-2 text-blue-500 dark:text-blue-400" /> Data Freshness
            </h3>
            <div className="space-y-2">
              <LastScrapedTime />
              <NextScrapeTime />
            </div>
          </div>

          {/* Filter Breakdown Panel */}
          {renderFilterBreakdown()}
          
          {/* You would add other panels here */}
          {renderPanel(
            'overview',
            'Overview',
            <FiActivity className="mr-2 text-primary-500 dark:text-primary-400" />,
            <p>This is where the overview content will go. Statistics, charts, and key metrics can be displayed here.</p>
          )}

          {renderPanel(
            'tools',
            'Quick Tools',
            <FiTool className="mr-2 text-primary-500 dark:text-primary-400" />,
            <p>This section can contain quick access to common tools or actions relevant to the dashboard.</p>
          )}

          {renderPanel(
            'scrape-logs',
            'Scrape Logs',
            <FiFileText className="mr-2 text-primary-500 dark:text-primary-400" />,
            <ScrapeLogsConsole type="workOrder" />
          )}
        </div>
      )}
    </div>
  );
};

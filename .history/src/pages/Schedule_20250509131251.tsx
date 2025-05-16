import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  FiCalendar,
  FiGrid,
  FiList,
  FiRefreshCw,
  FiStar,
  FiFilter,
  FiX,
  FiFileText,
  FiTool,
  FiInfo,
  FiChevronDown
} from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { getWorkOrders } from '../services/scrapeService'
import CalendarView from '../components/CalendarView'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import InstructionsModal from '../components/InstructionsModal'
import DispenserModal from '../components/DispenserModal'
import { SkeletonJobsList } from '../components/Skeleton'
import { useDispenserData } from '../context/DispenserContext'

// Import types from Home page (will need to be moved to a shared types file)
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
  fields?: {[key: string]: string}; 
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

const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const { updateDispenser } = useDispenserData();
  
  // State declarations
  const [activeView, setActiveView] = useState<ViewType>('weekly');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([]);
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [selectedInstructions, setSelectedInstructions] = useState<string>('');
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>('');
  const [showDispenserModal, setShowDispenserModal] = useState<boolean>(false);
  const [selectedDispensers, setSelectedDispensers] = useState<Dispenser[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Work week settings (could be user preferences in the future)
  const workWeekStart = 1; // Monday
  const workWeekEnd = 5;   // Friday

  // Calculate work week dates based on the selected date
  const workWeekDates = useMemo(() => 
    getWorkWeekDateRanges(workWeekStart, workWeekEnd, selectedDate), 
    [selectedDate, workWeekStart, workWeekEnd]
  );

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Apply store filter when it changes
  useEffect(() => {
    if (workOrders.length > 0) {
      filterOrders();
    }
  }, [storeFilter, workOrders]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const rawData = await getWorkOrders(); // This returns an object { workOrders: [], metadata: {}, ... }
      
      // Ensure rawData and rawData.workOrders exist and rawData.workOrders is an array
      const workOrdersArray = rawData && Array.isArray(rawData.workOrders) ? rawData.workOrders : [];
      
      if (!(rawData && Array.isArray(rawData.workOrders))) {
        console.warn(
          'getWorkOrders (Schedule.tsx) did not return an object with a workOrders array. Received:',
          rawData
        );
        // addToast('warning', 'Received unexpected data format for work orders.');
      }
      
      // Use the extracted array
      setWorkOrders(workOrdersArray);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading work orders (Schedule.tsx):', error);
      addToast('error', 'Failed to load work orders');
      setIsLoading(false);
    }
  };

  const filterOrders = () => {
    if (storeFilter === 'all') {
      setFilteredOrders(workOrders);
    } else {
      setFilteredOrders(workOrders.filter(order => 
        getStoreTypeForFiltering(order) === storeFilter
      ));
    }
  };

  const getStoreTypeForFiltering = (order: any): string => {
    const customerName = (order.customer?.name || '').toLowerCase();
    
    if (customerName.includes('7-eleven') || customerName.includes('7 eleven')) {
      return '7-eleven';
    } else if (customerName.includes('circle k') || customerName.includes('circle-k')) {
      return 'circle-k';
    } else if (customerName.includes('wawa')) {
      return 'wawa';
    } else {
      return 'other';
    }
  };

  const getStoreStyles = (storeType: string) => {
    switch (storeType) {
      case '7-eleven':
        return {
          badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
          cardBorder: 'border-l-4 border-green-500',
          headerBg: 'bg-green-50 dark:bg-green-900/20',
          cardBg: 'bg-green-50 dark:bg-green-900/30',
          text: 'text-green-800 dark:text-green-200'
        };
      case 'circle-k':
        return {
          badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
          cardBorder: 'border-l-4 border-red-500',
          headerBg: 'bg-red-50 dark:bg-red-900/20',
          cardBg: 'bg-red-50 dark:bg-red-900/30',
          text: 'text-red-800 dark:text-red-200'
        };
      case 'wawa':
        return {
          badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
          cardBorder: 'border-l-4 border-purple-500',
          headerBg: 'bg-purple-50 dark:bg-purple-900/20',
          cardBg: 'bg-purple-50 dark:bg-purple-900/30',
          text: 'text-purple-800 dark:text-purple-200'
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
          cardBorder: 'border-l-4 border-blue-500',
          headerBg: 'bg-blue-50 dark:bg-blue-900/20',
          cardBg: 'bg-blue-50 dark:bg-blue-900/30',
          text: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  // Additional helper functions would need to be implemented here
  // These would be copied from Home.tsx

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Schedule</h1>
      
      {/* Main toolbar */}
      <div className="bg-gray-800 text-white rounded-xl shadow-lg mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 relative z-10">
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

            <div className="flex items-center ml-4">
              <button
                onClick={loadData}
                className="ml-2 p-2 rounded-full hover:bg-gray-700 transition-colors"
                title="Refresh data"
              >
                <FiRefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Store Filter */}
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-300">Filter:</div>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value as StoreFilter)}
              className="text-sm bg-gray-700 border-gray-600 rounded-md text-gray-200 px-3 py-2"
            >
              <option value="all">All stores</option>
              <option value="7-eleven">7-Eleven</option>
              <option value="circle-k">Circle K</option>
              <option value="wawa">Wawa</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content area */}
      {isLoading ? (
        <SkeletonJobsList />
      ) : (
        <div>
          {/* This is a placeholder - the actual implementation would include the weekly, calendar, and compact views */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
            <div className="text-center text-gray-600 dark:text-gray-300">
              {filteredOrders.length === 0 ? (
                <div className="py-10">
                  <p>No work orders found matching your criteria</p>
                </div>
              ) : (
                <p>To implement: Job cards view ({filteredOrders.length} jobs)</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instruction Modal */}
      <InstructionsModal 
        isOpen={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        instructions={selectedInstructions}
        title={selectedJobTitle}
      />

      {/* Dispenser Modal */}
      <DispenserModal 
        isOpen={showDispenserModal}
        onClose={() => setShowDispenserModal(false)}
        dispensers={selectedDispensers}
        orderId={selectedOrderId}
      />
    </div>
  )
}

export default Schedule 
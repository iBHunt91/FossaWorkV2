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
import DispenserModal from '../components/DispenserModal'
import { useNavigate } from 'react-router-dom'
import { clearDispenserData, forceRescrapeDispenserData, getDispenserScrapeStatus, getWorkOrders, getScrapeStatus, startScrapeJob, startDispenserScrapeJob } from '../services/scrapeService'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { useDispenserData } from '../context/DispenserContext'
import { 
  SkeletonDashboardStats, 
  SkeletonJobsList 
} from '../components/Skeleton'

// Import fuel grades list for proper ordering
import fuelGrades from '../data/fuel_grades';
import PersistentView, { usePersistentViewContext } from '../components/PersistentView';

// View type enum
type ViewType = 'weekly' | 'calendar';

// Store filter type
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

// Define the WorkOrder interface
interface WorkOrder {
  id: string;
  workOrderId?: string;
  customer: any;
  services: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: Record<string, any>;
  instructions: string;
  rawHtml: string;
  dispensers?: any[];
  scheduledDate?: string;
  nextVisitDate?: string;
  visitDate?: string;
  date?: string;
}

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
const HomeContent: React.FC = () => {
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
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  
  // Calendar view state
  const today = new Date();
  const [currentMonth, setCurrentMonth] = createState<number>('currentMonth', today.getMonth());
  const [currentYear, setCurrentYear] = createState<number>('currentYear', today.getFullYear());
  
  // Work orders data state - don't persist these as they're loaded from API
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrder[]>(workOrdersData.workOrders);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = createState<string>('selectedTab', 'all');
  const [searchTerm, setSearchTerm] = createState<string>('searchTerm', '');
  const [countsByCategory, setCountsByCategory] = useState<{[key: string]: number}>({});
  
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
      setFilteredWorkOrders(workOrdersResponse.workOrders);
      
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

  // Placeholder handler functions
  const handleOrderClick = (order: any) => {
    console.log('Order clicked:', order.id);
  };

  const renderDashboardHeader = () => {
    if (isLoading) {
      return <SkeletonDashboardStats />;
    }
    
    return (
      <div className="text-center p-4">
        <h2 className="text-xl font-semibold">Dashboard is loading...</h2>
        <p className="text-gray-500">Please wait while we prepare your data</p>
      </div>
    );
  };

  return (
    <div className="h-full max-w-full overflow-x-hidden">
      {/* Dashboard header with stats */}
      <div className="px-1 sm:px-0">
        {renderDashboardHeader()}
      </div>
      
      {/* Loading indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="text-center p-8">
          <h3 className="text-lg font-medium">Content is loading properly.</h3>
          <p className="text-gray-500">Please wait while the page fully renders.</p>
        </div>
      )}
    </div>
  );
};


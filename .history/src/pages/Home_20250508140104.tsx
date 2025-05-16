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
      <div className="h-full max-w-full overflow-x-hidden px-4 py-6">
        {/* Dashboard header with stats */}
        <div>
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
                          <div className="flex-1 p-2 space-y-1.5 overflow-visible">
                            {jobs.map(job => {
                              const storeType = getStoreTypeForFiltering(job);
                              const storeStyle = getStoreStyles(storeType);
                              
                              return (
                                <div 
                                  key={job.id}
                                  className={`p-1.5 rounded-lg border ${storeStyle.cardBorder} ${storeStyle.cardBg} hover:shadow-sm transition-all duration-200 cursor-pointer`}
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
                            
                            {/* No more "hidden job count" section */}
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
                            <div className="flex-1 p-2 space-y-1.5 overflow-visible">
                              {visibleJobs.map(job => {
                                const storeType = getStoreTypeForFiltering(job);
                                const storeStyle = getStoreStyles(storeType);
                                
                                return (
                                  <div 
                                    key={job.id}
                                    className={`p-1.5 rounded-lg border ${storeStyle.cardBorder} ${storeStyle.cardBg} hover:shadow-sm transition-all duration-200 cursor-pointer`}
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
                          <span>Other Scheduled Jobs</span>
                          <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                            {groupedWorkOrders.other.length}
                          </span>
                        </h4>
                      </div>
                      
                      <div className="p-3">
                        {/* Check if the other jobs section is expanded */}
                        {expandedSections['other-jobs'] ? (
                          // Show all jobs in a grid when expanded
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
          />
        )}
      </div>
    </PersistentView>
  );
}; // End of HomeContent component

export default Home;


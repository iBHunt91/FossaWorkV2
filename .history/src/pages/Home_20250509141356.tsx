import React, { useState, useCallback, useEffect } from 'react'
import { 
  FiActivity, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiClock, 
  FiFileText, 
  FiTool, 
  FiBriefcase, 
  FiExternalLink, 
  FiCalendar,
  FiRefreshCw,
  FiPieChart,
  FiTrendingUp,
  FiBarChart2,
  FiSettings,
  FiDatabase,
  FiShoppingBag,
  FiMapPin,
  FiUser,
  FiGlobe
} from 'react-icons/fi'
import { GiGasPump } from 'react-icons/gi'
import LastScrapedTime from '../components/LastScrapedTime'
import NextScrapeTime from '../components/NextScrapeTime'
import ScrapeLogsConsole from '../components/ScrapeLogsConsole'
import { useNavigate } from 'react-router-dom'
import { getWorkOrders, startScrapeJob, getScrapeStatus, startDispenserScrapeJob } from '../services/scrapeService'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { SkeletonDashboardStats } from '../components/Skeleton'
import PersistentView, { usePersistentViewContext } from '../components/PersistentView';
import JobFilterHeader from '../components/map/JobFilterHeader';

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

  // Update sessionStorage whenever status changes
  useEffect(() => {
    sessionStorage.setItem(`scrape-status-${key}`, JSON.stringify(status));
  }, [status, key]);

  return [status, setStatus] as const;
};

// Main component
const Home: React.FC = () => {
  // We'll use a standard height here since the context doesn't provide innerHeight
  const viewHeight = window.innerHeight || 768;
  
  return (
    <div style={{ height: viewHeight }} className="flex flex-col overflow-auto bg-gradient-to-br from-gray-200 to-gray-50 dark:from-gray-800 dark:to-gray-900">
      <HomeContent />
    </div>
  );
}

// Separated content component
const HomeContent = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const [jobStats, setJobStats] = useState<{
    total: number;
    sevenEleven: number;
    circleK: number;
    wawa: number;
    other: number;
    thisWeek: number;
    nextWeek: number;
    today: number;
    future: number;
  }>({
    total: 0,
    sevenEleven: 0,
    circleK: 0,
    wawa: 0,
    other: 0,
    thisWeek: 0,
    nextWeek: 0,
    today: 0,
    future: 0
  });
  
  const [workOrderScrapeStatus, setWorkOrderScrapeStatus] = usePersistentScrapeStatus('work-orders', {
    status: 'idle',
    progress: 0,
    message: ''
  });
  
  const [dispenserScrapeStatus, setDispenserScrapeStatus] = usePersistentScrapeStatus('dispensers', {
    status: 'idle',
    progress: 0,
    message: ''
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      const rawData = await getWorkOrders();
      
      // Ensure rawData and rawData.workOrders exist and rawData.workOrders is an array
      const workOrdersArray = rawData && Array.isArray(rawData.workOrders) ? rawData.workOrders : [];
      
      if (!(rawData && Array.isArray(rawData.workOrders))) {
        console.warn(
          'getWorkOrders did not return an object with a workOrders array. Received:',
          rawData
        );
        // addToast('warning', 'Received unexpected data format for work orders.');
      }
      
      // Use the extracted array
      const data = workOrdersArray;
      
      // Calculate statistics
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4); // Friday
      
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(weekStart.getDate() + 7);
      
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 4);
      
      let sevenEleven = 0;
      let circleK = 0;
      let wawa = 0;
      let other = 0;
      let thisWeek = 0;
      let nextWeek = 0;
      let todayJobs = 0;
      let future = 0;
      
      data.forEach((job: any) => {
        const customerName = (job.customer?.name || '').toLowerCase();
        
        // Store type count
        if (customerName.includes('7-eleven') || customerName.includes('7 eleven')) {
          sevenEleven++;
        } else if (customerName.includes('circle k') || customerName.includes('circle-k')) {
          circleK++;
        } else if (customerName.includes('wawa')) {
          wawa++;
        } else {
          other++;
        }
        
        // Date-based count
        const visitDate = new Date(
          job.visits?.nextVisit?.date || 
          job.nextVisitDate || 
          job.visitDate || 
          job.date || 
          now
        );
        
        if (visitDate >= today && visitDate < tomorrow) {
          todayJobs++;
        }
        
        if (visitDate >= weekStart && visitDate <= weekEnd) {
          thisWeek++;
        } else if (visitDate >= nextWeekStart && visitDate <= nextWeekEnd) {
          nextWeek++;
        }
        
        if (visitDate > tomorrow) {
          future++;
        }
      });
      
      setJobStats({
        total: data.length,
        sevenEleven,
        circleK,
        wawa,
        other,
        thisWeek,
        nextWeek,
        today: todayJobs,
        future
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast('error', 'Failed to load work order data');
      setIsLoading(false);
    }
  };
  
  const handleScrapeWorkOrders = async () => {
    try {
      setWorkOrderScrapeStatus({
        status: 'running',
        progress: 0,
        message: 'Starting work orders scraper...'
      });
      
      await startScrapeJob();
      
      // Start polling for status
      const pollId = setInterval(async () => {
        try {
          const status = await getScrapeStatus();
          setWorkOrderScrapeStatus(status);
          
          if (status.status === 'completed' || status.status === 'error') {
            clearInterval(pollId);
            
            if (status.status === 'completed') {
              addToast('success', 'Work orders scraped successfully!');
              loadData(); // Refresh data
            } else {
              addToast('error', `Scrape error: ${status.message || 'Unknown error'}`);
            }
          }
        } catch (error) {
          console.error('Error polling scrape status:', error);
          clearInterval(pollId);
          setWorkOrderScrapeStatus({
            status: 'error',
            progress: 0,
            message: 'Failed to check scrape status'
          });
          addToast('error', 'Failed to check scrape status');
        }
      }, 2000);
    } catch (error) {
      console.error('Error starting scrape job:', error);
      setWorkOrderScrapeStatus({
        status: 'error',
        progress: 0,
        message: 'Failed to start scraper'
      });
      addToast('error', 'Failed to start work order scraper');
    }
  };
  
  const handleScrapeDispenserData = async () => {
    try {
      setDispenserScrapeStatus({
        status: 'running',
        progress: 0,
        message: 'Starting dispenser scraper...'
      });
      
      await startDispenserScrapeJob();
      
      // Status polling would be implemented similarly
    } catch (error) {
      console.error('Error starting dispenser scrape job:', error);
      setDispenserScrapeStatus({
        status: 'error',
        progress: 0,
        message: 'Failed to start dispenser scraper'
      });
      addToast('error', 'Failed to start dispenser scraper');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Dashboard</h1>
      
      {/* Date Navigator */}
      <div className="mb-6">
        <JobFilterHeader 
          currentWeekDate={currentWeekDate}
          setCurrentWeekDate={setCurrentWeekDate}
          allJobs={jobStats.total > 0 ? [{ id: 'dummy', scheduledDate: new Date().toISOString(), latitude: 0, longitude: 0, customerName: 'dummy' }] : []} 
          usageContext={'dashboard'}
        />
      </div>
      
      {/* Stats Row */}
      {isLoading ? (
        <SkeletonDashboardStats />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Jobs</h3>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{jobStats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                <FiBriefcase className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {jobStats.today} today • {jobStats.future} scheduled
              </span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">This Week</h3>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{jobStats.thisWeek}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300">
                <FiCalendar className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {jobStats.nextWeek} next week
              </span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Store Types</h3>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{jobStats.sevenEleven + jobStats.circleK + jobStats.wawa}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300">
                <FiShoppingBag className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {jobStats.circleK} Circle K • {jobStats.sevenEleven} 7-Eleven • {jobStats.wawa} Wawa
              </span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Scraped</h3>
                <div className="text-xl font-bold text-gray-800 dark:text-white mt-1">
                  <LastScrapedTime />
                </div>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                <FiRefreshCw className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Next: <NextScrapeTime />
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Tools and Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Tools */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <button 
                onClick={() => navigate('/schedule')}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <FiCalendar className="h-8 w-8 mb-2 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Schedule</span>
              </button>
              
              <button 
                onClick={() => navigate('/job-map')}
                className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <FiMapPin className="h-8 w-8 mb-2 text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Job Map</span>
              </button>
              
              <button 
                onClick={() => navigate('/settings')}
                className="flex flex-col items-center justify-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <FiSettings className="h-8 w-8 mb-2 text-purple-600 dark:text-purple-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Settings</span>
              </button>
              
              <button 
                onClick={() => navigate('/form-prep')}
                className="flex flex-col items-center justify-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <FiFileText className="h-8 w-8 mb-2 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Forms</span>
              </button>
              
              <button 
                onClick={() => navigate('/circle-k')}
                className="flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <FiGlobe className="h-8 w-8 mb-2 text-red-600 dark:text-red-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Circle K</span>
              </button>
              
              <button 
                onClick={handleScrapeWorkOrders}
                disabled={workOrderScrapeStatus.status === 'running'}
                className="flex flex-col items-center justify-center p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors disabled:opacity-60"
              >
                <FiRefreshCw className={`h-8 w-8 mb-2 text-teal-600 dark:text-teal-400 ${workOrderScrapeStatus.status === 'running' ? 'animate-spin' : ''}`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {workOrderScrapeStatus.status === 'running' ? 'Scraping...' : 'Scrape Jobs'}
                </span>
              </button>
              
              <button 
                onClick={handleScrapeDispenserData}
                disabled={dispenserScrapeStatus.status === 'running'}
                className="flex flex-col items-center justify-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-60"
              >
                <GiGasPump className={`h-8 w-8 mb-2 text-indigo-600 dark:text-indigo-400 ${dispenserScrapeStatus.status === 'running' ? 'animate-spin' : ''}`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {dispenserScrapeStatus.status === 'running' ? 'Scraping...' : 'Scrape Dispensers'}
                </span>
              </button>
              
              <button 
                onClick={() => navigate('/system-logs')}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FiDatabase className="h-8 w-8 mb-2 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">System Logs</span>
              </button>
            </div>
          </div>
          
          {/* Scraping Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Scrape Status</h2>
            </div>
            <div className="p-5">
              <ScrapeLogsConsole type="workOrder" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; // End of HomeContent component

export default Home;


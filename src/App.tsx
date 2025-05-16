import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { FiHome, FiSettings, FiFilter, FiZap, FiFileText, FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiClock, FiLayout, FiDatabase, FiUser, FiChevronDown, FiCalendar, FiShoppingBag, FiMap, FiTerminal } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import bannerImage from './assets/images/FossaMonitorLogo.png';
import { 
  startScrapeJob, 
  startDispenserScrapeJob, 
  getScrapeStatus, 
  getDispenserScrapeStatus,
  checkAllScrapeStatus,
  ScrapeStatus
} from './services/scrapeService';
import { getActiveUser, getUsers, setActiveUser } from './services/userService';
import { ToastProvider, useToast } from './context/ToastContext';
import { DispenserProvider } from './context/DispenserContext';
import { useScrapeStatus, ScrapeProvider } from './context/ScrapeContext';
import Toast from './components/Toast';
import LastScrapedTime from './components/LastScrapedTime';
import NextScrapeTime from './components/NextScrapeTime';
import SystemLogs from './pages/SystemLogs';

interface User {
  id: string;
  email: string;
  label: string;
  lastUsed: string;
  isActive?: boolean;
}

// Lazy load pages
const Home = React.lazy(() => import('./pages/Home'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Filters = React.lazy(() => import('./pages/Filters'));
const AutoFossa = React.lazy(() => import('./pages/AutoFossa'));
const FormPrep = React.lazy(() => import('./pages/FormPrep'));
const History = React.lazy(() => import('./pages/History'));
const CircleK = React.lazy(() => import('./pages/CircleK'));
const JobMapView = React.lazy(() => import('./pages/JobMapView'));
const Schedule = React.lazy(() => import('./pages/Schedule'));
const ScheduleDebug = React.lazy(() => import('./pages/ScheduleDebug'));
const DevConsole = React.lazy(() => import('./pages/DevConsole'));
const TestProgress = React.lazy(() => import('./pages/TestProgress'));
const Test = React.lazy(() => import('./pages/Test'));
const TestDispenser = React.lazy(() => import('./pages/TestDispenser'));

// Create an AppContent component that uses the toast hook
const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { workOrderStatus, dispenserStatus, isAnyScrapingInProgress, updateScrapeStatus } = useScrapeStatus();
  
  const [workOrderError, setWorkOrderError] = useState<string | null>(null);
  const [dispenserError, setDispenserError] = useState<string | null>(null);
  const [forceRetry, setForceRetry] = useState(false);
  const [activeUser, setActiveUserState] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);

  // Helper functions to determine if scrapes are in progress
  const isWorkOrderScraping = workOrderStatus.status === 'running';
  const isDispenserScraping = dispenserStatus.status === 'running';
  // Define status states for UI messaging
  const isWorkOrderIdle = workOrderStatus.status === 'idle';
  const isDispenserIdle = dispenserStatus.status === 'idle';
  
  // Functions to update status in a type-safe way (fixing the 'not defined' errors)
  const setWorkOrderStatus = (status: ScrapeStatus | { status: string; message: string; progress: number; error: string | null }) => {
    // This safely updates work order status while maintaining the dispenserStatus
    updateScrapeStatus({
      workOrderStatus: status as ScrapeStatus
    });
  };
  
  const setDispenserStatus = (status: ScrapeStatus | { status: string; message: string; progress: number; error: string | null }) => {
    // This safely updates dispenser status while maintaining the workOrderStatus
    updateScrapeStatus({
      dispenserStatus: status as ScrapeStatus
    });
  };

  // Setup Electron IPC navigation
  useEffect(() => {
    // Add electron navigation event handler if running in electron
    if (window.electron?.onNavigate) {
      window.electron.onNavigate((route: string) => {
        console.log('Electron navigation event:', route);
        
        switch (route) {
          case 'dashboard':
            navigate('/home');
            break;
          case 'history':
            navigate('/history');
            break;
          case 'settings':
            navigate('/settings');
            break;
          case 'logs':
            // If you have a logs page, navigate to it
            // navigate('/logs');
            // For now, just go to home
            navigate('/home');
            break;
          default:
            navigate('/schedule');
        }
      });
    }
    
    // Listen for automatic scrape completion events from backend
    if (window.electron?.onScrapeComplete) {
      window.electron.onScrapeComplete((data: any) => {
        console.log('Automatic scrape completed:', data);
        
        // Dispatch both events to ensure all components are updated
        setTimeout(() => {
          // Dispatch the fossa-data-updated event for existing components
          const fossaEvent = new CustomEvent('fossa-data-updated', { 
            detail: { silent: true, automatic: true }
          });
          window.dispatchEvent(fossaEvent);
          
          // Dispatch the scrape-complete event for the LastScrapedTime component
          const scrapeEvent = new CustomEvent('scrape-complete', { 
            detail: data 
          });
          window.dispatchEvent(scrapeEvent);
          
          console.log('Dispatched data refresh events for automatic scrape completion');
        }, 300);
      });
    }
  }, [navigate]);

  // Clear localStorage on mount to prevent stale states
  useEffect(() => {
    localStorage.removeItem('workOrderStatus');
    localStorage.removeItem('dispenserStatus');
    localStorage.removeItem('isWorkOrderScraping');
    localStorage.removeItem('isDispenserScraping');
  }, []);

  // Save states to localStorage only when actively scraping
  useEffect(() => {
    if (isWorkOrderScraping || isDispenserScraping) {
      localStorage.setItem('workOrderStatus', JSON.stringify(workOrderStatus));
      localStorage.setItem('dispenserStatus', JSON.stringify(dispenserStatus));
      localStorage.setItem('isWorkOrderScraping', isWorkOrderScraping.toString());
      localStorage.setItem('isDispenserScraping', isDispenserScraping.toString());
    } else {
      // Clear storage when not scraping
      localStorage.removeItem('workOrderStatus');
      localStorage.removeItem('dispenserStatus');
      localStorage.removeItem('isWorkOrderScraping');
      localStorage.removeItem('isDispenserScraping');
    }
  }, [workOrderStatus, dispenserStatus, isWorkOrderScraping, isDispenserScraping]);

  // Check status on initial load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkAllScrapeStatus();
        if (status.workOrder && status.workOrder.status === 'running') {
          // We're now using ScrapeContext, so we need to call updateScrapeStatus
          // instead of directly updating the state
          updateScrapeStatus();
        }
      } catch (error) {
        console.error('Error checking scrape status:', error);
      }
    };
    checkStatus();

    // Initialize system logs
    import('./services/scrapeService').then(({ systemLogs, getScrapeLogs }) => {
      // First check if logs exist already
      getScrapeLogs('server').then((logs: any[]) => {
        if (logs.length === 0) {
          // No server logs found, add initial logs
          systemLogs.server.info('Application started');
          systemLogs.server.success('Server connected successfully');
          systemLogs.server.info('API endpoints registered');
        }
      });
      
      // Check form prep logs
      getScrapeLogs('formPrep').then((logs: any[]) => {
        if (logs.length === 0) {
          // No form prep logs found, add initial logs
          systemLogs.formPrep.info('Form preparation system initialized');
          systemLogs.formPrep.success('Template engine loaded');
          systemLogs.formPrep.info('Form fields configuration loaded');
        }
      });
    });
  }, [updateScrapeStatus]);

  // Poll for status updates when scraping
  useEffect(() => {
    let workOrderInterval: NodeJS.Timeout | null = null;
    let dispenserInterval: NodeJS.Timeout | null = null;

    const pollWorkOrderStatus = async () => {
      try {
        const status = await getScrapeStatus();
        console.log('Work order status update:', status);
        setWorkOrderStatus(status as ScrapeStatus);

        // Handle completion
        if (status.status === 'completed' || 
            status.progress === 100 || 
            (status.message && (
              status.message.includes('complete') || 
              status.message.includes('success') || 
              status.message.includes('finished')
            ))) {
          console.log('Work order scrape completed');
          addToast("success", "Work order scrape completed successfully");
          
          // If status indicates completion, handle appropriately
          if (status.status === 'error' || status.error) {
            setWorkOrderError(status.error || 'An unknown error occurred');
            addToast("error", `Work order scrape error: ${status.error || 'Unknown error'}`);
          } else {
            // Success, clear any previous errors
            setWorkOrderError(null);
            
            // Force reload data
            loadData();
          }
        }
      } catch (error) {
        console.error("Error polling work order status:", error);
        addToast("error", `Error checking work order status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    const pollDispenserStatus = async () => {
      try {
        const status = await getDispenserScrapeStatus();
        console.log('Dispenser status update:', status);
        setDispenserStatus(status as ScrapeStatus);
        
        // Handle completion
        if (status.status === 'completed' || 
            status.progress === 100 || 
            (status.message && (
              status.message.includes('complete') || 
              status.message.includes('success') || 
              status.message.includes('finished')
            ))) {
          console.log('Dispenser scrape completed');
          addToast("success", "Dispenser scrape completed successfully");
          
          if (status.status === 'error' || status.error) {
            setDispenserError(status.error || 'An unknown error occurred');
            addToast("error", `Dispenser scrape error: ${status.error || 'Unknown error'}`);
          } else {
            // Success, clear any previous errors
            setDispenserError(null);
            
            // Force reload data
            loadData(true); // Pass true to force refresh dispenser data
          }
        }
      } catch (error) {
        console.error('Error polling dispenser status:', error);
        addToast("error", `Error checking dispenser status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    if (isWorkOrderScraping) {
      workOrderInterval = setInterval(pollWorkOrderStatus, 1000);
    }

    if (isDispenserScraping) {
      dispenserInterval = setInterval(pollDispenserStatus, 1000);
    }

    return () => {
      if (workOrderInterval) clearInterval(workOrderInterval);
      if (dispenserInterval) clearInterval(dispenserInterval);
    };
  }, [isWorkOrderScraping, isDispenserScraping]);

  // Fetch active user
  const fetchActiveUser = async () => {
    try {
      const response = await fetch('/api/users/active');
      if (!response.ok) {
        throw new Error('Failed to fetch active user');
      }
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setActiveUserState(data.user);
        
        // Store the active user ID in localStorage for persisted state
        localStorage.setItem('activeUserId', data.user.id);
        
        return data.user;
      } else {
        console.error('No active user found:', data);
        return null;
      }
    } catch (error) {
      console.error('Error fetching active user:', error);
      return null;
    }
  };

  // Fetch all users
  const fetchAllUsers = async () => {
    try {
      const users = await getUsers();
      console.log('Fetched all users:', users);
      setAllUsers(users);
      return users;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  // Fetch active user and all users on mount
  useEffect(() => {
    const checkUserSwitch = async () => {
      console.log('\n=== START: User Switch Completion Check ===');
      console.log('Checking localStorage for switch flags...');
      
      // Check if we're completing a user switch
      const switchInProgress = localStorage.getItem('userSwitchInProgress');
      const targetUserId = localStorage.getItem('switchTargetUserId');
      const targetLabel = localStorage.getItem('switchTargetLabel');
      
      console.log('Switch flags found:', {
        switchInProgress,
        targetUserId,
        targetLabel
      });
      
      if (switchInProgress && targetUserId) {
        console.log('=== Completing User Switch ===');
        console.log('Target User:', { userId: targetUserId, label: targetLabel });
        
        // Clean up localStorage
        console.log('Cleaning up localStorage flags...');
        localStorage.removeItem('userSwitchInProgress');
        localStorage.removeItem('switchTargetUserId');
        localStorage.removeItem('switchTargetLabel');
        
        // Load the new user data
        console.log('Loading new active user data...');
        const newActiveUser = await fetchActiveUser();
        console.log('New active user loaded:', newActiveUser);
        
        // Verify the switch was successful
        if (newActiveUser?.id === targetUserId) {
          console.log('User switch completed successfully');
          addToast("success", `Switched to ${targetLabel}`);
        } else {
          console.error('User switch verification failed', {
            expected: targetUserId,
            actual: newActiveUser?.id,
            activeUser: newActiveUser
          });
          addToast("error", "User switch may not have completed properly");
        }
      } else {
        console.log('No user switch in progress, performing normal startup');
        // Normal startup - just load users
        const currentUser = await fetchActiveUser();
        console.log('Current active user loaded:', currentUser);
      }
      
      // Always load all users
      console.log('Loading all users...');
      const users = await fetchAllUsers();
      console.log('All users loaded:', users);
      
      console.log('=== END: User Switch Completion Check ===\n');
    };
    
    checkUserSwitch();
  }, []);

  // Handle user switching
  const handleUserSwitch = async (newUserId: string) => {
    console.log('Switching to user:', newUserId);
    try {
      // Close the dropdown
      setIsUserDropdownOpen(false);
      
      // Show a loading indicator
      setIsSwitchingUser(true);
      
      // Call the API to set the active user
      const response = await fetch('/api/users/active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: newUserId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to switch user');
      }
      
      // Store the active user ID in localStorage for persisted state
      localStorage.setItem('activeUserId', newUserId);
      
      // Show success message
      addToast('success', `Switched to ${data.user?.label || 'new user'}`, 3000);
      
      // Update application state with the new active user
      setActiveUserState(data.user);
      
      // Dispatch a custom event to notify components about the user change
      const userSwitchedEvent = new Event('user-switched');
      window.dispatchEvent(userSwitchedEvent);
      
      // Force reload the window to ensure all data is refreshed
      // Use a small timeout to ensure the event has time to be processed
      setTimeout(() => {
        if (window.electron && window.electron.reloadApp) {
          window.electron.reloadApp();
        } else {
          window.location.reload();
        }
      }, 100);
    } catch (error) {
      console.error('Error switching user:', error);
      setIsSwitchingUser(false);
      addToast('error', error instanceof Error ? error.message : 'Failed to switch user', 5000);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle starting work order scrape
  const handleStartScrapeJob = async () => {
    // Prevent starting a scrape while another is in progress
    if (isAnyScrapingInProgress) {
      addToast('warning', 'A scrape job is already in progress. Please wait for it to complete.', 5000);
      return;
    }

    try {
      addToast('info', 'Starting work order scrape job...', 3000);
      await startScrapeJob();
      
      // Trigger event to notify components
      window.dispatchEvent(new CustomEvent('scrape-started'));
      
      // Update status immediately
      await updateScrapeStatus();
      
    } catch (error) {
      console.error('Error starting scrape job:', error);
      addToast('error', `Error starting scrape job: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
    }
  };

  // Handle starting dispenser scrape
  const handleStartDispenserScrapeJob = async () => {
    // Prevent starting a scrape while another is in progress
    if (isAnyScrapingInProgress) {
      addToast('warning', 'A scrape job is already in progress. Please wait for it to complete.', 5000);
      return;
    }
    
    try {
      addToast('info', 'Starting dispenser scrape job...', 3000);
      await startDispenserScrapeJob();
      
      // Trigger event to notify components
      window.dispatchEvent(new CustomEvent('scrape-started'));
      
      // Update status immediately
      await updateScrapeStatus();
      
    } catch (error) {
      console.error('Error starting dispenser scrape job:', error);
      addToast('error', `Error starting dispenser scrape job: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
    }
  };

  // Data reload function
  const loadData = async (forceRefreshDispensers = false) => {
    try {
      // Update scrape status
      await updateScrapeStatus();
      
      // Dispatch event to notify components to refresh their data
      setTimeout(() => {
        const refreshEvent = new CustomEvent('fossa-data-updated', { 
          detail: { silent: true }
        });
        window.dispatchEvent(refreshEvent);
        console.log('Dispatched fossa-data-updated event to refresh components silently');
      }, 500);
      
      // Notify about the reload
      addToast("info", "Data has been refreshed");
    } catch (error) {
      console.error('Error reloading data:', error);
    }
  };

  // Update the sidebar section with work order scraping status
  const renderWorkOrderStatus = () => {
    return (
      <div className="relative flex flex-col rounded-lg bg-gray-800/60 border border-gray-700/50 shadow-md overflow-hidden hover:bg-gray-800/80 hover:border-blue-700/30 transition-all duration-200 group">
        {/* Header with title and status icon */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-700/30 border-b border-gray-700/50 group-hover:bg-gray-700/50 transition-colors">
          <div className="flex items-center gap-2">
            <div className={`flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-full ${isWorkOrderScraping ? 'bg-blue-500/20' : workOrderStatus.error ? 'bg-red-500/20' : 'bg-green-500/20'} transition-colors`}>
              {isWorkOrderScraping ? (
                <FiRefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
              ) : workOrderStatus.error ? (
                <FiAlertCircle className="w-3 h-3 text-red-400" />
              ) : (
                <FiCheckCircle className="w-3 h-3 text-green-400" />
              )}
            </div>
            <p className="text-xs font-medium text-gray-200 group-hover:text-white transition-colors">Work Orders</p>
          </div>
          <button 
            onClick={handleStartScrapeJob}
            disabled={isWorkOrderScraping}
            className={`flex-shrink-0 p-1.5 rounded-full ${isWorkOrderScraping 
              ? 'bg-gray-700/50 cursor-not-allowed' 
              : 'bg-blue-600/40 hover:bg-blue-600/70 transition-colors'}`}
            title="Update work orders"
          >
            <FiRefreshCw className="w-3 h-3 text-gray-200 group-hover:text-white transition-colors" />
          </button>
        </div>
        
        {/* Status message with progress bar for scraping */}
        <div className="p-3 relative">
          {isWorkOrderScraping && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-blue-400" style={{ width: `${workOrderStatus.progress || 0}%` }}></div>
          )}
          <p className={`text-xs w-full overflow-hidden text-ellipsis
            ${isWorkOrderScraping ? 'text-blue-400 animate-pulse' : workOrderStatus.error ? 'text-red-400' : 'text-gray-400'} group-hover:brightness-125 transition-all`}>
            {isWorkOrderScraping 
              ? `Scraping in progress... ${workOrderStatus.progress || 0}%` 
              : workOrderStatus.error 
              ? workOrderStatus.message || 'Error during scraping' 
              : isWorkOrderIdle 
              ? 'Ready to scrape work orders' 
              : workOrderStatus.message || 'Ready'}
          </p>
        </div>
      </div>
    );
  };

  // Update the sidebar section with dispenser scraping status
  const renderDispenserStatus = () => {
    return (
      <div className="relative flex flex-col rounded-lg bg-gray-800/60 border border-gray-700/50 shadow-md overflow-hidden hover:bg-gray-800/80 hover:border-amber-700/30 transition-all duration-200 group">
        {/* Header with title and status icon */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-700/30 border-b border-gray-700/50 group-hover:bg-gray-700/50 transition-colors">
          <div className="flex items-center gap-2">
            <div className={`flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-full ${isDispenserScraping ? 'bg-amber-500/20' : dispenserStatus.error ? 'bg-red-500/20' : 'bg-green-500/20'} transition-colors`}>
              {isDispenserScraping ? (
                <FiRefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
              ) : dispenserStatus.error ? (
                <FiAlertCircle className="w-3 h-3 text-red-400" />
              ) : (
                <GiGasPump className="w-3 h-3 text-green-400" />
              )}
            </div>
            <p className="text-xs font-medium text-gray-200 group-hover:text-white transition-colors">Dispensers</p>
          </div>
          <button 
            onClick={handleStartDispenserScrapeJob}
            disabled={isDispenserScraping}
            className={`flex-shrink-0 p-1.5 rounded-full ${isDispenserScraping 
              ? 'bg-gray-700/50 cursor-not-allowed' 
              : 'bg-amber-600/40 hover:bg-amber-600/70 transition-colors'}`}
            title="Update dispensers"
          >
            <FiRefreshCw className="w-3 h-3 text-gray-200 group-hover:text-white transition-colors" />
          </button>
        </div>
        
        {/* Status message with progress bar for scraping */}
        <div className="p-3 relative">
          {isDispenserScraping && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-amber-400" style={{ width: `${dispenserStatus.progress || 0}%` }}></div>
          )}
          <p className={`text-xs w-full overflow-hidden text-ellipsis
            ${isDispenserScraping ? 'text-amber-400 animate-pulse' : dispenserStatus.error ? 'text-red-400' : 'text-gray-400'} group-hover:brightness-125 transition-all`}>
            {isDispenserScraping 
              ? `Scraping in progress... ${dispenserStatus.progress || 0}%` 
              : dispenserStatus.error 
              ? dispenserStatus.message || 'Error during scraping' 
              : isDispenserIdle 
              ? 'Ready to scrape dispensers' 
              : dispenserStatus.message || 'Ready'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <DispenserProvider>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        {/* Sidebar - Updated Styling */}
        <div className="hidden md:flex md:w-64 bg-gray-900 flex-col shadow-lg text-gray-300">
          {/* Logo */}
          <div className="flex items-center justify-center p-5 mb-6">
            <img 
              src={bannerImage} 
              alt="Fossa Monitor" 
              className="w-full h-auto object-cover rounded-lg shadow-md"
            />
          </div>
          
          {/* Active User Display with Dropdown */}
          <div className="px-2 py-2 border-b border-gray-700 relative mb-4" ref={userDropdownRef}>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-gray-700 rounded-lg p-2"
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            >
              <div className="flex items-center">
                <div className="bg-primary-500/20 p-1.5 rounded-md mr-2">
                  <FiUser className="w-4 h-4 text-primary-400" />
                </div>
                <span className="text-sm font-medium text-gray-200 truncate max-w-[130px]">
                  {activeUser?.label || activeUser?.email || 'No User'}
                </span>
                {activeUser && activeUser.id === 'tutorial' && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                    Tutorial
                  </span>
                )}
                {activeUser && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    Active
                  </span>
                )}
              </div>
              <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isUserDropdownOpen ? 'transform rotate-180' : ''}`} />
            </div>
            
            {/* User Dropdown */}
            {isUserDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 mx-2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-20">
                {allUsers.map((user) => {
                  const isUserActive = activeUser && user.id === activeUser.id;
                  return (
                    <div 
                      key={user.id}
                      className={`px-3 py-2 flex items-center ${isUserActive ? 'bg-blue-900/30 text-white' : 'text-gray-300 hover:bg-gray-700'} cursor-pointer transition-colors duration-150`}
                      onClick={() => !isUserActive && handleUserSwitch(user.id)}
                    >
                      <FiUser className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm truncate flex-grow">
                        {user.label || user.email}
                      </span>
                      {user.id === 'tutorial' && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-md mr-1">
                          Tutorial
                        </span>
                      )}
                      {isUserActive && (
                        <FiCheckCircle className="w-4 h-4 text-green-400 ml-2" />
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-gray-700 mt-1 pt-1">
                  <div 
                    className="px-3 py-2 flex items-center hover:bg-gray-700 cursor-pointer text-blue-400"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      navigate('/settings');
                    }}
                  >
                    <FiSettings className="w-4 h-4 mr-2" />
                    <span className="text-sm">Manage Users</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Wrap navigation in a growing container - modified to prevent scrollbar */}
          <div className="flex-grow overflow-y-auto">
            {/* Navigation Menu Section */}
            <div className="px-1 py-1 mt-1">
              <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-2">
                Main Menu
              </div>
            </div>
            <nav className="px-3 flex-grow space-y-0.5">
              {/* Links go here... */}
              <Link
                to="/home"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/home' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/home' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-r-md"></span>}
                <FiLayout className="w-5 h-5 mr-3 text-blue-400" />
                Dashboard
              </Link>
              <Link 
                to="/schedule" 
                className={`flex items-center space-x-3 px-3 py-1.5 rounded-lg transition-colors duration-150 ease-in-out hover:bg-gray-700 hover:text-white ${
                  location.pathname === '/schedule' ? 'bg-primary-500 text-white shadow-lg' : 'text-gray-300'
                }`}>
                <FiCalendar className="h-5 w-5" />
                <span>Schedule</span>
              </Link>
              <Link
                to="/job-map"
                className={`flex items-center space-x-3 px-3 py-1.5 rounded-lg transition-colors duration-150 ease-in-out hover:bg-gray-700 hover:text-white ${
                  location.pathname === '/job-map' ? 'bg-primary-500 text-white shadow-lg' : 'text-gray-300'
                }`}>
                <FiMap className="h-5 w-5" />
                <span>Job Map</span>
              </Link>
              <Link
                to="/filters"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/filters' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/filters' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-r-md"></span>}
                <FiFilter className="w-5 h-5 mr-3 text-amber-400" />
                Filters
              </Link>

              <div className="pt-2 pb-1 px-1">
                <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-1.5">
                  Automation
                </div>
              </div>

              <Link
                to="/form-prep"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/form-prep' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/form-prep' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400 rounded-r-md"></span>}
                <FiFileText className="w-5 h-5 mr-3 text-purple-400" />
                Form Prep
              </Link>
              <Link
                to="/auto-fossa"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/auto-fossa' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/auto-fossa' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-green-400 rounded-r-md"></span>}
                <FiZap className="w-5 h-5 mr-3 text-green-400" />
                Auto Fossa
              </Link>

              <div className="pt-2 pb-1 px-1">
                <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-1.5">
                  Tools
                </div>
              </div>

              <Link
                to="/history"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/history' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/history' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 rounded-r-md"></span>}
                <FiClock className="w-5 h-5 mr-3 text-indigo-400" />
                Schedule Changes
              </Link>
              <Link
                to="/circle-k"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/circle-k' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/circle-k' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-r-md"></span>}
                <FiShoppingBag className="w-5 h-5 mr-3 text-red-400" />
                Circle K
              </Link>

              <div className="pt-2 pb-1 px-1">
                <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-1.5">
                  Management
                </div>
              </div>

              <Link
                to="/settings"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/settings' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/settings' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400 rounded-r-md"></span>}
                <FiSettings className="w-5 h-5 mr-3 text-gray-400" />
                Settings
              </Link>
              <Link
                to="/system-logs"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/system-logs' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/system-logs' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-r-md"></span>}
                <FiFileText className="w-5 h-5 mr-3 text-blue-400" />
                System Logs
              </Link>
              <Link
                to="/dev-console"
                className={`relative flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/dev-console' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/dev-console' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400 rounded-r-md"></span>}
                <FiTerminal className="w-5 h-5 mr-3 text-purple-400" />
                Dev Console
              </Link>
            </nav>
          </div> {/* End of flex-grow wrapper for nav */}

          {/* Data Status Section - Redesigned */}
          <div className="px-3 py-4 border-t border-gray-700 flex-shrink-0">
            <button 
              className="w-full flex items-center justify-between mb-2 text-xs uppercase font-semibold text-gray-400 tracking-wider"
              onClick={() => {}}
            >
              <div className="flex items-center gap-1.5">
                <FiDatabase className="w-3.5 h-3.5" />
                <span>DATA STATUS</span>
              </div>
              <FiChevronDown className="w-3.5 h-3.5 opacity-75" />
            </button>
            
            {/* Time Info Section - Redesigned */}
            <div className="mb-4 bg-gray-800/60 rounded-lg p-3 shadow-md border border-gray-700/50">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiClock className="text-blue-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-300">Last updated</span>
                  </div>
                  <span className="text-xs text-blue-400 font-medium"><LastScrapedTime /></span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiCalendar className="text-indigo-400 w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-300">Next update</span>
                  </div>
                  <span className="text-xs text-indigo-400 font-medium"><NextScrapeTime /></span>
                </div>
              </div>
            </div>
            
            {/* Status Controls - Redesigned with better UI */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs text-gray-500 font-medium">Data Sources</h4>
                <div className="flex items-center space-x-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400"></div>
                </div>
              </div>
              {renderWorkOrderStatus()}
              {renderDispenserStatus()}
            </div>
          </div>
        </div> {/* End of sidebar div */}

        {/* Main Content Area */} 
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow p-2 sm:p-4 flex flex-wrap justify-between items-center">
            {/* Header content can go here - maybe a title or hamburger menu toggle? */}
            <div> {/* Placeholder for left side */} </div>
            <div> {/* Placeholder for right side */} </div>
          </header>

          {/* Main Content - Removed responsive padding (p-2 sm:p-4) */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 dark:bg-gray-700">
            <Suspense fallback={<div className="flex justify-center items-center h-full">Loading...</div>}>
              <Routes>
                {/* Redirect from home to test */}
                <Route path="/" element={<Navigate to="/test" replace />} />
                <Route path="/test" element={<Test />} />
                <Route path="/home" element={<Home />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/filters" element={<Filters />} />
                <Route path="/form-prep" element={<FormPrep />} />
                <Route path="/auto-fossa" element={<AutoFossa />} />
                <Route path="/history" element={<History />} />
                <Route path="/system-logs" element={<SystemLogs />} />
                <Route path="/dev-console" element={<DevConsole />} />
                <Route path="/circle-k" element={<CircleK />} />
                <Route path="/job-map" element={<JobMapView />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/schedule-debug" element={<ScheduleDebug />} />
                <Route path="/test-dispenser" element={<TestDispenser />} />
                <Route path="/test-progress" element={<TestProgress />} />
              </Routes>
            </Suspense>
          </main>
        </div> {/* End of main content wrapper */}
      </div> {/* End of main flex container */}
    </DispenserProvider>
  );
};

// Main App component that provides the toast context
function App() {
  console.log('App component is rendering');
  
  return (
    <ToastProvider>
      <DispenserProvider>
        <ScrapeProvider>
          <div className="App h-screen flex flex-col dark:bg-gray-900 dark:text-white">
            <Suspense 
              fallback={
                <div className="flex justify-center items-center h-screen">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              }
            >
              <Routes>
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </Suspense>
          </div>
        </ScrapeProvider>
      </DispenserProvider>
    </ToastProvider>
  );
}

export default App; 
import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { FiHome, FiSettings, FiFilter, FiZap, FiFileText, FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiClock, FiLayout, FiDatabase, FiUser, FiChevronDown } from 'react-icons/fi'
import bannerImage from './assets/images/FossaMonitorLogo.png'
import { 
  startScrapeJob, 
  startDispenserScrapeJob, 
  getScrapeStatus, 
  getDispenserScrapeStatus,
  checkAllScrapeStatus,
  ScrapeStatus
} from './services/scrapeService'
import { getActiveUser, getUsers, setActiveUser } from './services/userService'
import { ToastProvider, useToast } from './context/ToastContext'
import { DispenserProvider } from './context/DispenserContext'
import Toast from './components/Toast'
import LastScrapedTime from './components/LastScrapedTime'
import NextScrapeTime from './components/NextScrapeTime'

interface User {
  id: string;
  email: string;
  label: string;
  lastUsed: string;
  isActive?: boolean;
}

// Lazy load pages
const Home = React.lazy(() => import('./pages/Home'))
const HomeRedesign = React.lazy(() => import('./pages/Home'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Filters = React.lazy(() => import('./pages/Filters'))
const FiltersRedesign = React.lazy(() => import('./pages/Filters'))
const AutoFossa = React.lazy(() => import('./pages/AutoFossa'))
const FormPrep = React.lazy(() => import('./pages/FormPrep'))
const History = React.lazy(() => import('./pages/History'))
const CircleK = React.lazy(() => import('./pages/CircleK'))
const SystemLogs = React.lazy(() => import('./pages/SystemLogs'))

// Create an AppContent component that uses the toast hook
const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [workOrderStatus, setWorkOrderStatus] = useState<ScrapeStatus>({
    status: 'idle',
    progress: 0,
    message: '',
    error: null
  });
  const [dispenserStatus, setDispenserStatus] = useState<ScrapeStatus>({
    status: 'idle',
    progress: 0,
    message: '',
    error: null
  });
  const [isWorkOrderScraping, setIsWorkOrderScraping] = useState(false);
  const [isDispenserScraping, setIsDispenserScraping] = useState(false);
  const [workOrderError, setWorkOrderError] = useState<string | null>(null);
  const [dispenserError, setDispenserError] = useState<string | null>(null);
  const [forceRetry, setForceRetry] = useState(false);
  const [activeUser, setActiveUserState] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);

  // Setup Electron IPC navigation
  useEffect(() => {
    // Add electron navigation event handler if running in electron
    if (window.electron?.onNavigate) {
      window.electron.onNavigate((route) => {
        console.log('Electron navigation event:', route);
        
        switch (route) {
          case 'dashboard':
            navigate('/');
            break;
          case 'history':
            navigate('/history');
            break;
          case 'settings':
            navigate('/settings');
            break;
          case 'logs':
            // Navigate to the logs page
            navigate('/system-logs');
            break;
          default:
            navigate('/');
        }
      });
    }
    
    // Listen for automatic scrape completion events from backend
    if (window.electron?.onScrapeComplete) {
      window.electron.onScrapeComplete((data) => {
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
        if (status.workOrder) {
          // Only update if actually running
          if (status.workOrder.status === 'running') {
            setWorkOrderStatus(status.workOrder);
            setIsWorkOrderScraping(true);
          }
        }
        if (status.dispenser) {
          // Only update if actually running
          if (status.dispenser.status === 'running') {
            setDispenserStatus(status.dispenser);
            setIsDispenserScraping(true);
          }
        }
      } catch (error) {
        console.error('Error checking scrape status:', error);
      }
    };
    checkStatus();
  }, []);

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
          
          // Reset the status state immediately before any other operations
          setWorkOrderStatus({
            status: 'completed',
            progress: 100,
            message: 'Work order scrape completed successfully',
            error: null
          });
          
          setIsWorkOrderScraping(false);
          setWorkOrderError(null);
          
          if (workOrderInterval) {
            clearInterval(workOrderInterval);
          }
          
          // Only reload if dispenser is not scraping
          if (!isDispenserScraping) {
            // First trigger the event to notify of data update
            setTimeout(() => {
              const refreshEvent = new CustomEvent('fossa-data-updated', { 
                detail: { silent: true }
              });
              window.dispatchEvent(refreshEvent);
              console.log('Dispatched fossa-data-updated event to refresh components silently');
            }, 300);
            
            // Then after a longer delay, call the loadData function to show status
            setTimeout(() => {
              // Only reload data if we're still in a non-scraping state
              if (!isWorkOrderScraping) {
                loadData();
              }
            }, 1500);
            
            // Reset button state after showing completion for a few seconds
            setTimeout(() => {
              setWorkOrderStatus({
                status: 'idle',
                progress: 0,
                message: '',
                error: null
              });
            }, 5000);
          }
        } else if (status.status === 'error') {
          console.log('Work order scrape error:', status.error);
          addToast("error", `Work order scrape error: ${status.error}`);
          setIsWorkOrderScraping(false);
          setWorkOrderError(status.error);
          if (workOrderInterval) {
            clearInterval(workOrderInterval);
          }
        }
      } catch (error) {
        console.error('Error polling work order status:', error);
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
          
          // Reset the status state immediately before any other operations
          setDispenserStatus({
            status: 'completed',
            progress: 100,
            message: 'Dispenser scrape completed successfully',
            error: null
          });
          
          setIsDispenserScraping(false);
          setDispenserError(null);
          
          if (dispenserInterval) {
            clearInterval(dispenserInterval);
          }
          
          // Only reload if work orders are not scraping
          if (!isWorkOrderScraping) {
            // First trigger the event to notify of data update
            setTimeout(() => {
              const refreshEvent = new CustomEvent('fossa-data-updated', { 
                detail: { silent: true }
              });
              window.dispatchEvent(refreshEvent);
            }, 300);
            
            // Then after a longer delay, do the actual data reload
            setTimeout(() => {
              // Only reload data if we're still in a non-scraping state
              if (!isDispenserScraping) {
                loadData();
              }
            }, 1500);
            
            // Reset button state after showing completion for a few seconds
            setTimeout(() => {
              setDispenserStatus({
                status: 'idle',
                progress: 0,
                message: '',
                error: null
              });
            }, 5000);
          }
        } else if (status.status === 'error') {
          console.log('Dispenser scrape error:', status.error);
          addToast("error", `Dispenser scrape error: ${status.error}`);
          setIsDispenserScraping(false);
          setDispenserError(status.error);
          if (dispenserInterval) {
            clearInterval(dispenserInterval);
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

  const handleScrapeWorkOrders = async () => {
    try {
      setIsWorkOrderScraping(true);
      setWorkOrderError(null);
      addToast("info", "Starting work order scrape...");
      await startScrapeJob();
    } catch (error) {
      console.error('Error starting work order scrape:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setWorkOrderError(errorMessage);
      addToast("error", `Error starting work order scrape: ${errorMessage}`);
      setIsWorkOrderScraping(false);
    }
  };

  const handleScrapeDispenserData = async () => {
    try {
      setIsDispenserScraping(true);
      setDispenserError(null);
      addToast("info", "Starting dispenser data scrape...");
      await startDispenserScrapeJob();
    } catch (error) {
      console.error('Error starting dispenser scrape:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setDispenserError(errorMessage);
      addToast("error", `Error starting dispenser scrape: ${errorMessage}`);
      setIsDispenserScraping(false);
    }
  };

  const getWorkOrderButtonStyle = () => {
    if (workOrderError) return 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800';
    if (isWorkOrderScraping) return 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed';
    if (workOrderStatus.status === 'completed') return 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800';
    return 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800';
  };

  const getDispenserButtonStyle = () => {
    if (dispenserError) return 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800';
    if (isDispenserScraping) return 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed';
    if (dispenserStatus.status === 'completed') return 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800';
    return 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800';
  };

  const getWorkOrderButtonIcon = () => {
    if (workOrderError) return <FiAlertCircle className="w-5 h-5 mr-2" />;
    if (isWorkOrderScraping) return <FiRefreshCw className="w-5 h-5 mr-2 animate-spin" />;
    return <FiDownload className="w-5 h-5 mr-2" />;
  };

  const getDispenserButtonIcon = () => {
    if (dispenserError) return <FiAlertCircle className="w-5 h-5 mr-2" />;
    if (isDispenserScraping) return <FiRefreshCw className="w-5 h-5 mr-2 animate-spin" />;
    return <FiDownload className="w-5 h-5 mr-2" />;
  };

  const getWorkOrderButtonText = () => {
    if (workOrderError) return 'Retry Work Orders';
    if (isWorkOrderScraping) return 'Scraping Work Orders';
    if (workOrderStatus.status === 'completed') return 'Work Orders Scraped';
    return 'Scrape Work Orders';
  };

  const getDispenserButtonText = () => {
    if (dispenserError) return 'Retry Dispenser Data';
    if (isDispenserScraping) return 'Scraping Dispenser Data';
    if (dispenserStatus.status === 'completed') return 'Dispenser Data Scraped';
    return 'Scrape Dispenser Data';
  };

  // Add a progress bar component for the buttons
  const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div 
        className="h-full bg-primary-500 transition-all duration-300 ease-out relative"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
      </div>
    </div>
  );

  // Data reload function
  const loadData = async () => {
    try {
      // Check status on reload
      const status = await checkAllScrapeStatus();
      console.log('Reloading data and checking status:', status);
      
      // Only update status if currently scraping
      if (status.workOrder && isWorkOrderScraping) {
        setWorkOrderStatus(status.workOrder);
      }
      if (status.dispenser && isDispenserScraping) {
        setDispenserStatus(status.dispenser);
      }
      
      // Dispatch event to notify components to refresh their data
      // This is more reliable than just showing a toast
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

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg fixed inset-y-0 left-0 z-10 flex flex-col transition-colors duration-200">
        <div className="p-4 pb-0">
          <div>
            <img 
              src={bannerImage} 
              alt="Fossa Monitor" 
              className="w-full h-auto object-cover rounded-md shadow-md"
            />
          </div>
          
          {/* Active User Display with Dropdown */}
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 relative" ref={userDropdownRef}>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 -mx-2"
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            >
              <div className="flex items-center">
                <FiUser className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[130px]">
                  {activeUser?.label || activeUser?.email || 'No User'}
                </span>
                {activeUser && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
                    Active
                  </span>
                )}
              </div>
              <FiChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isUserDropdownOpen ? 'transform rotate-180' : ''}`} />
            </div>
            
            {/* User Dropdown */}
            {isUserDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 mx-4 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20">
                {allUsers.map((user) => {
                  // Explicitly compute isActive for each user
                  const isUserActive = activeUser && user.id === activeUser.id;
                  
                  return (
                    <div 
                      key={user.id}
                      className={`px-3 py-2 flex items-center ${isUserActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-600'} cursor-pointer transition-colors duration-150`}
                      onClick={() => !isUserActive && handleUserSwitch(user.id)}
                    >
                      <FiUser className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-grow">
                        {user.label || user.email}
                      </span>
                      {isUserActive && (
                        <FiCheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 ml-2" />
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 dark:border-gray-600 mt-1 pt-1">
                  <div 
                    className="px-3 py-2 flex items-center hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer text-blue-600 dark:text-blue-400"
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
        </div>
        <nav className="mt-2 space-y-1 px-3 flex-grow overflow-y-auto">
          <Link
            to="/redesign"
            className={`sidebar-link ${location.pathname === '/redesign' ? 'active' : ''}`}
          >
            <FiLayout className="w-5 h-5 mr-3" />
            <span className="text-base">Dashboard</span>
          </Link>
          <Link
            to="/filters"
            className={`sidebar-link ${location.pathname === '/filters' ? 'active' : ''}`}
          >
            <FiFilter className="w-5 h-5 mr-3" />
            <span className="text-base">Filters</span>
          </Link>
          <Link
            to="/form-prep"
            className={`sidebar-link ${location.pathname === '/form-prep' ? 'active' : ''}`}
          >
            <FiFileText className="w-5 h-5 mr-3" />
            <span className="text-base">Form Prep</span>
          </Link>
          <Link
            to="/auto-fossa"
            className={`sidebar-link ${location.pathname === '/auto-fossa' ? 'active' : ''}`}
          >
            <FiZap className="w-5 h-5 mr-3" />
            <span className="text-base">Auto Fossa</span>
          </Link>
          <Link
            to="/circle-k"
            className={`sidebar-link ${location.pathname === '/circle-k' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v8"></path>
              <path d="M8 12h8"></path>
            </svg>
            <span className="text-base">Circle K</span>
          </Link>
          <Link
            to="/history"
            className={`sidebar-link ${location.pathname === '/history' ? 'active' : ''}`}
          >
            <FiClock className="w-5 h-5 mr-3" />
            <span className="text-base">History</span>
          </Link>
          <Link
            to="/system-logs"
            className={`sidebar-link ${location.pathname === '/system-logs' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span className="text-base">System Logs</span>
          </Link>
          <Link
            to="/settings"
            className={`sidebar-link ${location.pathname === '/settings' ? 'active' : ''}`}
          >
            <FiSettings className="w-5 h-5 mr-3" />
            <span className="text-base">Settings</span>
          </Link>
        </nav>
        
        {/* Scrape buttons at bottom */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700">
          <div className="mb-4">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mr-2.5">
                  <FiDatabase className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Data Tools</h3>
              </div>
              <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                <LastScrapedTime />
                <NextScrapeTime />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 transition-all duration-200 hover:shadow-md">
              <button 
                className={`w-full flex items-center justify-center ${getWorkOrderButtonStyle()} text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 transform hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800`}
                onClick={handleScrapeWorkOrders}
                disabled={isWorkOrderScraping && !workOrderError}
              >
                <div className="flex items-center">
                  {getWorkOrderButtonIcon()}
                  <span className="text-base">{getWorkOrderButtonText()}</span>
                </div>
              </button>
              {(isWorkOrderScraping || workOrderStatus.status === 'completed') && !workOrderError && (
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    <span>Progress</span>
                    <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">{workOrderStatus.progress}%</span>
                  </div>
                  <div className="relative">
                    <ProgressBar progress={workOrderStatus.progress} />
                    {isWorkOrderScraping && workOrderStatus.progress > 0 && workOrderStatus.progress < 100 && (
                      <div className="absolute top-0 left-0 w-full">
                        <div 
                          className="h-2.5 bg-white/20 rounded-full animate-pulse" 
                          style={{ 
                            width: `${Math.min(100, workOrderStatus.progress + 5)}%`,
                            animationDuration: '1.5s'
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                  {isWorkOrderScraping && (
                    <div className="flex items-start mt-2.5">
                      <div className="animate-spin mt-0.5 mr-2 h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-tight">
                        {workOrderStatus.message || 'Processing...'}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {workOrderError && (
                <div className="mt-3.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start">
                    <div className="mr-2 mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-800/50">
                      <FiAlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <strong className="font-medium">Error:</strong> {workOrderError}
                    </div>
                  </div>
                  {workOrderError.includes('already running') && (
                    <button 
                      className="mt-3 px-3.5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg text-sm font-medium flex items-center transition-all duration-200 w-full sm:w-auto justify-center shadow-sm hover:shadow"
                      onClick={() => {
                        setForceRetry(true);
                        handleScrapeWorkOrders();
                      }}
                    >
                      <FiRefreshCw className="w-3.5 h-3.5 mr-2" />
                      Force Retry
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 transition-all duration-200 hover:shadow-md">
              <button 
                className={`w-full flex items-center justify-center ${getDispenserButtonStyle()} text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 transform hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800`}
                onClick={handleScrapeDispenserData}
                disabled={isDispenserScraping && !dispenserError}
              >
                <div className="flex items-center">
                  {getDispenserButtonIcon()}
                  <span className="text-base">{getDispenserButtonText()}</span>
                </div>
              </button>
              {(isDispenserScraping || dispenserStatus.status === 'completed') && !dispenserError && (
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    <span>Progress</span>
                    <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{dispenserStatus.progress}%</span>
                  </div>
                  <div className="relative">
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300 ease-out relative"
                        style={{ width: `${dispenserStatus.progress}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                    {isDispenserScraping && dispenserStatus.progress > 0 && dispenserStatus.progress < 100 && (
                      <div className="absolute top-0 left-0 w-full">
                        <div 
                          className="h-2.5 bg-white/20 rounded-full animate-pulse" 
                          style={{ 
                            width: `${Math.min(100, dispenserStatus.progress + 5)}%`,
                            animationDuration: '1.5s'
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                  {isDispenserScraping && (
                    <div className="flex items-start mt-2.5">
                      <div className="animate-spin mt-0.5 mr-2 h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-tight">
                        {dispenserStatus.message || 'Processing...'}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {dispenserError && (
                <div className="mt-3.5 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-red-600 dark:text-red-400 font-medium mb-2 flex items-start">
                    <div className="mr-2 mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-800/50">
                      <FiAlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>{dispenserError}</div>
                  </div>
                  <div className="text-gray-700 dark:text-gray-300 text-xs mt-2 ml-7">
                    <p>This may be a temporary issue. Please try again, or try the following:</p>
                    <ul className="list-disc pl-5 mt-1.5 space-y-1.5">
                      <li>Check if the store has dispensers configured in Fossa</li>
                      <li>Verify your network connection is stable</li>
                      <li>If the problem persists, try "Force Rescrape" on specific stores</li>
                    </ul>
                  </div>
                  <div className="mt-3 flex space-x-3">
                    <button 
                      className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-medium flex items-center transition-all duration-200 flex-grow justify-center shadow-sm hover:shadow"
                      onClick={handleScrapeDispenserData}
                    >
                      <FiRefreshCw className="w-3.5 h-3.5 mr-2" />
                      Try Again
                    </button>
                    {dispenserError.includes('already running') && (
                      <button 
                        className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg text-sm font-medium flex items-center transition-all duration-200 flex-grow justify-center shadow-sm hover:shadow"
                        onClick={() => {
                          setForceRetry(true);
                          handleScrapeDispenserData();
                        }}
                      >
                        <FiRefreshCw className="w-3.5 h-3.5 mr-2" />
                        Force Retry
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8 transition-colors duration-200 overflow-auto h-screen">
        <div className="max-w-7xl mx-auto text-gray-800 dark:text-gray-100">
          <Suspense fallback={<div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>}>
            <Routes>
              <Route path="/" element={<HomeRedesign />} />
              <Route path="/redesign" element={<HomeRedesign />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/filters" element={<Filters />} />
              <Route path="/auto-fossa" element={<AutoFossa />} />
              <Route path="/form-prep" element={<FormPrep />} />
              <Route path="/circle-k" element={<CircleK />} />
              <Route path="/system-logs" element={<SystemLogs />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

// Main App component that provides the toast context
function App() {
  return (
    <ToastProvider>
      <DispenserProvider>
        <AppContent />
      </DispenserProvider>
    </ToastProvider>
  );
}

export default App; 
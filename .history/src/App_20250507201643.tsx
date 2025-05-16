import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { FiHome, FiSettings, FiFilter, FiZap, FiFileText, FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiClock, FiLayout, FiDatabase, FiUser, FiChevronDown, FiCalendar, FiShoppingBag } from 'react-icons/fi'
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
import SystemLogs from './pages/SystemLogs'

interface User {
  id: string;
  email: string;
  label: string;
  lastUsed: string;
  isActive?: boolean;
}

// Lazy load pages
const Home = React.lazy(() => import('./pages/Home'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Filters = React.lazy(() => import('./pages/Filters'))
const AutoFossa = React.lazy(() => import('./pages/AutoFossa'))
const FormPrep = React.lazy(() => import('./pages/FormPrep'))
const History = React.lazy(() => import('./pages/History'))
const CircleK = React.lazy(() => import('./pages/CircleK'))
const WorkOrdersPage = React.lazy(() => import('./pages/WorkOrdersPage'))

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
            // If you have a logs page, navigate to it
            // navigate('/logs');
            // For now, just go to home
            navigate('/');
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

          {/* Wrap navigation in a growing container */}
          <div className="flex-grow overflow-y-auto">
            {/* Navigation Menu Section */}
            <div className="px-1 py-2 mt-2">
              <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-3">
                Main Menu
              </div>
            </div>
            <nav className="px-3 flex-grow overflow-y-auto space-y-1">
              {/* Links go here... */}
              <Link
                to="/"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-r-md"></span>}
                <FiLayout className="w-5 h-5 mr-3 text-blue-400" />
                Dashboard
              </Link>
              {/* ... other links ... */}
              <Link
                to="/filters"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/filters' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/filters' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-r-md"></span>}
                <FiFilter className="w-5 h-5 mr-3 text-amber-400" />
                Filters
              </Link>
              <Link
                to="/form-prep"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/form-prep' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/form-prep' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400 rounded-r-md"></span>}
                <FiFileText className="w-5 h-5 mr-3 text-purple-400" />
                Form Prep
              </Link>
              <Link
                to="/auto-fossa"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/auto-fossa' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/auto-fossa' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-green-400 rounded-r-md"></span>}
                <FiZap className="w-5 h-5 mr-3 text-green-400" />
                Auto Fossa
              </Link>

              <div className="pt-4 pb-2 px-1">
                <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-3">
                  Management
                </div>
              </div>

              <Link
                to="/history"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/history' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/history' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 rounded-r-md"></span>}
                <FiClock className="w-5 h-5 mr-3 text-indigo-400" />
                Schedule Changes
              </Link>
              <Link
                to="/system-logs"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/system-logs' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/system-logs' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-r-md"></span>}
                <FiFileText className="w-5 h-5 mr-3 text-blue-400" />
                System Logs
              </Link>
              <Link
                to="/circle-k"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/circle-k' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/circle-k' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-r-md"></span>}
                <FiShoppingBag className="w-5 h-5 mr-3 text-red-400" />
                Circle K
              </Link>
              <Link
                to="/work-orders"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/work-orders' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/work-orders' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 rounded-r-md"></span>}
                <FiFileText className="w-5 h-5 mr-3 text-orange-400" />
                Work Orders
              </Link>
              <Link
                to="/settings"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/settings' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/settings' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400 rounded-r-md"></span>}
                <FiSettings className="w-5 h-5 mr-3 text-gray-400" />
                Settings
              </Link>
            </nav>
          </div> {/* End of flex-grow wrapper for nav */}

          {/* Data Tools Section - Corrected Layout, Ensured Bottom Position */}
          <div className="px-3 py-4 border-t border-gray-700 space-y-4 flex-shrink-0">
            <h3 className="text-xs uppercase font-semibold text-gray-500 px-1 mb-3">Data Status</h3>
            {/* Time Info - Corrected */}
            <div className="space-y-3 px-1">
              <div className="flex items-start text-sm text-gray-300">
                <LastScrapedTime />
              </div>
              <div className="flex items-start text-sm text-gray-300">
                <NextScrapeTime />
              </div>
            </div>
            
            {/* Scrape Buttons - Simplified Styles */}
            <div className="space-y-3 pt-3">
              <button 
                className={`w-full flex items-center justify-center ${getWorkOrderButtonStyle()} text-white font-medium py-2 px-3 rounded-md shadow-sm transition-all duration-200 transform hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900`}
                onClick={handleScrapeWorkOrders}
                disabled={isWorkOrderScraping && !workOrderError}
              >
                <div className="flex items-center">
                  {getWorkOrderButtonIcon()}
                  <span className="text-sm ml-2">{getWorkOrderButtonText()}</span>
                </div>
              </button>
              
              <button 
                className={`w-full flex items-center justify-center ${getDispenserButtonStyle()} text-white font-medium py-2 px-3 rounded-md shadow-sm transition-all duration-200 transform hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900`}
                onClick={handleScrapeDispenserData}
                disabled={isDispenserScraping && !dispenserError}
              >
                <div className="flex items-center">
                  {getDispenserButtonIcon()}
                  <span className="text-sm ml-2">{getDispenserButtonText()}</span>
                </div>
              </button>
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
                <Route path="/" element={<Home />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/filters" element={<Filters />} />
                <Route path="/form-prep" element={<FormPrep />} />
                <Route path="/auto-fossa" element={<AutoFossa />} />
                <Route path="/history" element={<History />} />
                <Route path="/system-logs" element={<SystemLogs />} />
                <Route path="/circle-k" element={<CircleK />} />
                <Route path="/work-orders" element={<WorkOrdersPage />} />
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
  return (
    <ToastProvider>
      <DispenserProvider>
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
      </DispenserProvider>
    </ToastProvider>
  );
}

export default App; 
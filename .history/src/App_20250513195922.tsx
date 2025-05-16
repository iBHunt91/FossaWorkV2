import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { FiHome, FiSettings, FiFilter, FiZap, FiFileText, FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiClock, FiLayout, FiDatabase, FiUser, FiChevronDown, FiCalendar, FiShoppingBag, FiMap } from 'react-icons/fi'
import { GiGasPump } from 'react-icons/gi';
import bannerImage from './assets/images/FossaMonitorLogo.png'
import { getActiveUser, getUsers, setActiveUser } from './services/userService'
import { ToastProvider, useToast } from './context/ToastContext'
import { DispenserProvider } from './context/DispenserContext'
import { useTheme } from './context/ThemeContext'
import { useScrapeStatus } from './context/ScrapeContext'
import './App.css';
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
const JobMapView = React.lazy(() => import('./pages/JobMapView'))
const Schedule = React.lazy(() => import('./pages/Schedule'))

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
  const handleScrapeWorkOrders = async () => {
    try {
      // Use the scrape context instead
      const { updateScrapeStatus } = useScrapeStatus();
      addToast("info", "Starting work order scrape...");
      
      // Make the API call to start the scrape, then update context
      await fetch('/api/scrape/start', {
        method: 'POST'
      });
      
      // Update scrape status immediately after starting
      updateScrapeStatus();
    } catch (error) {
      console.error('Error starting scrape:', error);
      addToast("error", `Error starting scrape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle starting dispenser scrape
  const handleStartDispenserScrapeJob = async () => {
    try {
      // Use the scrape context instead
      const { updateScrapeStatus } = useScrapeStatus();
      addToast("info", "Starting dispenser scrape...");
      
      // Make the API call to start the scrape, then update context
      await fetch('/api/scrape/dispensers/start', {
        method: 'POST'
      });
      
      // Update scrape status immediately after starting
      updateScrapeStatus();
    } catch (error) {
      console.error('Error starting dispenser scrape:', error);
      addToast("error", `Error starting dispenser scrape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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

  // Update the sidebar section with work order scraping status
  const renderWorkOrderStatus = () => {
    return (
      <div className="flex items-center justify-between mb-2 p-3 rounded-lg hover:bg-gray-800/70 transition-colors duration-200 border border-gray-700/50 bg-gray-800/30">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-blue-500/10">
            {isWorkOrderScraping ? (
              <FiRefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            ) : workOrderStatus.error ? (
              <FiAlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <FiCheckCircle className="w-4 h-4 text-green-400" />
            )}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-200">Work Orders</p>
            <p className="text-xs text-gray-400 truncate max-w-[160px]">
              {isWorkOrderScraping 
                ? `Scraping... ${workOrderStatus.progress || 0}%` 
                : workOrderStatus.error
                  ? workOrderStatus.error
                  : workOrderStatus.message || 'Ready'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleScrapeWorkOrders}
          disabled={isAnyScrapingInProgress}
          className={`ml-2 p-2 rounded-full ${
            isAnyScrapingInProgress 
              ? 'bg-gray-700 cursor-not-allowed opacity-50' 
              : 'bg-blue-500/20 hover:bg-blue-500/30 transition-colors duration-200'
          }`}
          title="Update work orders"
        >
          <FiRefreshCw className="w-4 h-4 text-blue-300" />
        </button>
      </div>
    );
  };

  // Update the sidebar section with dispenser scraping status
  const renderDispenserStatus = () => {
    return (
      <div className="flex items-center justify-between mb-2 p-3 rounded-lg hover:bg-gray-800/70 transition-colors duration-200 border border-gray-700/50 bg-gray-800/30">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-amber-500/10">
            {isDispenserScraping ? (
              <FiRefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            ) : dispenserStatus.error ? (
              <FiAlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <GiGasPump className="w-4 h-4 text-green-400" />
            )}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-200">Dispensers</p>
            <p className="text-xs text-gray-400 truncate max-w-[160px]">
              {isDispenserScraping 
                ? `Scraping... ${dispenserStatus.progress || 0}%` 
                : dispenserStatus.error
                  ? dispenserStatus.error
                  : dispenserStatus.message || 'No dispenser scrape job is running'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleStartDispenserScrapeJob}
          disabled={isAnyScrapingInProgress}
          className={`ml-2 p-2 rounded-full ${
            isAnyScrapingInProgress 
              ? 'bg-gray-700 cursor-not-allowed opacity-50' 
              : 'bg-amber-500/20 hover:bg-amber-500/30 transition-colors duration-200'
          }`}
          title="Update dispensers"
        >
          <FiRefreshCw className="w-4 h-4 text-amber-300" />
        </button>
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
              <Link 
                to="/schedule" 
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out hover:bg-gray-700 hover:text-white ${
                  location.pathname === '/schedule' ? 'bg-primary-500 text-white shadow-lg' : 'text-gray-300'
                }`}>
                <FiCalendar className="h-5 w-5" />
                <span>Schedule</span>
              </Link>
              <Link
                to="/job-map"
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out hover:bg-gray-700 hover:text-white ${
                  location.pathname === '/job-map' ? 'bg-primary-500 text-white shadow-lg' : 'text-gray-300'
                }`}>
                <FiMap className="h-5 w-5" />
                <span>Job Map</span>
              </Link>
              <Link
                to="/filters"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/filters' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/filters' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-r-md"></span>}
                <FiFilter className="w-5 h-5 mr-3 text-amber-400" />
                Filters
              </Link>

              <div className="pt-4 pb-2 px-1">
                <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-3">
                  Automation
                </div>
              </div>

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
                  Tools
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
                to="/circle-k"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/circle-k' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/circle-k' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-r-md"></span>}
                <FiShoppingBag className="w-5 h-5 mr-3 text-red-400" />
                Circle K
              </Link>

              <div className="pt-4 pb-2 px-1">
                <div className="text-xs uppercase font-semibold text-gray-500 px-3 mb-3">
                  Management
                </div>
              </div>

              <Link
                to="/settings"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/settings' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/settings' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400 rounded-r-md"></span>}
                <FiSettings className="w-5 h-5 mr-3 text-gray-400" />
                Settings
              </Link>
              <Link
                to="/system-logs"
                className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${location.pathname === '/system-logs' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'}`}
              >
                {location.pathname === '/system-logs' && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-r-md"></span>}
                <FiFileText className="w-5 h-5 mr-3 text-blue-400" />
                System Logs
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
                <Route path="/" element={<Home />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/filters" element={<Filters />} />
                <Route path="/form-prep" element={<FormPrep />} />
                <Route path="/auto-fossa" element={<AutoFossa />} />
                <Route path="/history" element={<History />} />
                <Route path="/system-logs" element={<SystemLogs />} />
                <Route path="/circle-k" element={<CircleK />} />
                <Route path="/job-map" element={<JobMapView />} />
                <Route path="/schedule" element={<Schedule />} />
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
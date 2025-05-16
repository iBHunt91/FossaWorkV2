import React, { useState, useEffect, useRef } from 'react';
import { 
  FiActivity, 
  FiAlertTriangle, 
  FiCheck, 
  FiCpu, 
  FiDatabase, 
  FiInfo, 
  FiMaximize2, 
  FiMinimize2, 
  FiRefreshCw, 
  FiWifi, 
  FiWifiOff, 
  FiX 
} from 'react-icons/fi';
import { getActiveJobs } from '../../services/formService';
import SystemMonitor from './SystemMonitor';
import NetworkStatus from './NetworkStatus';

interface DiagnosticsPanelProps {
  activeUserId: string;
  addDebugLog: (type: string, message: string, data?: any) => void;
}

/**
 * DiagnosticsPanel component
 * 
 * This component provides a comprehensive view of system diagnostics including:
 * - Active polling intervals
 * - System resource usage
 * - Network connection status
 * - Error logging and monitoring
 */
const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  activeUserId,
  addDebugLog
}) => {
  // Panel state
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Diagnostics state
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>({
    memory: {
      usedPercent: 0,
      total: '0 MB'
    },
    cpu: {
      usagePercent: 0
    },
    localStorage: {
      usedPercent: 0,
      used: '0 MB',
      total: '5 MB'
    }
  });
  const [networkStatus, setNetworkStatus] = useState<{
    online: boolean;
    latency: number | null;
    lastChecked: Date | null;
  }>({
    online: navigator.onLine,
    latency: null,
    lastChecked: null
  });
  
  // Error state
  const [errors, setErrors] = useState<Array<{
    id: string;
    timestamp: Date;
    message: string;
    type: string;
    details?: any;
  }>>([]);
  
  // Refs
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Load initial state
  useEffect(() => {
    // Log component initialization
    addDebugLog('SYSTEM', 'DiagnosticsPanel component initialized', {
      activeUserId
    });
    
    // Initial data load
    refreshDiagnostics();
    
    // Set up intervals
    startRefreshInterval();
    
    // Set up event listeners
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    // Check the current theme
    const darkModePreference = document.documentElement.classList.contains('dark');
    console.log('Current theme mode:', darkModePreference ? 'dark' : 'light');
    
    // Return cleanup function
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      
      addDebugLog('SYSTEM', 'DiagnosticsPanel component unmounting');
    };
  }, []);
  
  // Start the refresh interval
  const startRefreshInterval = () => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }
    
    // Set up interval for refreshing diagnostics - every 5 seconds
    refreshInterval.current = setInterval(() => {
      refreshDiagnostics();
    }, 5000);
  };
  
  // Refresh all diagnostics data
  const refreshDiagnostics = async () => {
    try {
      // Get active jobs
      const jobs = await getActiveJobs();
      setActiveJobs(jobs);
      
      // Check system resources - Mock data
      checkSystemResources();
      
      // Check network status
      checkNetworkStatus();
    } catch (error) {
      console.error('Error refreshing diagnostics:', error);
      addError('Error refreshing diagnostics', 'SYSTEM', error);
    }
  };
  
  // Handle network status changes
  const handleNetworkChange = () => {
    setNetworkStatus(prev => ({
      ...prev,
      online: navigator.onLine,
      lastChecked: new Date()
    }));
    
    if (navigator.onLine) {
      addDebugLog('NETWORK', 'Network connection restored');
    } else {
      addDebugLog('NETWORK', 'Network connection lost');
      addError('Network connection lost', 'NETWORK');
    }
  };
  
  // Check system resources (memory, CPU, localStorage usage)
  const checkSystemResources = () => {
    // Calculate localStorage usage
    let localStorageUsed = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          localStorageUsed += value.length;
        }
      }
    }
    
    // Mock memory and CPU usage for demo
    const memoryUsedPercent = Math.min(40 + Math.random() * 20, 100);
    const cpuUsagePercent = Math.min(30 + Math.random() * 30, 100);
    
    // Calculate localStorage usage
    const localStorageTotal = 5 * 1024 * 1024; // 5MB limit
    const localStorageUsedPercent = (localStorageUsed / localStorageTotal) * 100;
    
    setSystemStatus({
      memory: {
        usedPercent: memoryUsedPercent,
        total: '1024 MB'
      },
      cpu: {
        usagePercent: cpuUsagePercent
      },
      localStorage: {
        usedPercent: localStorageUsedPercent,
        used: formatBytes(localStorageUsed),
        total: formatBytes(localStorageTotal)
      }
    });
    
    // Check for high resource usage
    if (memoryUsedPercent > 90) {
      addError('High memory usage detected', 'SYSTEM', { memoryUsedPercent });
    }
    
    if (cpuUsagePercent > 90) {
      addError('High CPU usage detected', 'SYSTEM', { cpuUsagePercent });
    }
    
    if (localStorageUsedPercent > 80) {
      addError('localStorage usage approaching limit', 'SYSTEM', { 
        usedPercent: localStorageUsedPercent,
        used: formatBytes(localStorageUsed),
        total: formatBytes(localStorageTotal)
      });
    }
  };
  
  // Check network status and latency
  const checkNetworkStatus = async () => {
    const online = navigator.onLine;
    
    // Skip latency check if offline
    if (!online) {
      setNetworkStatus({
        online,
        latency: null,
        lastChecked: new Date()
      });
      return;
    }
    
    try {
      // Simple latency check by timing a simple fetch request
      const start = performance.now();
      await fetch('/ping', { method: 'HEAD', cache: 'no-store' }).catch(() => {
        // Silently fail - we'll use the navigator.onLine value
      });
      const end = performance.now();
      
      // Calculate latency - round to nearest ms
      const latency = Math.round(end - start);
      
      setNetworkStatus({
        online,
        latency,
        lastChecked: new Date()
      });
      
      // Check for high latency
      if (latency > 1000) {
        addError('High network latency detected', 'NETWORK', { latency });
      }
    } catch (error) {
      console.error('Error checking network status:', error);
      
      // Still update the status, but without latency
      setNetworkStatus({
        online,
        latency: null,
        lastChecked: new Date()
      });
    }
  };
  
  // Add an error to the error log
  const addError = (message: string, type: string, details?: any) => {
    const newError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      message,
      type,
      details
    };
    
    setErrors(prev => [newError, ...prev].slice(0, 50));
    
    // Log the error
    addDebugLog('ERROR', message, details);
  };
  
  // Clear all errors
  const clearErrors = () => {
    setErrors([]);
  };
  
  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals: number = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // Format date to a human-readable format
  const formatDate = (date: Date) => {
    return date.toLocaleTimeString();
  };
  
  // Toggle panel expansion
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Toggle panel collapse
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Check if warning level needed
  const hasWarning = () => {
    return (
      errors.length > 0 ||
      !networkStatus.online ||
      (networkStatus.latency && networkStatus.latency > 500) ||
      systemStatus.memory.usedPercent > 80 ||
      systemStatus.cpu.usagePercent > 80 ||
      systemStatus.localStorage.usedPercent > 80
    );
  };
  
  // Check if error level needed
  const hasError = () => {
    return (
      errors.length > 5 ||
      !networkStatus.online ||
      (networkStatus.latency && networkStatus.latency > 1000) ||
      systemStatus.memory.usedPercent > 90 ||
      systemStatus.cpu.usagePercent > 90 ||
      systemStatus.localStorage.usedPercent > 90
    );
  };
  
  // Render the status indicator pill
  const renderStatusPill = () => {
    if (hasError()) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
          <FiAlertTriangle className="mr-1 h-3 w-3" />
          Error
        </span>
      );
    } else if (hasWarning()) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
          <FiInfo className="mr-1 h-3 w-3" />
          Warning
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
          <FiCheck className="mr-1 h-3 w-3" />
          Healthy
        </span>
      );
    }
  };
  
  // Handle manual refresh
  const handleManualRefresh = () => {
    refreshDiagnostics();
  };
  
  // If collapsed, just show a simple indicator button
  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleCollapse}
          className={`rounded-full w-10 h-10 flex items-center justify-center shadow-lg ${
            hasError() 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : hasWarning()
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
          title="System Diagnostics"
        >
          <FiActivity className="w-5 h-5" />
        </button>
      </div>
    );
  }
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
      isExpanded ? 'w-3/4 h-3/4' : 'w-80 max-h-96'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <FiActivity className="w-5 h-5 text-primary-500 mr-2" />
          <h3 className="text-md font-medium text-gray-900 dark:text-white">System Diagnostics</h3>
          <div className="ml-2">
            {renderStatusPill()}
          </div>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={handleManualRefresh}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleExpand}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? (
              <FiMinimize2 className="w-4 h-4" />
            ) : (
              <FiMaximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={toggleCollapse}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'overview'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'jobs'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('jobs')}
        >
          Active Jobs
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'errors'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('errors')}
        >
          Errors {errors.length > 0 && `(${errors.length})`}
        </button>
      </div>
      
      {/* Content Area */}
      <div className="p-3 overflow-auto" style={{ height: 'calc(100% - 80px)' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* System Resources */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <FiCpu className="w-4 h-4 mr-1" /> System Resources
              </h4>
              <SystemMonitor systemStatus={systemStatus} />
            </div>
            
            {/* Network Status */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                {networkStatus.online ? (
                  <FiWifi className="w-4 h-4 mr-1" />
                ) : (
                  <FiWifiOff className="w-4 h-4 mr-1" />
                )}
                Network Status
              </h4>
              <NetworkStatus 
                online={networkStatus.online}
                latency={networkStatus.latency}
                lastChecked={networkStatus.lastChecked}
              />
            </div>
            
            {/* Active Jobs Summary */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <FiActivity className="w-4 h-4 mr-1" /> Active Jobs
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                {activeJobs.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No active jobs
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {activeJobs.slice(0, 3).map(job => (
                      <div key={job.jobId} className="text-sm flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">
                          {job.isBatch ? 'Batch Job:' : 'Single Visit:'} 
                          <span className="font-mono text-gray-500 dark:text-gray-400 ml-1">
                            {job.jobId.substring(0, 8)}...
                          </span>
                        </span>
                        <span className={`${
                          job.paused 
                            ? 'text-amber-500' 
                            : job.status === 'running' 
                              ? 'text-blue-500' 
                              : 'text-gray-500'
                        }`}>
                          {job.paused ? 'Paused' : job.status}
                        </span>
                      </div>
                    ))}
                    {activeJobs.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        {activeJobs.length - 3} more job{activeJobs.length - 3 > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* LocalStorage Usage */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <FiDatabase className="w-4 h-4 mr-1" /> LocalStorage Usage
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {systemStatus.localStorage.used} of {systemStatus.localStorage.total}
                  </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {systemStatus.localStorage.usedPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`rounded-full h-2 ${
                      systemStatus.localStorage.usedPercent > 90
                        ? 'bg-red-500'
                        : systemStatus.localStorage.usedPercent > 70
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${systemStatus.localStorage.usedPercent}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Last Updated */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              Last updated: {formatDate(new Date())}
            </div>
          </div>
        )}
        
        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Active Jobs ({activeJobs.length})
            </h4>
            
            {activeJobs.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-4 text-center text-gray-500 dark:text-gray-400">
                No active jobs at this time
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.map(job => (
                  <div key={job.jobId} className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full mr-2 ${
                          job.paused 
                            ? 'bg-amber-500' 
                            : job.status === 'running' 
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {job.isBatch ? 'Batch Job' : 'Single Visit'}: {job.jobId.substring(0, 10)}...
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Duration: {job.duration} min
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {job.message || 'Processing...'}
                    </div>
                    
                    {job.progress && (
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-gray-500 dark:text-gray-400">Progress</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{job.progress}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className={`rounded-full h-1.5 ${
                              job.paused 
                                ? 'bg-amber-500' 
                                : 'bg-blue-500'
                            }`}
                            style={{ 
                              width: `${
                                job.progress 
                                  ? (parseInt(job.progress.split('/')[0], 10) / parseInt(job.progress.split('/')[1], 10)) * 100
                                  : 0
                              }%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Error Log ({errors.length})
              </h4>
              
              {errors.length > 0 && (
                <button
                  onClick={clearErrors}
                  className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {errors.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-4 text-center text-gray-500 dark:text-gray-400">
                No errors at this time
              </div>
            ) : (
              <div className="space-y-3">
                {errors.map(error => (
                  <div 
                    key={error.id} 
                    className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md p-3"
                  >
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center">
                        <FiAlertTriangle className="text-red-500 w-4 h-4 mr-1.5" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                          {error.type}
                        </span>
                      </div>
                      <span className="text-xs text-red-500 dark:text-red-400">
                        {formatDate(error.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {error.message}
                    </p>
                    
                    {error.details && (
                      <details className="mt-1">
                        <summary className="text-xs text-red-500 dark:text-red-400 cursor-pointer">
                          Error Details
                        </summary>
                        <pre className="mt-1 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(error.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticsPanel;
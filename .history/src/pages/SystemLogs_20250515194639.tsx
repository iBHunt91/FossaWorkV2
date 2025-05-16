import React, { useState, useEffect } from 'react';
import { FiX, FiRefreshCw, FiFilter, FiSearch, FiInfo, FiAlertCircle, FiCheckCircle, FiServer, FiFileText } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import ScrapeLogsConsole from '../components/ScrapeLogsConsole';
import { systemLogs } from '../services/scrapeService';

// Extend the existing log console types to include form prep automation
type LogConsoleType = 'workOrder' | 'dispenser' | 'server' | 'formPrep';

const SystemLogs: React.FC = () => {
  const [logConsoleType, setLogConsoleType] = useState<LogConsoleType>('dispenser');
  const [showTestOptions, setShowTestOptions] = useState<boolean>(false);
  const [lastActiveTab, setLastActiveTab] = useState<string | null>(null);

  // Set page title
  useEffect(() => {
    document.title = 'System Logs | FM 1.0';
    
    // Read last active tab from local storage if available
    const savedTab = localStorage.getItem('systemLogsActiveTab');
    if (savedTab && ['workOrder', 'dispenser', 'server', 'formPrep'].includes(savedTab)) {
      setLogConsoleType(savedTab as LogConsoleType);
      setLastActiveTab(savedTab);
    }
    
    // Generate initial logs if none exist for server and formPrep
    setTimeout(() => {
      if (logConsoleType === 'server') {
        systemLogs.server.info('System logs page loaded');
        systemLogs.server.debug('User viewing server logs', { timestamp: new Date().toISOString() });
      } else if (logConsoleType === 'formPrep') {
        systemLogs.formPrep.info('Form Prep automation logs loaded');
        systemLogs.formPrep.debug('User viewing form prep logs', { timestamp: new Date().toISOString() });
      }
    }, 500);
    
    return () => {
      document.title = 'FM 1.0';
    };
  }, []);
  
  // Save active tab to local storage when it changes
  useEffect(() => {
    if (logConsoleType !== lastActiveTab) {
      localStorage.setItem('systemLogsActiveTab', logConsoleType);
      setLastActiveTab(logConsoleType);
    }
  }, [logConsoleType, lastActiveTab]);

  // Helper function to generate test logs for each log type
  const generateTestLogs = (type: LogConsoleType) => {
    // Define log messages by type
    const messages = {
      info: `This is an INFO test message for ${type}`,
      success: `This is a SUCCESS test message for ${type}`,
      warn: `This is a WARNING test message for ${type}`,
      error: `This is an ERROR test message for ${type}`,
      system: `This is a SYSTEM test message for ${type}`,
      network: `This is a NETWORK test message for ${type}`,
      progress: `This is a PROGRESS test message for ${type}`,
      debug: `This is a DEBUG test message for ${type}`
    };

    // Create a mapping to the appropriate log function
    let logger;
    switch(type) {
      case 'workOrder':
        logger = systemLogs.workOrder;
        break;
      case 'dispenser':
        logger = systemLogs.dispenser;
        break;
      case 'server':
        logger = systemLogs.server;
        break;
      case 'formPrep':
        logger = systemLogs.formPrep;
        break;
      default:
        logger = systemLogs.server;
    }

    // Send all test logs
    logger.info(messages.info);
    logger.success(messages.success);
    logger.warn(messages.warn);
    logger.error(messages.error);
    logger.system(messages.system);
    logger.network(messages.network);
    logger.progress(messages.progress, { progress: 50, total: 100 });
    logger.debug(messages.debug, { 
      user: 'test_user', 
      timestamp: new Date().toISOString(),
      details: {
        action: 'test',
        result: 'success'
      }
    });
  };

  // Display a message with sample structured data
  const generateStructuredTestLogs = (type: LogConsoleType) => {
    const logger = systemLogs[type];
    
    // Create structured data examples
    logger.info('User authentication successful', { 
      userId: 'user_123', 
      loginTime: new Date().toISOString(),
      ipAddress: '192.168.1.1'
    });
    
    logger.warn('API rate limit approaching threshold', {
      currentRate: 950,
      maxRate: 1000,
      timeWindow: '1 hour'
    });
    
    logger.error('Database connection failed', {
      errorCode: 'DB_CONN_REFUSED',
      attemptCount: 3,
      nextRetryIn: '30 seconds'
    });
    
    logger.success('Data synchronization completed', {
      recordsProcessed: 1250,
      duration: '5.2 seconds',
      syncTarget: 'cloud storage'
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-screen-xl">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
              <FiServer className="h-6 w-6 mr-2 text-blue-500" />
              System Logs
            </h1>
            <button 
              onClick={() => setShowTestOptions(!showTestOptions)}
              className="px-3 py-1.5 text-xs rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center"
            >
              {showTestOptions ? <FiX className="w-3.5 h-3.5 mr-1.5" /> : <FiInfo className="w-3.5 h-3.5 mr-1.5" />}
              {showTestOptions ? 'Hide Test Tools' : 'Show Test Tools'}
            </button>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and analyze system activities across different components
          </p>
        </div>

        {/* Tab selector */}
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 mx-6 mt-4 rounded-lg">
            <button
              className={`py-2.5 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
                logConsoleType === 'workOrder'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => setLogConsoleType('workOrder')}
            >
              <span className="flex items-center justify-center">
                <FiFileText className="h-4 w-4 mr-1.5" />
                Work Orders
              </span>
            </button>
            <button
              className={`py-2.5 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
                logConsoleType === 'dispenser'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => setLogConsoleType('dispenser')}
            >
              <span className="flex items-center justify-center">
                <GiGasPump className="h-4 w-4 mr-1.5" />
                Equipment
              </span>
            </button>
            <button
              className={`py-2.5 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
                logConsoleType === 'server'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => setLogConsoleType('server')}
            >
              <span className="flex items-center justify-center">
                <FiServer className="h-4 w-4 mr-1.5" />
                Server
              </span>
            </button>
            <button
              className={`py-2.5 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
                logConsoleType === 'formPrep'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => setLogConsoleType('formPrep')}
            >
              <span className="flex items-center justify-center">
                <FiFileText className="h-4 w-4 mr-1.5" />
                Form Prep
              </span>
            </button>
          </div>
        </div>
        
        {/* Log testing tools section */}
        {showTestOptions && (
          <div className="mt-4 mx-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Log Testing Tools</h2>
              <button 
                onClick={() => setShowTestOptions(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Use these tools to generate test logs with different severity levels and formats for the current log type.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-600 dark:text-gray-300">Basic Log Types</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => generateTestLogs(logConsoleType)}
                    className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-700/30 dark:hover:bg-blue-700/50 text-blue-600 dark:text-blue-300 text-xs rounded-md flex items-center"
                  >
                    <FiRefreshCw className="w-3 h-3 mr-1.5" />
                    Generate All Log Types
                  </button>
                  
                  <button
                    onClick={() => systemLogs[logConsoleType].success('Operation completed successfully')}
                    className="px-2.5 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-700/30 dark:hover:bg-green-700/50 text-green-600 dark:text-green-300 text-xs rounded-md flex items-center"
                  >
                    <FiCheckCircle className="w-3 h-3 mr-1.5" />
                    Success
                  </button>
                  
                  <button
                    onClick={() => systemLogs[logConsoleType].error('An error occurred during operation')}
                    className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-700/30 dark:hover:bg-red-700/50 text-red-600 dark:text-red-300 text-xs rounded-md flex items-center"
                  >
                    <FiAlertCircle className="w-3 h-3 mr-1.5" />
                    Error
                  </button>
                  
                  <button
                    onClick={() => systemLogs[logConsoleType].warn('Warning: resource is running low')}
                    className="px-2.5 py-1.5 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-700/30 dark:hover:bg-yellow-700/50 text-yellow-600 dark:text-yellow-300 text-xs rounded-md flex items-center"
                  >
                    <FiAlertCircle className="w-3 h-3 mr-1.5" />
                    Warning
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-600 dark:text-gray-300">Structured Data</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => generateStructuredTestLogs(logConsoleType)}
                    className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-700/30 dark:hover:bg-purple-700/50 text-purple-600 dark:text-purple-300 text-xs rounded-md flex items-center"
                  >
                    <FiServer className="w-3 h-3 mr-1.5" />
                    Generate Structured Logs
                  </button>
                  
                  <button
                    onClick={() => systemLogs[logConsoleType].progress('Processing data', { progress: 42, total: 100, estimatedTimeRemaining: '3 minutes' })}
                    className="px-2.5 py-1.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-700/30 dark:hover:bg-cyan-700/50 text-cyan-600 dark:text-cyan-300 text-xs rounded-md flex items-center"
                  >
                    <FiRefreshCw className="w-3 h-3 mr-1.5" />
                    Progress Update
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-600 dark:text-gray-300">Generate Logs for Other Tabs</h3>
                <div className="flex gap-2">
                  {logConsoleType !== 'workOrder' && (
                    <button
                      onClick={() => generateTestLogs('workOrder')}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded"
                    >
                      Work Orders
                    </button>
                  )}
                  {logConsoleType !== 'dispenser' && (
                    <button
                      onClick={() => generateTestLogs('dispenser')}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded"
                    >
                      Equipment
                    </button>
                  )}
                  {logConsoleType !== 'server' && (
                    <button
                      onClick={() => generateTestLogs('server')}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded"
                    >
                      Server
                    </button>
                  )}
                  {logConsoleType !== 'formPrep' && (
                    <button
                      onClick={() => generateTestLogs('formPrep')}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded"
                    >
                      Form Prep
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="p-6">
          <ScrapeLogsConsole 
            type={logConsoleType} 
            showHeader={true}
            height="calc(100vh - 300px)"
            autoScroll={true}
          />
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
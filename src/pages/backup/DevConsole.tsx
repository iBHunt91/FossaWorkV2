import React, { useState, useEffect, useLayoutEffect } from 'react';
import { 
  FiCode, FiRefreshCw, FiFilter, FiSearch, FiInfo, 
  FiAlertCircle, FiCheckCircle, FiServer, FiFileText,
  FiTerminal, FiCommand, FiCpu
} from 'react-icons/fi';
import ScrapeLogsConsole from '../components/ScrapeLogsConsole';
import { systemLogs } from '../services/scrapeService';
import Button from '../components/Button';

const DevConsole: React.FC = () => {
  const [lastActiveTab, setLastActiveTab] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Function to generate various types of test logs
  const handleGenerateTestLog = (logType: 'debug' | 'info' | 'success' | 'warn' | 'error' | 'system' | 'network' | 'progress' | 'status') => {
    const timestamp = new Date().toISOString();
    const logMessages = {
      debug: `Debug message generated at ${timestamp}`,
      info: `Info message generated at ${timestamp}`,
      success: `Success message generated at ${timestamp}`,
      warn: `Warning message generated at ${timestamp}`,
      error: `Error message generated at ${timestamp}`,
      system: `System message generated at ${timestamp}`,
      network: `Network request message generated at ${timestamp}`,
      progress: `Progress update message generated at ${timestamp}`,
      status: `Status update message generated at ${timestamp}`
    };
    
    // Use the systemLogs.dev object to log the message
    systemLogs.dev[logType](logMessages[logType], { timestamp, generated: true });
    setLastUpdated(new Date());
  };

  // Function to generate a structured log with complex data
  const handleGenerateStructuredLog = () => {
    const complexData = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      appVersion: process.env.REACT_APP_VERSION || '1.0.0',
      browser: navigator.userAgent,
      // Safe access to Chrome's non-standard memory performance API
      memoryUsage: 'Not Available',
      screenSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    
    // Log structured data
    systemLogs.dev.debug('Generated structured log with detailed system information', complexData);
    setLastUpdated(new Date());
  };

  // Set page title and generate initial logs
  useEffect(() => {
    document.title = 'Fossa Monitor | Dev Console';
    
    // Generate initial logs to ensure we have content to display
    // Create initial logs when component mounts
    setTimeout(() => {
      systemLogs.dev.info('Dev Console initialized', { timestamp: new Date().toISOString() });
      systemLogs.dev.debug('Developer environment details', { 
        version: process.env.REACT_APP_VERSION || '1.0.0', 
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
      systemLogs.dev.system('System ready for developer operations', { timestamp: new Date().toISOString() });
    }, 500);
    
    return () => {
      document.title = 'Fossa Monitor';
    };
  }, []);
  
  // Save active tab to local storage when it changes
  useEffect(() => {
    if (lastActiveTab) {
      localStorage.setItem('devConsoleActiveTab', lastActiveTab);
    }
  }, [lastActiveTab]);

  // Helper function to generate test logs
  const generateTestLogs = () => {
    systemLogs.dev.info('This is an INFO test message from the Dev Console');
    systemLogs.dev.success('This is a SUCCESS test message from the Dev Console');
    systemLogs.dev.warn('This is a WARNING test message from the Dev Console');
    systemLogs.dev.error('This is an ERROR test message from the Dev Console');
    systemLogs.dev.system('This is a SYSTEM test message from the Dev Console');
    systemLogs.dev.network('This is a NETWORK test message from the Dev Console');
    systemLogs.dev.progress('This is a PROGRESS test message from the Dev Console', { progress: 50, total: 100 });
    systemLogs.dev.debug('This is a DEBUG test message from the Dev Console', { 
      developer: 'test_user', 
      timestamp: new Date().toISOString(),
      details: {
        action: 'test',
        result: 'success'
      }
    });
  };

  // Generate structured test logs
  const generateStructuredTestLogs = () => {
    systemLogs.dev.info('App configuration loaded', { 
      appVersion: '1.0.0', 
      platform: 'electron',
      environment: process.env.NODE_ENV
    });
    
    systemLogs.dev.debug('Component render cycle details', {
      component: 'DevConsole',
      renderTime: '24ms',
      memoryUsage: '12.4MB'
    });
    
    systemLogs.dev.system('Internal state update', {
      previousState: 'idle',
      currentState: 'processing',
      transitionTime: '42ms'
    });
    
    systemLogs.dev.network('API request details', {
      endpoint: '/api/data',
      method: 'GET',
      responseTime: '320ms',
      statusCode: 200
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 dark:bg-primary-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiTerminal className="text-white h-6 w-6" />
              <h1 className="text-xl font-semibold text-white">Developer Console</h1>
            </div>
            <div className="flex space-x-3">
              <div className="text-xs bg-primary-700 text-primary-100 px-3 py-1.5 rounded-full">
                Environment: {process.env.NODE_ENV || 'development'}
              </div>
              <div className="text-xs bg-primary-700 text-primary-100 px-3 py-1.5 rounded-full">
                Version: {process.env.REACT_APP_VERSION || '1.0.0'}
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {/* Test Controls */}
            <div className="mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <FiCommand className="mr-2" /> Log Generator
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-600 dark:text-gray-300">Basic Logs</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={generateTestLogs}
                      className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-700/30 dark:hover:bg-blue-700/50 text-blue-600 dark:text-blue-300 text-xs rounded-md flex items-center"
                    >
                      <FiInfo className="w-3 h-3 mr-1.5" />
                      Generate Test Logs
                    </button>
                    
                    <button
                      onClick={() => systemLogs.dev.error('An error occurred in the application', { timestamp: new Date().toISOString() })}
                      className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-700/30 dark:hover:bg-red-700/50 text-red-600 dark:text-red-300 text-xs rounded-md flex items-center"
                    >
                      <FiAlertCircle className="w-3 h-3 mr-1.5" />
                      Error
                    </button>
                    
                    <button
                      onClick={() => systemLogs.dev.warn('Warning: Resource usage is high', { 
                        cpu: '82%', 
                        memory: '1.2GB',
                        timestamp: new Date().toISOString()
                      })}
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
                      onClick={generateStructuredTestLogs}
                      className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-700/30 dark:hover:bg-purple-700/50 text-purple-600 dark:text-purple-300 text-xs rounded-md flex items-center"
                    >
                      <FiServer className="w-3 h-3 mr-1.5" />
                      Generate Structured Logs
                    </button>
                    
                    <button
                      onClick={() => systemLogs.dev.progress('Task execution progress', { 
                        progress: 42, 
                        total: 100, 
                        estimatedTimeRemaining: '3 minutes',
                        timestamp: new Date().toISOString()
                      })}
                      className="px-2.5 py-1.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-700/30 dark:hover:bg-cyan-700/50 text-cyan-600 dark:text-cyan-300 text-xs rounded-md flex items-center"
                    >
                      <FiRefreshCw className="w-3 h-3 mr-1.5" />
                      Progress Update
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-600 dark:text-gray-300">Technical Logs</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => systemLogs.dev.system('System state snapshot', { 
                        uptime: '3h 42m', 
                        processes: 12,
                        threads: 28,
                        timestamp: new Date().toISOString() 
                      })}
                      className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-700/30 dark:hover:bg-emerald-700/50 text-emerald-600 dark:text-emerald-300 text-xs rounded-md flex items-center"
                    >
                      <FiCpu className="w-3 h-3 mr-1.5" />
                      System Log
                    </button>
                    
                    <button
                      onClick={() => systemLogs.dev.network('API call completed', { 
                        endpoint: '/api/data/sync', 
                        method: 'POST',
                        status: 201,
                        duration: '348ms',
                        timestamp: new Date().toISOString()
                      })}
                      className="px-2.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-700/30 dark:hover:bg-indigo-700/50 text-indigo-600 dark:text-indigo-300 text-xs rounded-md flex items-center"
                    >
                      <FiServer className="w-3 h-3 mr-1.5" />
                      Network Log
                    </button>
                    
                    <button
                      onClick={() => systemLogs.dev.debug('Detailed component render data', { 
                        component: 'DevConsole',
                        renderCount: 5,
                        renderTime: '18ms',
                        reRenderCause: 'state update',
                        stateChanges: ['logs', 'filters'],
                        timestamp: new Date().toISOString()
                      })}
                      className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600/70 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded-md flex items-center"
                    >
                      <FiCode className="w-3 h-3 mr-1.5" />
                      Debug Log
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Logs Console */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex flex-col items-center p-5 bg-white dark:bg-gray-800 shadow-sm rounded-lg">
                <div className="grid grid-cols-2 gap-3 w-full mb-4">
                  <Button 
                    onClick={() => handleGenerateTestLog('info')}
                    className="w-full"
                    variant="info"
                  >
                    Generate Info Log
                  </Button>
                  <Button 
                    onClick={() => handleGenerateTestLog('success')}
                    className="w-full"
                    variant="success"
                  >
                    Generate Success Log
                  </Button>
                  <Button 
                    onClick={() => handleGenerateTestLog('warn')}
                    className="w-full"
                    variant="warning"
                  >
                    Generate Warning Log
                  </Button>
                  <Button 
                    onClick={() => handleGenerateTestLog('error')}
                    className="w-full"
                    variant="danger"
                  >
                    Generate Error Log
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button 
                    onClick={() => handleGenerateTestLog('debug')}
                    className="w-full"
                    variant="secondary"
                  >
                    Generate Debug Log
                  </Button>
                  <Button 
                    onClick={() => handleGenerateTestLog('system')}
                    className="w-full"
                    variant="dark"
                  >
                    Generate System Log
                  </Button>
                  <Button 
                    onClick={() => handleGenerateTestLog('network')}
                    className="w-full"
                    variant="info"
                  >
                    Generate Network Log
                  </Button>
                  <Button 
                    onClick={() => handleGenerateStructuredLog()}
                    className="w-full"
                    variant="primary"
                  >
                    Generate Structured Log
                  </Button>
                </div>
              </div>
              <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <FiFileText className="mr-2" /> Developer Logs
              </h2>
              
              <ScrapeLogsConsole 
                type="dev" 
                showHeader={true}
                height="calc(100vh - 480px)"
                autoScroll={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevConsole;

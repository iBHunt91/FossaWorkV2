import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import ScrapeLogsConsole from '../components/ScrapeLogsConsole';

// Extend the existing log console types to include form prep automation
type LogConsoleType = 'workOrder' | 'dispenser' | 'server' | 'formPrep';

const SystemLogs: React.FC = () => {
  const [logConsoleType, setLogConsoleType] = useState<LogConsoleType>('dispenser');

  // Set page title
  useEffect(() => {
    document.title = 'System Logs | FM 1.0';
    return () => {
      document.title = 'FM 1.0';
    };
  }, []);

  return (
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v10H5V5z" clipRule="evenodd" />
              <path d="M7 7h6v2H7V7zm0 4h6v2H7v-2z" />
            </svg>
            System Logs
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and monitor system logs for various components
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 mx-6 mt-4 rounded-lg">
          <button
            className={`py-2 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
              logConsoleType === 'workOrder'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setLogConsoleType('workOrder')}
          >
            <span className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              Work Orders
            </span>
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
              logConsoleType === 'dispenser'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setLogConsoleType('dispenser')}
          >
            <span className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Equipment
            </span>
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
              logConsoleType === 'server'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setLogConsoleType('server')}
          >
            <span className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              Server
            </span>
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium rounded-md transition-colors duration-150 flex-1 ${
              logConsoleType === 'formPrep'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setLogConsoleType('formPrep')}
          >
            <span className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              Form Prep
            </span>
          </button>
        </div>
        
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
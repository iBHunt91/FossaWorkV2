import React, { useState, useEffect } from 'react';
import ScrapeLogsConsole from '../components/ScrapeLogsConsole';
import { systemLogs } from '../services/scrapeService';

const SystemLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workOrder' | 'dispenser' | 'server' | 'formPrep'>('workOrder');

  // Set page title
  useEffect(() => {
    document.title = 'System Logs | FM 1.0';
    return () => {
      document.title = 'FM 1.0';
    };
  }, []);

  // Helper function to generate test logs
  const generateTestLogs = (type: 'workOrder' | 'dispenser' | 'server' | 'formPrep') => {
    const logger = systemLogs[type];
    logger.info('This is an INFO test message');
    logger.success('This is a SUCCESS test message');
    logger.warn('This is a WARNING test message');
    logger.error('This is an ERROR test message');
    logger.system('This is a SYSTEM test message');
    logger.network('This is a NETWORK test message');
    logger.progress('This is a PROGRESS test message with data', { progress: 50, total: 100 });
    logger.status('This is a STATUS test message');
    logger.debug('This is a DEBUG test message with detailed information', { 
      user: 'test_user', 
      timestamp: new Date().toISOString(),
      details: {
        action: 'test',
        result: 'success'
      }
    });
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold mb-2">System Logs</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          View application logs and diagnostics information.
        </p>
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setActiveTab('workOrder')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'workOrder'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Work Orders
          </button>
          <button
            onClick={() => setActiveTab('dispenser')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'dispenser'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Equipment
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'server'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Server
          </button>
          <button
            onClick={() => setActiveTab('formPrep')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'formPrep'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Form Prep
          </button>
        </div>
      </div>
      
      <ScrapeLogsConsole type={activeTab} height="500px" />

      {/* Test section for generating logs */}
      <div className="mt-6 border-t pt-4 border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Log Testing Tools</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Use these buttons to generate test logs for each log type with different severity levels.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => generateTestLogs('workOrder')}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md"
          >
            Test Work Order Logs
          </button>
          <button
            onClick={() => generateTestLogs('dispenser')}
            className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md"
          >
            Test Equipment Logs
          </button>
          <button
            onClick={() => generateTestLogs('server')}
            className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-md"
          >
            Test Server Logs
          </button>
          <button
            onClick={() => generateTestLogs('formPrep')}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-md"
          >
            Test Form Prep Logs
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs; 
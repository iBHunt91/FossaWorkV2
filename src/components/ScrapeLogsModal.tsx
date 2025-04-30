import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import ScrapeLogsConsole from './ScrapeLogsConsole';

interface ScrapeLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScrapeLogsModal: React.FC<ScrapeLogsModalProps> = ({ isOpen, onClose }) => {
  const [logConsoleType, setLogConsoleType] = useState<'workOrder' | 'dispenser'>('dispenser');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Data Update Logs</h2>
          <div className="flex items-center space-x-3">
            <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setLogConsoleType('dispenser')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  logConsoleType === 'dispenser' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Equipment Data
              </button>
              <button
                onClick={() => setLogConsoleType('workOrder')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  logConsoleType === 'workOrder' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Service Appointments
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <ScrapeLogsConsole type={logConsoleType} height="calc(80vh - 120px)" />
        </div>
      </div>
    </div>
  );
};

export default ScrapeLogsModal; 
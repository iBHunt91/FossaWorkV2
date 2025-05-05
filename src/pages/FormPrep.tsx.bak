import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, 
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin
} from 'react-icons/fi';
// Import work order data from the local data file
import workOrderData from '../data/scraped_content.json';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
// Import form service
import { 
  processSingleVisit, 
  getFormAutomationStatus, 
  processBatchVisits, 
  getBatchAutomationStatus,
  cancelFormAutomation
} from '../services/formService';

interface FormJob {
  url: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  timestamp?: string;
  headless: boolean;
  storeName?: string;
  visitNumber?: string;
  dispenserCount?: number;
  // Flags for tracking state changes for toast notifications
  _statusChanged?: boolean;
  _completed?: boolean;
  _error?: boolean;
}

interface BatchJob {
  filePath: string;
  timestamp: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  totalVisits: number;
  completedVisits: number;
  headless: boolean;
}

// Add type definitions for service function returns
interface SingleProcessResult {
  success: boolean;
  message: string;
  jobId: string;
}

interface BatchProcessResult {
  success: boolean;
  message: string;
  jobId: string;
  totalVisits?: number;
}

interface WorkOrder {
  id: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
      intersection: string;
      cityState: string;
      county: string;
    };
  };
  services?: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: {
    nextVisit: {
      visitId: string;
      date: string;
      time: string;
      url: string;
    };
  };
  dispensers?: Array<{
    title?: string;
    serial?: string;
    make?: string;
    model?: string;
    fields?: {
      [key: string]: string | undefined;
    };
  }>;
}

const FormPrep: React.FC = () => {
  const { isDarkMode } = useTheme();
  // Initialize empty work orders array, it will be populated via API
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [visitUrl, setVisitUrl] = useState<string>('');
  const [batchFilePath, setBatchFilePath] = useState<string>('data/scraped_content.json');
  const [formJobs, setFormJobs] = useState<FormJob[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isHeadless, setIsHeadless] = useState<boolean>(true);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);
  const [singleJobId, setSingleJobId] = useState<string | null>(null);
  const [pollingSingle, setPollingSingle] = useState<boolean>(false);
  const [currentWeekIndex, setCurrentWeekIndex] = useState<number>(0);
  const { addToast } = useToast();
  
  // All your existing functions and logic here
  // ...

  // For this example, I'll just define stubs for the functions used in the JSX
  const goToPreviousWeek = () => {};
  const goToNextWeek = () => {};
  const goToCurrentWeek = () => {};
  const extractVisitNumber = (url: string): string => { return ""; };
  const extractVisitInfo = (url: string) => { return { storeName: "", visitNumber: "", dispenserCount: 0 }; };
  const getDispenserCountDirect = (id: string): number => { return 0; };
  const getStoreStyles = (name: string) => { return { bg: "", border: "", icon: "" }; };
  const openUrlWithLogin = async (url: string) => {};
  const handleSingleVisit = async () => {};
  const handleStopProcessing = async () => {};
  const handleBatchProcess = async () => {};
  const getStatusIcon = (status: 'idle' | 'running' | 'completed' | 'error') => <></>;

  // Dummy data for the example
  const groupedWorkOrders = [{ week: "Current Week", orders: [] }];
  const filteredWorkOrders = [];

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-8">
          {/* Page header */}
          <div className="panel-header px-6 py-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-3">
                <FiFileText className="h-6 w-6 text-primary-500" />
                Form Prep
              </h1>
              <div className="flex gap-2">
                {/* Toggle between single and batch modes */}
                <div className="p-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
                  <button
                    onClick={() => setActiveTab('single')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      activeTab === 'single'
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Single Visit
                  </button>
                  <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      activeTab === 'batch'
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Batch Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
            {/* Tab navigation */}
            <div className="flex border-b mb-6 border-gray-200 dark:border-gray-700">
              <button 
                className={`py-3 px-4 font-medium flex items-center space-x-2 border-b-2 -mb-px ${
                  activeTab === 'single' 
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('single')}
              >
                <FiFileText />
                <span>Single Visit</span>
              </button>
              <button 
                className={`py-3 px-4 font-medium flex items-center space-x-2 border-b-2 -mb-px ${
                  activeTab === 'batch' 
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('batch')}
              >
                <FiUpload />
                <span>Batch Mode</span>
              </button>
            </div>

            {activeTab === 'single' && (
              <div className="space-y-6">
                {/* Work Order Selection Panel */}
                <div className="panel">
                  {/* Content for the single tab - simplified for this example */}
                </div>
              </div>
            )}

            {activeTab === 'batch' && (
              <div className="space-y-6">
                {/* Batch File Selection Panel */}
                <div className="panel">
                  {/* Content for the batch tab - simplified for this example */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FormPrep;

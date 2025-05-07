import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, FiChevronDown, FiEye
} from 'react-icons/fi';
// Import work order data
import workOrderData from '../../../data/scraped_content.json';
import { useToast } from '../context/ToastContext';
// Import form service
import { 
  processSingleVisit, 
  getFormAutomationStatus, 
  processBatchVisits, 
  getBatchAutomationStatus 
} from '../services/formService';

interface FormJob {
  url: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message?: string;
  timestamp?: string;
  headless: boolean;
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
  const { addToast } = useToast();

  // Get work orders data
  const { workOrders } = workOrderData;

  // Filter work orders based on search term
  const filteredWorkOrders = searchTerm.trim() === '' 
    ? workOrders
    : workOrders.filter((wo: WorkOrder) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          wo.id.toLowerCase().includes(searchLower) ||
          wo.customer.name.toLowerCase().includes(searchLower) ||
          wo.customer.storeNumber.toLowerCase().includes(searchLower) ||
          wo.customer.address.street.toLowerCase().includes(searchLower)
        );
      });

  // Update URL when work order is selected
  useEffect(() => {
    if (selectedWorkOrder && selectedWorkOrder.visits?.nextVisit?.url) {
      const baseUrl = "https://app.workfossa.com";
      const fullUrl = baseUrl + selectedWorkOrder.visits.nextVisit.url;
      setVisitUrl(fullUrl);
    }
  }, [selectedWorkOrder]);

  // Poll for batch job status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (polling && batchJobId) {
      interval = setInterval(async () => {
        try {
          const statusData = await getBatchAutomationStatus();
          
          // Update the job with latest status
          setBatchJobs(prev => 
            prev.map(job => {
              if (job.status === 'running') {
                return { 
                  ...job,
                  status: statusData.status,
                  totalVisits: statusData.totalVisits,
                  completedVisits: statusData.completedVisits,
                  message: statusData.message
                };
              }
              return job;
            })
          );
          
          // Update status message
          if (statusData.message) {
            setStatusMessage(statusData.message);
          }
          
          // Stop polling when job is no longer running
          if (statusData.status !== 'running') {
            setPolling(null);
            setBatchJobId(null);
          }
        } catch (error) {
          console.error('Error polling for batch job status:', error);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [polling, batchJobId]);

  // Poll for single job status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (pollingSingle && singleJobId) {
      interval = setInterval(async () => {
        try {
          const statusData = await getFormAutomationStatus();
          
          // Update the job with latest status
          setFormJobs(prev => 
            prev.map(job => {
              if (job.status === 'running') {
                return { 
                  ...job,
                  status: statusData.status,
                  message: statusData.message
                };
              }
              return job;
            })
          );
          
          // Update status message and show toast
          if (statusData.message) {
            setStatusMessage(statusData.message);
            addToast('info', statusData.message);
          }
          
          // Stop polling when job is no longer running
          if (statusData.status !== 'running') {
            setPollingSingle(false);
            setSingleJobId(null);
            if (statusData.status === 'completed') {
              addToast('success', "Visit processing completed successfully");
            }
          }
        } catch (error) {
          console.error('Error polling for single job status:', error);
          addToast('error', `Error checking visit status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [pollingSingle, singleJobId]);

  const handleSingleVisit = async () => {
    if (!visitUrl.includes('workfossa.com') || !visitUrl.includes('/visits/')) {
      setStatusMessage('Error: Please enter a valid Fossa visit URL');
      addToast('error', 'Please enter a valid Fossa visit URL');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Processing visit...');
    addToast('info', "Starting visit processing...");
    
    const newJob: FormJob = {
      url: visitUrl,
      status: 'running',
      timestamp: new Date().toISOString(),
      headless: isHeadless
    };
    
    setFormJobs(prev => [newJob, ...prev]);
    
    try {
      // Use the form service to process the visit
      const result = await processSingleVisit(
        visitUrl, 
        isHeadless, 
        selectedWorkOrder?.id
      );
      
      // Start polling for updates
      setPollingSingle(true);
      setSingleJobId(result.jobId || new Date().getTime().toString());
      
      setStatusMessage(result.message || 'Visit processing started');
      addToast('success', "Visit processing started successfully");
      setVisitUrl('');
      setSelectedWorkOrder(null);
    } catch (error: any) {
      setFormJobs(prev => 
        prev.map(job => 
          job.url === newJob.url 
            ? { ...job, status: 'error', message: `Error: ${error.message}` } 
            : job
        )
      );
      setStatusMessage(`Error: ${error.message}`);
      addToast('error', `Error processing visit: ${error.message}`);
      setPollingSingle(false);
      setSingleJobId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchProcess = async () => {
    if (isProcessing) return;

    // Create a new batch job with timestamp that we'll reference throughout the function
    const jobTimestamp = new Date().toISOString();
    const newJob: BatchJob = {
      filePath: batchFilePath,
      timestamp: jobTimestamp,
      status: 'running',
      message: 'Processing...',
      totalVisits: 0,
      completedVisits: 0,
      headless: isHeadless
    };

    try {
      setIsProcessing(true);
      addToast('info', "Starting batch processing...");

      setBatchJobs(prev => [newJob, ...prev]);

      // Use the form service to process the batch
      const data = await processBatchVisits(batchFilePath, isHeadless);
      
      setBatchJobId(data.jobId);
      addToast('success', "Batch processing started successfully");

      // Start polling for status updates
      const pollInterval = setInterval(async () => {
        try {
          const statusData = await getBatchAutomationStatus();
          
          setBatchJobs(prev => 
            prev.map(job => 
              job.filePath === batchFilePath && job.timestamp === jobTimestamp
                ? { 
                    ...job, 
                    status: statusData.status,
                    message: statusData.message || job.message,
                    totalVisits: statusData.totalVisits || job.totalVisits,
                    completedVisits: statusData.completedVisits || job.completedVisits
                  }
                : job
            )
          );

          if (statusData.status === 'completed') {
            addToast('success', "Batch processing completed successfully");
            clearInterval(pollInterval);
            setPolling(null);
            setBatchJobId(null);
            setIsProcessing(false);
          } else if (statusData.status === 'error') {
            addToast('error', `Batch processing error: ${statusData.message}`);
            clearInterval(pollInterval);
            setPolling(null);
            setBatchJobId(null);
            setIsProcessing(false);
          }

        } catch (error) {
          console.error('Error polling status:', error);
          addToast('error', `Error checking batch status: ${error instanceof Error ? error.message : 'Unknown error'}`);
          clearInterval(pollInterval);
          setPolling(null);
          setBatchJobId(null);
          setIsProcessing(false);
        }
      }, 2000);

      setPolling(pollInterval);

    } catch (error) {
      console.error('Batch process error:', error);
      setBatchJobs(prev => 
        prev.map(job => 
          job.filePath === batchFilePath && job.timestamp === jobTimestamp
            ? { ...job, status: 'error', message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` } 
            : job
        )
      );
      addToast('error', `Error starting batch process: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPolling(null);
      setBatchJobId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: 'idle' | 'running' | 'completed' | 'error') => {
    switch (status) {
      case 'running':
        return <div className="animate-spin h-5 w-5 border-2 border-primary-500 rounded-full border-t-transparent"></div>;
      case 'completed':
        return <FiCheck className="text-green-500" />;
      case 'error':
        return <FiX className="text-red-500" />;
      default:
        return null;
    }
  };

  // Format date as MM/DD/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return dateStr;
  };

  // Get store type icon
  const getStoreIcon = (storeName: string) => {
    const name = storeName.toLowerCase();
    if (name.includes('7-eleven')) {
      return "🏪"; // Convenience store
    } else if (name.includes('circle k')) {
      return "⛽"; // Gas station
    } else if (name.includes('wawa')) {
      return "🛒"; // Shopping
    } else {
      return "🏢"; // Default building
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Form Prep</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Automate the process of adding AccuMeasure forms to Fossa visits and filling them with dispenser information.
        </p>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            <button 
              onClick={() => setActiveTab('single')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'single' 
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FiExternalLink className="mr-2" />
                Single Visit
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('batch')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'batch' 
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FiFileText className="mr-2" />
                Batch Processing
              </div>
            </button>
          </nav>
        </div>

        {/* Single Visit Tab */}
        {activeTab === 'single' && (
          <div className="space-y-6">
            {/* Work Order Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Work Order
              </label>
              <div className="relative">
                <div 
                  className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md cursor-pointer"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <div className="flex-1 min-w-0">
                    {selectedWorkOrder ? (
                      <div className="flex items-center space-x-2">
                        <span>{getStoreIcon(selectedWorkOrder.customer.name)}</span>
                        <span className="font-medium">{selectedWorkOrder.id}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {selectedWorkOrder.customer.name} {selectedWorkOrder.customer.storeNumber}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          ({selectedWorkOrder.visits.nextVisit.date})
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Select a work order...</span>
                    )}
                  </div>
                  <FiChevronDown className="h-5 w-5 text-gray-400" />
                </div>

                {showDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-300 dark:border-gray-600 max-h-60 overflow-auto">
                    <div className="p-2 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search work orders..."
                          className="w-full py-2 pl-10 pr-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <ul className="py-1">
                      {filteredWorkOrders.length > 0 ? (
                        filteredWorkOrders.map((order: WorkOrder) => (
                          <li
                            key={order.id}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              setSelectedWorkOrder(order);
                              setShowDropdown(false);
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <span>{getStoreIcon(order.customer.name)}</span>
                              <span className="font-medium">{order.id}</span>
                              <span className="text-gray-500 dark:text-gray-400">
                                {order.customer.name} {order.customer.storeNumber}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-sm">
                                {formatDate(order.visits.nextVisit.date)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {order.customer.address.street}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-2 text-gray-500 dark:text-gray-400">
                          No work orders found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              
              {selectedWorkOrder && selectedWorkOrder.dispensers && (
                <div className="mt-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Dispensers: {selectedWorkOrder.dispensers.length}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedWorkOrder.dispensers.slice(0, 4).map((dispenser, idx) => (
                      <div key={idx} className="text-xs text-gray-600 dark:text-gray-300">
                        {dispenser.title}
                      </div>
                    ))}
                    {selectedWorkOrder.dispensers.length > 4 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{selectedWorkOrder.dispensers.length - 4} more dispensers
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Manual URL Entry */}
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="visitUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fossa Visit URL
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="visitUrl"
                    value={visitUrl}
                    onChange={(e) => setVisitUrl(e.target.value)}
                    placeholder="https://app.workfossa.com/app/work/123456/visits/123456/"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    disabled={isProcessing}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  URL will be automatically filled when you select a work order above, or you can enter it manually
                </p>
              </div>
            </div>

            {/* Headless Mode Toggle */}
            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isHeadless}
                  onChange={() => setIsHeadless(!isHeadless)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                  <FiEye className="mr-1" />
                  Show browser during automation (debug mode)
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSingleVisit}
                disabled={isProcessing || !visitUrl}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FiPlay className="mr-2" />
                    Process Visit
                  </>
                )}
              </button>
            </div>

            {/* Recent Jobs */}
            {formJobs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Recent Jobs</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Visit URL
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Debug Mode
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                      {formJobs.map((job, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            <div className="flex items-center">
                              <span className="truncate max-w-xs">{job.url}</span>
                              <button 
                                className="ml-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                onClick={() => navigator.clipboard.writeText(job.url)}
                                title="Copy URL"
                              >
                                <FiClipboard size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            <div className="flex items-center">
                              <span className="mr-2">{getStatusIcon(job.status)}</span>
                              <span>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</span>
                            </div>
                            {job.message && (
                              <span className="text-xs mt-1 block text-gray-500 dark:text-gray-400">{job.message}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {job.headless === false ? 
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                <FiEye className="mr-1" /> Visible
                              </span> 
                              : 
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                Headless
                              </span>
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {job.timestamp && new Date(job.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batch Processing Tab */}
        {activeTab === 'batch' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="batchFilePath" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  JSON Data File Path
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="batchFilePath"
                    value={batchFilePath}
                    onChange={(e) => setBatchFilePath(e.target.value)}
                    placeholder="data/scraped_content.json"
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    disabled={isProcessing}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Path to JSON file containing work orders and visit data
                </p>
              </div>
            </div>

            {/* Headless Mode Toggle */}
            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isHeadless}
                  onChange={() => setIsHeadless(!isHeadless)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                  <FiEye className="mr-1" />
                  Show browser during automation (debug mode)
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleBatchProcess}
                disabled={isProcessing || !batchFilePath}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FiUpload className="mr-2" />
                    Process Batch
                  </>
                )}
              </button>
            </div>

            {/* Recent Batch Jobs */}
            {batchJobs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Recent Batch Jobs</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          File Path
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Progress
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Debug Mode
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                      {batchJobs.map((job, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            <span className="truncate max-w-xs">{job.filePath}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {job.status === 'running' ? (
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                <div className="bg-primary-600 h-2.5 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                              </div>
                            ) : (
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${job.status === 'completed' ? 'bg-green-500' : job.status === 'error' ? 'bg-red-500' : 'bg-primary-600'}`} 
                                  style={{ width: job.totalVisits > 0 ? `${(job.completedVisits / job.totalVisits) * 100}%` : '0%' }}
                                ></div>
                              </div>
                            )}
                            <span className="text-xs mt-1 block">
                              {job.completedVisits} / {job.totalVisits} visits
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            <div className="flex items-center">
                              <span className="mr-2">{getStatusIcon(job.status)}</span>
                              <span>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</span>
                            </div>
                            {job.message && (
                              <span className="text-xs mt-1 block text-gray-500 dark:text-gray-400">{job.message}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {job.headless === false ? 
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                <FiEye className="mr-1" /> Visible
                              </span> 
                              : 
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                Headless
                              </span>
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {job.timestamp && new Date(job.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Information Card */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <FiInfo className="h-6 w-6 text-primary-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">About Form Automation</h3>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-300">
              <p>These tools automate the process of adding AccuMeasure forms to Fossa visits and filling them out with dispenser information.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Single Visit: Process one visit at a time by selecting a work order or providing the visit URL</li>
                <li>Batch Processing: Process multiple visits from a JSON data file</li>
              </ul>
              <p className="mt-2">Make sure you have your Fossa credentials configured in the .env file.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2 px-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Status: {statusMessage}
        </div>
      </div>
    </div>
  );
};

export default FormPrep; 
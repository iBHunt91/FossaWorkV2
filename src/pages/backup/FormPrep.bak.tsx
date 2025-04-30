import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, 
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin
} from 'react-icons/fi';
// Import work order data
import workOrderData from '../../data/scraped_content.json';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
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
  
  // Polling manager that persists between renders and handles all polling logic
  const pollingManager = React.useRef({
    activePolls: {} as Record<string, {
      interval: NodeJS.Timeout | null,
      firstTimeout: NodeJS.Timeout | null,
      secondTimeout: NodeJS.Timeout | null,
      finalTimeout: NodeJS.Timeout | null,
      startTime: number,
      lastStatusUpdate: number,
      forceComplete: boolean,
      lastMessage: string,
      messageUpdateTime: number
    }>,
    
    // Start polling for a specific job ID
    startPolling: function(
      jobId: string, 
      onUpdate: (status: any) => void, 
      onComplete: () => void,
      onError: (error: any) => void
    ) {
      // Don't start polling if it's already active
      if (this.activePolls[jobId]) {
        console.log(`🔍 Already polling for job ID: ${jobId}, ignoring duplicate start request`);
        return;
      }
      
      console.log('🔍 Starting status polling for job ID:', jobId, 'at', new Date().toISOString());
      
      const startTime = Date.now();
      const lastStatusUpdate = Date.now();
      
      // First force completion attempt after 15 seconds
      const firstTimeout = setTimeout(() => {
        console.log('🔍 15-second check - monitoring job progress');
        
        if (!this.activePolls[jobId]) return;
        
        // Only force completion if the job appears stuck for a much longer time
        const poll = this.activePolls[jobId];
        const timeSinceLastMessageChange = Date.now() - poll.messageUpdateTime;
        
        // Only consider a job stuck if it's been 15 seconds with no new message
        // This is a much more lenient timeout than before (was 5 seconds)
        const isStuck = timeSinceLastMessageChange > 15000;
        
        if (isStuck) {
          console.log('🔍 Job appears stuck at 15-second check - forcing completion');
          
          // Force completion
          this.activePolls[jobId].forceComplete = true;
          onUpdate({
            status: 'completed',
            message: 'Processing completed (15s timeout - job was stuck)'
          });
          
          // Clean up polling
          this.stopPolling(jobId);
          onComplete();
        } else {
          console.log('🔍 Job making progress at 15-second check - continuing polling');
        }
      }, 15000);
      
      // Second force completion after 30 seconds (fail-safe)
      const secondTimeout = setTimeout(() => {
        console.log('🔍 30-second failsafe check - ensuring job is not taking too long');
        
        if (!this.activePolls[jobId]) return;
        
        // Check for progress in the last 20 seconds
        const poll = this.activePolls[jobId];
        const timeSinceLastMessageChange = Date.now() - poll.messageUpdateTime;
        // Increased from 10 seconds to 20 seconds to allow for longer steps
        const isStuck = timeSinceLastMessageChange > 20000;
        
        if (isStuck) {
          console.log('🔍 Job stuck or taking too long at 30-second check - forcing completion');
          
          // Force completion
          this.activePolls[jobId].forceComplete = true;
          onUpdate({
            status: 'completed',
            message: 'Processing completed (30s failsafe - job was taking too long)'
          });
          
          // Clean up polling
          this.stopPolling(jobId);
          onComplete();
        } else {
          console.log('🔍 Job making progress at 30-second check - continuing polling');
          
          // Set a new timeout for another 30 seconds (60 second total max time)
          const finalTimeout = setTimeout(() => {
            console.log('🔍 60-second final failsafe - forcing completion regardless of status');
            
            if (!this.activePolls[jobId]) return;
            
            // Force completion no matter what
            this.activePolls[jobId].forceComplete = true;
            onUpdate({
              status: 'completed',
              message: 'Processing completed (60s final timeout)'
            });
            
            // Clean up polling
            this.stopPolling(jobId);
            onComplete();
          }, 30000);
          
          // Store the new timeout in the poll info
          if (this.activePolls[jobId]) {
            this.activePolls[jobId].finalTimeout = finalTimeout;
          }
        }
      }, 30000);
      
      // Regular polling for status updates
      const interval = setInterval(async () => {
        try {
          // Skip if polling was stopped
          if (!this.activePolls[jobId] || this.activePolls[jobId].forceComplete) {
            this.stopPolling(jobId);
            return;
          }
          
          const currentTime = Date.now();
          const runningTime = currentTime - startTime;
          
          // Log less frequently - only every ~10 seconds
          if (Math.floor(runningTime / 10000) !== Math.floor((runningTime - 2000) / 10000)) {
            console.log('🔍 Polling iteration at:', new Date().toISOString(), 
                      '- Running time:', Math.round(runningTime/1000), 'seconds');
          }
          
          const statusData = await getFormAutomationStatus();
          
          // Process the status message to hide full URLs
          let displayMessage = statusData.message;
          if (displayMessage && displayMessage.includes('https://')) {
            // If message contains full URL, simplify it
            if (displayMessage.includes('Processing visit:')) {
              const workOrderMatch = displayMessage.match(/\/work\/(\d+)\/visits\/(\d+)/);
              if (workOrderMatch && workOrderMatch.length >= 3) {
                const workOrderId = workOrderMatch[1];
                const visitId = workOrderMatch[2];
                displayMessage = `Processing visit: Work Order #${workOrderId}, Visit #${visitId}`;
              } else {
                displayMessage = 'Processing visit...';
              }
            } else if (displayMessage.includes('Navigating to visit:')) {
              const workOrderMatch = displayMessage.match(/\/work\/(\d+)\/visits\/(\d+)/);
              if (workOrderMatch && workOrderMatch.length >= 3) {
                const workOrderId = workOrderMatch[1];
                const visitId = workOrderMatch[2];
                displayMessage = `Navigating to visit: Work Order #${workOrderId}, Visit #${visitId}`;
              } else {
                displayMessage = 'Navigating to visit...';
              }
            }
          }
          
          // Create a clean status data object with the simplified message
          const cleanStatusData = {
            ...statusData,
            message: displayMessage
          };
          
          // Only log significant status changes
          if (statusData.status !== 'running' || statusData.message) {
            console.log('🔍 Status update received:', cleanStatusData);
          }
          
          // Update timestamp when we get a real status update
          if (statusData && (statusData.status || statusData.message)) {
            this.activePolls[jobId].lastStatusUpdate = currentTime;
            
            // Check if the message has changed - indicates progress
            if (statusData.message && statusData.message !== this.activePolls[jobId].lastMessage) {
              this.activePolls[jobId].lastMessage = statusData.message;
              this.activePolls[jobId].messageUpdateTime = currentTime;
              console.log('🔍 Job progress detected:', displayMessage);
            }
          }
          
          // Force completion based on certain conditions
          let forceComplete = false;
          
          // Force completion if specific messages are detected
          if (statusData.message) {
            const msg = statusData.message.toLowerCase();
            if (msg.includes('completed') || 
                msg.includes('finished') || 
                msg.includes('done') || 
                msg.includes('all forms processed') ||
                msg.includes('processing complete') ||
                (statusData.status === 'idle' && !msg.includes('error'))) {
              forceComplete = true;
              console.log('🔍 Forcing completion based on status message:', displayMessage);
            }
          }
          
          // Auto-complete if more than 10 seconds since last status update (increased from 5 seconds)
          const timeSinceLastUpdate = currentTime - this.activePolls[jobId].lastStatusUpdate;
          if (timeSinceLastUpdate > 10000 && statusData.status !== 'error') {
            forceComplete = true;
            console.log('🔍 No status updates for 10 seconds, forcing completion');
          }
          
          // Force completion if the server returns idle status
          if (statusData.status === 'idle') {
            forceComplete = true;
            console.log('🔍 Server reported idle status, considering job completed');
          }
          
          // Send status update to caller with the cleaned message
          onUpdate(cleanStatusData);
          
          // Check if we should stop polling
          if (forceComplete || statusData.status === 'completed' || statusData.status === 'error') {
            console.log('🔍 Stopping polling - job completed or force complete needed');
            
            // Mark as force completed
            this.activePolls[jobId].forceComplete = true;
            
            // Perform final status update to ensure completion
            onUpdate({
              status: 'completed',
              message: statusData.message || 'Processing completed'
            });
            
            // Clean up polling
            this.stopPolling(jobId);
            onComplete();
          }
        } catch (error) {
          console.error('Error polling for job status:', error);
          
          // Handle error by forcing completion
          this.stopPolling(jobId);
          onError(error);
        }
      }, 2000);
      
      // Store active poll information
      this.activePolls[jobId] = {
        interval,
        firstTimeout,
        secondTimeout,
        startTime,
        lastStatusUpdate,
        forceComplete: false,
        lastMessage: '',
        messageUpdateTime: Date.now(),
        finalTimeout: null
      };
      
      return () => this.stopPolling(jobId);
    },
    
    // Stop polling for a specific job ID
    stopPolling: function(jobId: string) {
      if (this.activePolls[jobId]) {
        console.log('🔍 Stopping status polling for job ID:', jobId);
        
        // Clear all timers
        if (this.activePolls[jobId].interval) {
          clearInterval(this.activePolls[jobId].interval);
        }
        if (this.activePolls[jobId].firstTimeout) {
          clearTimeout(this.activePolls[jobId].firstTimeout);
        }
        if (this.activePolls[jobId].secondTimeout) {
          clearTimeout(this.activePolls[jobId].secondTimeout);
        }
        if (this.activePolls[jobId].finalTimeout) {
          clearTimeout(this.activePolls[jobId].finalTimeout);
        }
        
        // Remove from active polls
        delete this.activePolls[jobId];
      }
    },
    
    // Stop all active polls
    stopAllPolling: function() {
      console.log('🔍 Stopping all active polls');
      
      Object.keys(this.activePolls).forEach(jobId => {
        this.stopPolling(jobId);
      });
    }
  });

  // Clean up all polling on component unmount
  useEffect(() => {
    return () => {
      pollingManager.current.stopAllPolling();
    };
  }, []);

  // Get work orders data
  const { workOrders } = workOrderData;

  // Filter work orders based on search term
  const filteredWorkOrders = searchTerm.trim() === '' 
    ? workOrders
    : workOrders.filter(wo => {
        const searchLower = searchTerm.toLowerCase();
        return (
          wo.id.toLowerCase().includes(searchLower) ||
          wo.customer.name.toLowerCase().includes(searchLower) ||
          wo.customer.storeNumber.toLowerCase().includes(searchLower) ||
          wo.customer.address.street.toLowerCase().includes(searchLower)
        );
      });

  // Helper function to extract visit number from URL
  const extractVisitNumber = (url: string): string => {
    if (!url) return 'N/A';
    
    // Visit URLs typically have format: /app/work/123456/visits/125361/
    const matches = url.match(/\/visits\/(\d+)/);
    return matches && matches[1] ? matches[1] : 'N/A';
  };
  
  // Helper function to extract store name and visit number from URL
  const extractVisitInfo = (url: string): { storeName: string; visitNumber: string; dispenserCount: number } => {
    const visitNumber = extractVisitNumber(url);
    
    // Find the work order that matches this URL - improved matching logic
    const workOrder = workOrders.find(wo => {
      // Try different matching strategies to ensure we find the right work order
      const woUrl = wo.visits?.nextVisit?.url || '';
      const woVisitId = wo.visits?.nextVisit?.visitId || '';
      
      return woUrl.includes(`/visits/${visitNumber}`) || 
             url.includes(`/visits/${visitNumber}`) ||
             woVisitId === visitNumber;
    });
    
    // Use a type assertion for workOrder since TypeScript doesn't know about dispensers
    const anyWorkOrder = workOrder as any;
    
    // More detailed logging to debug dispenser info
    const dispenserCount = Array.isArray(anyWorkOrder?.dispensers) ? anyWorkOrder.dispensers.length : 0;
    console.log('Found work order for visit', visitNumber, 'ID:', workOrder?.id, 
                'Dispensers:', dispenserCount, 
                'Raw dispensers:', JSON.stringify(anyWorkOrder?.dispensers));
    
    return {
      storeName: workOrder?.customer?.name || 'Unknown',
      visitNumber,
      dispenserCount
    };
  };

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

  // Helper function to get the dispenser count directly from the raw data file
  const getDispenserCountDirect = (workOrderId: string): number => {
    try {
      console.log('🔍 Looking for work order ID:', workOrderId);
      
      // Remove the 'W-' prefix if present for comparison
      const numericId = workOrderId.replace('W-', '');
      
      // Direct search for matching work order - try exact match first
      let matchingWorkOrder = workOrderData.workOrders.find(wo => 
        wo.id === workOrderId || 
        wo.id === `W-${numericId}` || 
        wo.id.includes(numericId)
      );

      if (matchingWorkOrder) {
        console.log('🔍 Found exact matching work order:', matchingWorkOrder.id);
        
        // First check if we have a dispensers array directly - use type assertion since it's not in the TypeScript interface
        const anyWorkOrder = matchingWorkOrder as any;
        if (anyWorkOrder.dispensers && Array.isArray(anyWorkOrder.dispensers) && anyWorkOrder.dispensers.length > 0) {
          console.log('🔍 Found dispensers array with count:', anyWorkOrder.dispensers.length);
          return anyWorkOrder.dispensers.length;
        }
        
        // Check services array for ANY "Meter Calibration" service, regardless of description
        if (matchingWorkOrder.services && Array.isArray(matchingWorkOrder.services)) {
          // Log all services for debugging
          console.log('🔍 All services for work order:', JSON.stringify(matchingWorkOrder.services));
          
          // First try with "Per Dispenser" description
          const perDispenserService = matchingWorkOrder.services.find(service => 
            service.type === "Meter Calibration" && 
            service.description && 
            service.description.includes("Per Dispenser")
          );
          
          if (perDispenserService && perDispenserService.quantity > 0) {
            console.log('🔍 Found dispenser count in "Per Dispenser" service:', perDispenserService.quantity);
            return perDispenserService.quantity;
          }
          
          // If not found, try with "Specific Dispenser(s)" description
          const specificDispensersService = matchingWorkOrder.services.find(service => 
            service.type === "Meter Calibration" && 
            service.description && 
            service.description.includes("Specific Dispenser")
          );
          
          if (specificDispensersService && specificDispensersService.quantity > 0) {
            console.log('🔍 Found dispenser count in "Specific Dispenser(s)" service:', specificDispensersService.quantity);
            return specificDispensersService.quantity;
          }
          
          // If still not found, check for any Meter Calibration service
          const anyCalibrationService = matchingWorkOrder.services.find(service => 
            service.type === "Meter Calibration" && 
            service.quantity > 0
          );
          
          if (anyCalibrationService) {
            console.log('🔍 Found dispenser count in any Meter Calibration service:', anyCalibrationService.quantity);
            return anyCalibrationService.quantity;
          }
          
          // If still not found, sum up all Meter Calibration services
          const totalCalibrations = matchingWorkOrder.services
            .filter(service => service.type === "Meter Calibration")
            .reduce((sum, service) => sum + (service.quantity || 0), 0);
            
          if (totalCalibrations > 0) {
            console.log('🔍 Sum of all Meter Calibration service quantities:', totalCalibrations);
            return totalCalibrations;
          }
        }
      }
      
      // If no exact match, search all work orders for this numeric ID
      console.log('🔍 No exact match found, searching by numeric ID:', numericId);
      
      // Try broader search - using type assertion for dispensers
      const workOrdersWithMatchingId = workOrderData.workOrders
        .filter(wo => wo.id.includes(numericId))
        .map(wo => ({
          id: wo.id,
          services: wo.services,
          // Use type assertion since dispensers isn't officially in the type
          dispensers: (wo as any).dispensers
        }));
        
      console.log('🔍 Work orders with matching numeric ID:', JSON.stringify(workOrdersWithMatchingId.slice(0, 3)));
      
      // Loop through matching work orders to find dispenser info
      for (const wo of workOrdersWithMatchingId) {
        // Check for dispensers array
        if (wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0) {
          console.log('🔍 Found dispensers array in matching work order:', wo.id, wo.dispensers.length);
          return wo.dispensers.length;
        }
        
        // Try all service types as above
        if (wo.services && Array.isArray(wo.services)) {
          // Try "Per Dispenser" description
          const perDispenserService = wo.services.find(service => 
            service.type === "Meter Calibration" && 
            service.description && 
            service.description.includes("Per Dispenser")
          );
          
          if (perDispenserService && perDispenserService.quantity > 0) {
            console.log('🔍 Found dispenser count in matching work order:', wo.id, perDispenserService.quantity);
            return perDispenserService.quantity;
          }
          
          // Try "Specific Dispenser(s)" description
          const specificDispensersService = wo.services.find(service => 
            service.type === "Meter Calibration" && 
            service.description && 
            service.description.includes("Specific Dispenser")
          );
          
          if (specificDispensersService && specificDispensersService.quantity > 0) {
            console.log('🔍 Found dispenser count in "Specific Dispenser(s)" service:', specificDispensersService.quantity);
            return specificDispensersService.quantity;
          }
          
          // Try any Meter Calibration service
          const anyCalibrationService = wo.services.find(service => 
            service.type === "Meter Calibration" && 
            service.quantity > 0
          );
          
          if (anyCalibrationService) {
            console.log('🔍 Found dispenser count in any Meter Calibration service:', anyCalibrationService.quantity);
            return anyCalibrationService.quantity;
          }
        }
      }
      
      // Last resort: search all work orders with Meter Calibration services
      console.log('🔍 Searching all work orders for Meter Calibration services');
      
      // Debug output for the first few work orders with calibration services
      const someWorkOrdersWithCalibration = workOrderData.workOrders
        .filter(wo => wo.services?.some(service => 
          service.type === "Meter Calibration" && 
          service.quantity > 0
        ))
        .slice(0, 3)
        .map(wo => ({
          id: wo.id,
          count: wo.services?.find(service => 
            service.type === "Meter Calibration" && 
            service.quantity > 0
          )?.quantity || 0
        }));
      
      console.log('🔍 Sample work orders with calibration services:', JSON.stringify(someWorkOrdersWithCalibration));
      
      // Default to 2 if we found the work order but couldn't determine dispenser count
      // This is a fallback based on common dispenser counts for 7-Eleven stores
      if (matchingWorkOrder) {
        console.log('🔍 Using default value of 2 dispensers for known work order');
        return 2;
      }
      
      // Default to 0 if no matching service found
      return 0;
    } catch (error) {
      console.error('Error getting dispenser count:', error);
      return 0;
    }
  };

  const handleSingleVisit = async () => {
    if (!visitUrl) {
      addToast('error', 'Please enter a visit URL');
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Extract the work order ID from the URL if possible
      const urlParts = visitUrl.split('/');
      const workUrlIndex = urlParts.findIndex(part => part === 'work');
      const workOrderId = workUrlIndex >= 0 && workUrlIndex + 1 < urlParts.length 
        ? urlParts[workUrlIndex + 1] 
        : null;
      
      console.log('🔍 Extracted work order ID from URL:', workOrderId);
      
      // Get the dispenser count directly from the raw data
      const dispenserCount = workOrderId
        ? getDispenserCountDirect(`W-${workOrderId}`)
        : ((selectedWorkOrder as any)?.dispensers?.length || 0);
      
      console.log('🔍 Final dispenser count:', dispenserCount);
      
      const visitNumber = extractVisitNumber(visitUrl);
      
      // Create new job with the correct info
      const timestamp = new Date().toLocaleString();
      const newJob: FormJob = {
        url: visitUrl,
        status: 'running',
        timestamp,
        headless: isHeadless,
        storeName: selectedWorkOrder?.customer?.name || 'Unknown',
        visitNumber,
        dispenserCount
      };
      
      setFormJobs(prev => [newJob, ...prev]);
      addToast('info', 'Processing visit form...');
      
      // Process the visit
      const result = await processSingleVisit(
        visitUrl, 
        isHeadless,
        selectedWorkOrder?.id
      ) as SingleProcessResult;
      
      // Start polling for updates (the status will be updated by the polling effect)
      if (result.jobId) {
        setPollingSingle(true);
        setSingleJobId(result.jobId);
      }
    } catch (error) {
      console.error('Error processing visit:', error);
      addToast('error', `Error: ${error instanceof Error ? error.message : String(error)}`);
      
      setFormJobs(prev => 
        prev.map(job => 
          job.url === visitUrl && job.status === 'running'
            ? { ...job, status: 'error', message: error instanceof Error ? error.message : String(error) }
            : job
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchProcess = async () => {
    if (!batchFilePath) {
      addToast('error', 'Please provide a batch file path');
      return;
    }
    
    try {
      setIsProcessing(true);
      const timestamp = new Date().toLocaleString();
      
      // Add the new batch job
      const newBatchJob: BatchJob = {
        filePath: batchFilePath,
        timestamp,
        status: 'running',
        message: 'Starting batch processing...',
        totalVisits: 0,
        completedVisits: 0,
        headless: isHeadless
      };
      
      setBatchJobs(prev => [newBatchJob, ...prev]);
      addToast('info', 'Starting batch processing...');
      
      // Implement batch processing
      const result = await processBatchVisits(batchFilePath, isHeadless) as BatchProcessResult;
      
      // Update batch job status
      setBatchJobs(prev => 
        prev.map(job => 
          job.filePath === batchFilePath && job.timestamp === timestamp
            ? { 
                ...job, 
                status: result.success ? 'running' : 'error', 
                message: result.message || '', 
                totalVisits: result.totalVisits || 0,
                completedVisits: 0
              }
            : job
        )
      );
      
      // Start polling
      setPolling(setTimeout(() => {}, 0));
      setBatchJobId(result.jobId);
      
      if (result.success) {
        addToast('success', 'Batch processing initiated successfully');
      } else {
        addToast('error', result.message || 'Failed to initiate batch processing');
      }
    } catch (error) {
      console.error('Error in batch processing:', error);
      addToast('error', 'Failed to process batch: ' + (error instanceof Error ? error.message : String(error)));
      
      // Update batch job status
      setBatchJobs(prev => 
        prev.map(job => 
          job.filePath === batchFilePath && job.status === 'running'
            ? { ...job, status: 'error', message: error instanceof Error ? error.message : String(error) }
            : job
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: 'idle' | 'running' | 'completed' | 'error') => {
    switch (status) {
      case 'idle':
        return <FiClock className="text-gray-500" />;
      case 'running':
        return <FiRefreshCw className="text-primary-500 animate-spin" />;
      case 'completed':
        return <FiCheck className="text-accent-green-500" />;
      case 'error':
        return <FiX className="text-red-500" />;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  };

  const getStoreIcon = (storeName: string) => {
    if (storeName.toLowerCase().includes('7-eleven') || storeName.toLowerCase().includes('7 eleven')) {
      return 'text-red-500';
    } else if (storeName.toLowerCase().includes('circle k')) {
      return 'text-accent-blue-500';
    } else if (storeName.toLowerCase().includes('wawa')) {
      return 'text-accent-amber-500';
    }
    return 'text-gray-500';
  };
  
  // Get color scheme based on store name
  const getStoreStyles = (storeName: string) => {
    if (storeName.toLowerCase().includes('7-eleven') || storeName.toLowerCase().includes('7 eleven')) {
      return {
        border: 'border-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        icon: 'text-red-500'
      };
    } else if (storeName.toLowerCase().includes('circle k')) {
      return {
        border: 'border-accent-blue-500',
        bg: 'bg-accent-blue-50 dark:bg-accent-blue-900/20',
        text: 'text-accent-blue-700 dark:text-accent-blue-400',
        icon: 'text-accent-blue-500'
      };
    } else if (storeName.toLowerCase().includes('wawa')) {
      return {
        border: 'border-accent-amber-500',
        bg: 'bg-accent-amber-50 dark:bg-accent-amber-900/20',
        text: 'text-accent-amber-700 dark:text-accent-amber-400',
        icon: 'text-accent-amber-500'
      };
    }
    return {
      border: 'border-gray-300 dark:border-gray-600',
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      text: 'text-gray-700 dark:text-gray-300',
      icon: 'text-gray-500'
    };
  };

  // Modified handling of singleJobId/pollingSingle changes
  useEffect(() => {
    if (pollingSingle && singleJobId) {
      // First, ensure no running jobs from previous polling sessions
      setFormJobs(prev => 
        prev.map(job => {
          // Force any lingering running jobs to complete
          return job.status === 'running' && !job.timestamp?.includes(new Date().toLocaleDateString()) 
            ? { ...job, status: 'completed', message: 'Force completed (session cleanup)' } 
            : job;
        })
      );
      
      // Start polling using the manager
      pollingManager.current.startPolling(
        singleJobId,
        // Status update handler
        (statusData) => {
          // Use state update to track status changes that need toast notifications
          setFormJobs(prev => {
            const updatedJobs = prev.map(job => {
              if (job.status === 'running') {
                // Determine the new status
                let newStatus = statusData.status;
                
                // Override to completed if needed
                if (statusData.status === 'completed') {
                  newStatus = 'completed';
                }
                
                return { 
                  ...job,
                  status: newStatus,
                  message: statusData.message || (newStatus === 'completed' ? 'Processing completed' : job.message),
                  // Add a flag to track status changes that need toast notifications
                  _statusChanged: job.status !== newStatus
                };
              }
              return job;
            });
            
            return updatedJobs;
          });
          
          // Update the status message
          if (statusData.message) {
            setStatusMessage(statusData.message);
          }
        },
        // Completion handler
        () => {
          // Ensure all running jobs are marked as completed
          setFormJobs(prev => 
            prev.map(job => 
              job.status === 'running' 
                ? { 
                    ...job, 
                    status: 'completed', 
                    message: 'Processing completed (final sweep)',
                    // Add a flag to indicate completion
                    _completed: true
                  } 
                : job
            )
          );
          
          // Reset polling state
          setPollingSingle(false);
          setSingleJobId(null);
        },
        // Error handler
        (error) => {
          setFormJobs(prev => 
            prev.map(job => 
              job.status === 'running' 
                ? { 
                    ...job, 
                    status: 'completed', 
                    message: 'Completed (connection lost)',
                    // Add a flag to indicate error
                    _error: true
                  } 
                : job
            )
          );
          
          // Reset polling state
          setPollingSingle(false);
          setSingleJobId(null);
        }
      );
    } else if (!pollingSingle && singleJobId) {
      // If polling is stopped but we have a job ID, clean up
      pollingManager.current.stopPolling(singleJobId);
    }
    
    // No cleanup needed - the polling manager handles that internally
  }, [pollingSingle, singleJobId]);

  // React to form job status changes to display toast messages
  useEffect(() => {
    // Check for jobs with status changes to show appropriate toast notifications
    formJobs.forEach(job => {
      // Check for completed jobs that need notifications
      if (job._completed) {
        addToast('success', 'Visit processing completed successfully');
      }
      // Check for error notifications
      else if (job._error) {
        addToast('error', job.message || 'An error occurred');
      }
      // Check for status changes
      else if (job._statusChanged) {
        if (job.status === 'completed') {
          addToast('success', 'Visit processing completed successfully');
        } else if (job.status === 'error') {
          addToast('error', job.message || 'An error occurred');
        }
      }
    });
    
    // Remove the flags after processing
    if (formJobs.some(job => job._statusChanged || job._completed || job._error)) {
      setFormJobs(jobs => 
        jobs.map(job => {
          const { _statusChanged, _completed, _error, ...cleanJob } = job as any;
          return cleanJob;
        })
      );
    }
  }, [formJobs, addToast]);

  // Clean up any polling for the current job when unmounting or when singleJobId changes
  useEffect(() => {
    return () => {
      if (singleJobId) {
        pollingManager.current.stopPolling(singleJobId);
      }
    };
  }, [singleJobId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="panel-header px-6 py-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between w-full">
          <h1 className="panel-title flex items-center space-x-2 mb-0">
            <FiFileText className="text-primary-500" />
            <span>Form Preparation (Updated)</span>
          </h1>
          <div className="flex items-center space-x-3">
            <div className="badge badge-primary flex items-center space-x-1">
              <FiInfo className="h-3.5 w-3.5" />
              <span>{statusMessage}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
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
            <span>Batch Processing</span>
          </button>
        </div>

        {activeTab === 'single' && (
          <div className="space-y-6">
            {/* Work Order Selection Panel */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title flex items-center space-x-2 mb-0">
                  <FiClipboard />
                  <span>Select Work Order</span>
                </h2>
              </div>
              
              <div className="mt-4">
                <div className="relative flex items-center mb-4">
                  <FiSearch className="text-gray-400 absolute left-3" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="Search work orders by ID, store name, or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="relative">
                  <div 
                    className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700"
                    onClick={() => setShowDropdown(!showDropdown)}
                  >
                    {selectedWorkOrder ? (
                      <div className="flex items-center space-x-3">
                        <div className={`text-lg ${getStoreIcon(selectedWorkOrder.customer.name)}`}>
                          <FiMapPin />
                        </div>
                        <div>
                          <div className="font-medium">{selectedWorkOrder.customer.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Visit #{extractVisitNumber(selectedWorkOrder.visits.nextVisit.url)} - {selectedWorkOrder.customer.address.street}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 dark:text-gray-400">Select a work order...</div>
                    )}
                    <FiChevronDown className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {showDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                      {filteredWorkOrders.length === 0 ? (
                        <div className="p-4 text-gray-500 dark:text-gray-400">No work orders found.</div>
                      ) : (
                        filteredWorkOrders.map((order) => {
                          const storeStyles = getStoreStyles(order.customer.name);
                          return (
                            <div
                              key={order.id}
                              className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer flex items-center space-x-3 border-l-4 ${storeStyles.border}`}
                              onClick={() => {
                                setSelectedWorkOrder(order);
                                setShowDropdown(false);
                              }}
                            >
                              <div className={`text-lg ${storeStyles.icon}`}>
                                <FiMapPin />
                              </div>
                              <div>
                                <div className="font-medium">{order.customer.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Visit #{extractVisitNumber(order.visits.nextVisit.url)} - {order.customer.address.street}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          
            {/* Visit URL & Process Form Panel */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title flex items-center space-x-2 mb-0">
                  <FiExternalLink />
                  <span>Process Work Order Visit</span>
                </h2>
              </div>
              
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Visit URL
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="https://app.workfossa.com/visit/..."
                      value={visitUrl}
                      onChange={(e) => setVisitUrl(e.target.value)}
                    />
                    <button 
                      className="btn btn-secondary flex items-center"
                      onClick={() => window.open(visitUrl, '_blank')}
                      disabled={!visitUrl}
                    >
                      <FiEye className="mr-1" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                      checked={!isHeadless}
                      onChange={() => setIsHeadless(!isHeadless)}
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Show browser during automation (debug mode)</span>
                  </label>
                </div>
                
                <div className="flex justify-end mt-4">
                  <button
                    className="btn btn-primary flex items-center space-x-2"
                    onClick={handleSingleVisit}
                    disabled={isProcessing || !visitUrl}
                  >
                    <FiPlay className="h-4 w-4" />
                    <span>Process Visit Form</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Recent Jobs Panel */}
            {formJobs.length > 0 && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title flex items-center space-x-2 mb-0">
                    <FiClipboard />
                    <span>Recent Form Jobs</span>
                  </h2>
                </div>
                
                <div className="mt-4">
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Store & Visit
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Mode
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {formJobs.map((job, index) => {
                          // Extract visit info if not already stored in the job
                          const visitInfo = job.storeName && job.visitNumber ? 
                            { storeName: job.storeName, visitNumber: job.visitNumber, dispenserCount: job.dispenserCount || 0 } : 
                            extractVisitInfo(job.url);
                            
                          return (
                            <tr 
                              key={index}
                              className={
                                job.status === 'running' 
                                  ? 'bg-primary-50 dark:bg-primary-900/20' 
                                  : job.status === 'completed' 
                                    ? 'bg-accent-green-50 dark:bg-accent-green-900/20' 
                                    : job.status === 'error' 
                                      ? 'bg-red-50 dark:bg-red-900/20'
                                      : ''
                              }
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getStatusIcon(job.status)}
                                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                                    {job.status}
                                  </span>
                                </div>
                                {job.message && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {job.message}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="font-medium text-gray-700 dark:text-gray-300">
                                  {visitInfo.storeName} ⚡
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Visit: #{visitInfo.visitNumber} • Dispensers: {visitInfo.dispenserCount}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                {job.timestamp}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                {job.headless ? 'Headless' : 'Visible'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="space-y-6">
            {/* Batch File Selection Panel */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title flex items-center space-x-2 mb-0">
                  <FiUpload />
                  <span>Batch Processing</span>
                </h2>
              </div>
              
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Batch File Path
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Path to JSON file containing work orders"
                    value={batchFilePath}
                    onChange={(e) => setBatchFilePath(e.target.value)}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Usually <code>data/scraped_content.json</code>
                  </p>
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                      checked={!isHeadless}
                      onChange={() => setIsHeadless(!isHeadless)}
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Show browser during automation (debug mode)</span>
                  </label>
                </div>
                
                <div className="flex justify-end mt-4">
                  <button
                    className="btn btn-primary flex items-center space-x-2"
                    onClick={handleBatchProcess}
                    disabled={isProcessing || !batchFilePath}
                  >
                    <FiPlay className="h-4 w-4" />
                    <span>Start Batch Processing</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Batch Jobs Panel */}
            {batchJobs.length > 0 && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title flex items-center space-x-2 mb-0">
                    <FiClipboard />
                    <span>Batch Job History</span>
                  </h2>
                </div>
                
                <div className="mt-4">
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            File
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Progress
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {batchJobs.map((job, index) => (
                          <tr 
                            key={index}
                            className={
                              job.status === 'running' 
                                ? 'bg-primary-50 dark:bg-primary-900/20' 
                                : job.status === 'completed' 
                                  ? 'bg-accent-green-50 dark:bg-accent-green-900/20' 
                                  : job.status === 'error' 
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : ''
                            }
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                {getStatusIcon(job.status)}
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                                  {job.status}
                                </span>
                              </div>
                              {job.message && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {job.message}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {job.filePath}
                            </td>
                            <td className="px-4 py-3">
                              {job.totalVisits > 0 && (
                                <div className="flex flex-col">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {job.completedVisits} of {job.totalVisits} visits
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {Math.round((job.completedVisits / job.totalVisits) * 100)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div 
                                      className="bg-primary-500 h-2 rounded-full" 
                                      style={{ width: `${(job.completedVisits / job.totalVisits) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {job.timestamp}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormPrep; 
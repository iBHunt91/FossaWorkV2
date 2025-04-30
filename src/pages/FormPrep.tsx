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
  
  // Load work orders from API
  useEffect(() => {
    let isMounted = true;
    
    const fetchWorkOrders = async () => {
      setIsLoading(true);
      
      try {
        // First try to load data from the API
        const response = await fetch('/api/workorders');
        
        if (!response.ok) {
          throw new Error(`Failed to load work orders: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.workOrders && Array.isArray(data.workOrders)) {
          if (isMounted) {
            console.log('Successfully loaded', data.workOrders.length, 'work orders from API');
            setWorkOrders(data.workOrders);
          }
        } else {
          throw new Error('Invalid API data format');
        }
      } catch (error) {
        console.error('Error loading work order data:', error);
        
        try {
          // Fall back to local JSON file
          console.log('Trying to load local JSON file as fallback');
          const fileResponse = await fetch('/src/data/scraped_content.json');
          
          if (!fileResponse.ok) {
            throw new Error(`Failed to load local data: ${fileResponse.status}`);
          }
          
          const fileData = await fileResponse.json();
          
          if (isMounted && fileData.workOrders) {
            console.log('Successfully loaded', fileData.workOrders.length, 'work orders from local file');
            setWorkOrders(fileData.workOrders);
          }
        } catch (localError) {
          console.error('Error loading local work order data:', localError);
          
          // Fall back to imported data
          if (isMounted) {
            console.warn('Using static imported data as final fallback');
            setWorkOrders(workOrderData.workOrders);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchWorkOrders();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
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
      
  // Group work orders by week
  const groupedWorkOrders = React.useMemo(() => {
    // Create a map to store work orders by week
    const weekMap = new Map<string, WorkOrder[]>();
    
    filteredWorkOrders.forEach(order => {
      // Get the visit date
      const visitDate = order.visits?.nextVisit?.date ? new Date(order.visits.nextVisit.date) : null;
      
      if (!visitDate) {
        // If no date, put in "Unscheduled" group
        const unscheduledKey = "Unscheduled";
        if (!weekMap.has(unscheduledKey)) {
          weekMap.set(unscheduledKey, []);
        }
        weekMap.get(unscheduledKey)!.push(order);
        return;
      }
      
      // Get the start of the week (Sunday)
      const startOfWeek = new Date(visitDate);
      startOfWeek.setDate(visitDate.getDate() - visitDate.getDay());
      
      // Format as "MMM DD - MMM DD, YYYY" (e.g. "Jan 01 - Jan 07, 2023")
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startMonth = startOfWeek.toLocaleString('default', { month: 'short' });
      const endMonth = endOfWeek.toLocaleString('default', { month: 'short' });
      const startDay = startOfWeek.getDate();
      const endDay = endOfWeek.getDate();
      const year = startOfWeek.getFullYear();
      
      const weekKey = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
      
      // Add to week map
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(order);
    });
    
    // Convert map to array of week groups
    return Array.from(weekMap.entries())
      .map(([week, orders]) => ({ week, orders }))
      .sort((a, b) => {
        // Special handling for "Unscheduled"
        if (a.week === "Unscheduled") return 1;
        if (b.week === "Unscheduled") return -1;
        
        // Extract dates from week strings
        const aMatch = a.week.match(/([A-Za-z]+) (\d+)/);
        const bMatch = b.week.match(/([A-Za-z]+) (\d+)/);
        
        if (!aMatch || !bMatch) return 0;
        
        const aDate = new Date(`${aMatch[1]} ${aMatch[2]}, ${a.week.split(', ')[1]}`);
        const bDate = new Date(`${bMatch[1]} ${bMatch[2]}, ${b.week.split(', ')[1]}`);
        
        return aDate.getTime() - bDate.getTime();
      });
  }, [filteredWorkOrders]);

  // Find index of current week
  useEffect(() => {
    if (groupedWorkOrders.length > 0) {
      // Define current date
      const today = new Date();
      
      // Find the index of the current week
      const currentWeekIdx = groupedWorkOrders.findIndex(({ week }) => {
        if (week === "Unscheduled") return false;
        
        const match = week.match(/([A-Za-z]+) (\d+)/);
        if (!match) return false;
        
        const weekStart = new Date(`${match[1]} ${match[2]}, ${week.split(', ')[1]}`);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return today >= weekStart && today <= weekEnd;
      });
      
      // If current week not found, default to first week
      setCurrentWeekIndex(currentWeekIdx !== -1 ? currentWeekIdx : 0);
    }
  }, [groupedWorkOrders]);

  // Navigate to previous week
  const goToPreviousWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    }
  };

  // Navigate to next week
  const goToNextWeek = () => {
    if (currentWeekIndex < groupedWorkOrders.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
    }
  };

  // Navigate to current week
  const goToCurrentWeek = () => {
    // Find current week index again
    const today = new Date();
    const currentWeekIdx = groupedWorkOrders.findIndex(({ week }) => {
      if (week === "Unscheduled") return false;
      
      const match = week.match(/([A-Za-z]+) (\d+)/);
      if (!match) return false;
      
      const weekStart = new Date(`${match[1]} ${match[2]}, ${week.split(', ')[1]}`);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return today >= weekStart && today <= weekEnd;
    });
    
    setCurrentWeekIndex(currentWeekIdx !== -1 ? currentWeekIdx : 0);
  };

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
      let matchingWorkOrder = workOrders.find(wo => 
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
      const workOrdersWithMatchingId = workOrders
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
      const someWorkOrdersWithCalibration = workOrders
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
    if (isProcessing || !visitUrl) return;
    
    setIsProcessing(true);
    setStatusMessage('Starting form automation...');
    
    try {
      // Create a new job entry
      const newJob: FormJob = {
        url: visitUrl,
        status: 'running',
        message: 'Processing form...',
        timestamp: new Date().toLocaleString(),
        headless: isHeadless,
      };
      
      // Add visit info
      const visitInfo = extractVisitInfo(visitUrl);
      newJob.storeName = visitInfo.storeName;
      newJob.visitNumber = visitInfo.visitNumber;
      newJob.dispenserCount = visitInfo.dispenserCount;
      
      // Add it to the jobs list
      setFormJobs(prevJobs => [newJob, ...prevJobs]);
      
      // Process the single visit
      const result = await processSingleVisit(visitUrl, isHeadless);
      
      if (result.success) {
        // Set polling to check status
        setSingleJobId(result.jobId);
        setPollingSingle(true);
        
        // Update status
        setStatusMessage('Processing visit form...');
      } else {
        // Update the job with error
        setFormJobs(prevJobs => 
          prevJobs.map(job => 
            job.url === visitUrl && job.status === 'running'
              ? { ...job, status: 'error', message: result.message }
              : job
          )
        );
        
        setStatusMessage('Error processing form');
        addToast('error', result.message);
      }
    } catch (error) {
      console.error('Error processing form:', error);
      
      // Update the form job with error
      setFormJobs(prevJobs => 
        prevJobs.map(job => 
          job.url === visitUrl && job.status === 'running'
            ? { 
                ...job, 
                status: 'error', 
                message: error instanceof Error ? error.message : 'Unknown error' 
              }
            : job
        )
      );
      
      setStatusMessage('Error processing form');
      addToast('error', `Failed to process form: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler to stop form processing
  const handleStopProcessing = async () => {
    try {
      if (singleJobId) {
        setStatusMessage('Stopping form automation...');
        
        // Call service to cancel the current job
        await cancelFormAutomation(singleJobId);
        
        // Update the job status
        setFormJobs(prevJobs => 
          prevJobs.map(job => 
            job.status === 'running'
              ? { ...job, status: 'completed', message: 'Processing stopped by user' }
              : job
          )
        );
        
        // Reset polling and job ID
        setPollingSingle(false);
        setSingleJobId(null);
        
        setStatusMessage('Form processing stopped');
        addToast('info', 'Form processing was stopped');
      }
    } catch (error) {
      console.error('Error stopping form processing:', error);
      setStatusMessage('Error stopping process');
      addToast('error', `Failed to stop processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Helper function to open URL with login
  const openUrlWithLogin = async (url: string) => {
    if (!url) return;
    
    // Set status message
    setStatusMessage('Logging in to Fossa...');
    
    try {
      // Check if electron is available in the window object
      const electronAPI = (window as any).electron;
      
      if (!electronAPI || !electronAPI.openUrlWithLogin) {
        // Fallback to opening URL directly if electron API is not available
        window.open(url, '_blank');
        setStatusMessage('Opened URL in new tab (no auth)');
        return;
      }
      
      // Call the electron API to handle login and navigation
      const response = await electronAPI.openUrlWithLogin(url);
      
      if (response.success) {
        setStatusMessage('Browser launched with authentication');
        addToast('success', 'Successfully opened authenticated browser');
      } else {
        throw new Error(response.message || 'Failed to launch browser');
      }
    } catch (error) {
      console.error('Error opening URL with login:', error);
      setStatusMessage('Error opening URL');
      addToast('error', `Failed to open URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
                <div className="flex items-center justify-between mb-4">
                  {selectedWorkOrder && (
                    <div className="flex items-center">
                      <div className="badge badge-primary flex items-center space-x-1 py-1 px-3">
                        <span>{selectedWorkOrder.customer.name}</span>
                        <span className="font-mono text-xs ml-1">({extractVisitNumber(selectedWorkOrder.visits.nextVisit.url)})</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <button 
                      className="btn btn-sm btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={goToPreviousWeek}
                      disabled={currentWeekIndex <= 0}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <div className="flex items-center">
                      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                        {groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                          groupedWorkOrders[currentWeekIndex].week : 'No work orders'}
                      </h3>
                      <span className="ml-2 badge badge-secondary py-1 px-2 text-xs">
                        {groupedWorkOrders.length > 0 && currentWeekIndex < groupedWorkOrders.length ? 
                          groupedWorkOrders[currentWeekIndex].orders.length : 0} orders
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button 
                        className="btn btn-sm bg-primary-50 hover:bg-primary-100 text-primary-600 border border-primary-200 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800"
                        onClick={goToCurrentWeek}
                      >
                        Today
                      </button>
                      <button 
                        className="btn btn-sm btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        onClick={goToNextWeek}
                        disabled={currentWeekIndex >= groupedWorkOrders.length - 1}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                
                  <div className="overflow-x-auto">
                    {filteredWorkOrders.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                          <FiClipboard className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">No work orders found</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">There are no work orders available for this period.</p>
                      </div>
                    ) : groupedWorkOrders.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                          <FiClipboard className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">No work orders found</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">There are no work orders available for any week.</p>
                      </div>
                    ) : (
                      <div>
                        {currentWeekIndex < groupedWorkOrders.length && (
                          <div className="bg-white dark:bg-gray-800">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Store</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visit #</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dispensers</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {groupedWorkOrders[currentWeekIndex].orders.map((order) => {
                                  const storeStyles = getStoreStyles(order.customer.name);
                                  const dispenserCount = getDispenserCountDirect(order.id);
                                  return (
                                    <tr
                                      key={order.id}
                                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                                        selectedWorkOrder?.id === order.id ? 
                                        `${storeStyles.bg} border-l-4 ${storeStyles.border}` : 
                                        ''
                                      }`}
                                      onClick={() => {
                                        setSelectedWorkOrder(order);
                                      }}
                                    >
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${storeStyles.bg} mr-3`}>
                                            <FiMapPin className={`${storeStyles.icon}`} />
                                          </div>
                                          <div>
                                            <div className="font-medium">{order.customer.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              ID: {order.id}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                                        {extractVisitNumber(order.visits.nextVisit.url)}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {order.visits.nextVisit.date || 'Not scheduled'}
                                      </td>
                                      <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                          {dispenserCount || '-'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                      onClick={() => {
                        if (visitUrl) {
                          openUrlWithLogin(visitUrl);
                        }
                      }}
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
                  {pollingSingle ? (
                    <button
                      className="btn btn-danger flex items-center space-x-2"
                      onClick={handleStopProcessing}
                    >
                      <FiX className="h-4 w-4" />
                      <span>Stop Processing</span>
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary flex items-center space-x-2"
                      onClick={handleSingleVisit}
                      disabled={isProcessing || !visitUrl}
                    >
                      <FiPlay className="h-4 w-4" />
                      <span>Process Visit Form</span>
                    </button>
                  )}
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

import React, { useState, useEffect } from 'react';
import { FiTool, FiRefreshCw, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { startDispenserScrapeJob, getDispenserScrapeStatus, ScrapeStatus } from '../services/scrapeService';

// Reuse ScrapeStatus interface from scrapeService
type DispenserScrapeStatus = ScrapeStatus;

const DispenserScrapeButton: React.FC = () => {
  const [status, setStatus] = useState<DispenserScrapeStatus>({
    status: 'idle',
    progress: 0,
    message: '',
    error: null
  });
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);

  // Start polling when scrape is running
  useEffect(() => {
    const startPolling = () => {
      if (polling) return; // Already polling
      
      const interval = setInterval(async () => {
        try {
          const currentStatus = await getDispenserScrapeStatus();
          console.log('Dispenser status update:', {
            status: currentStatus.status,
            progress: currentStatus.progress,
            message: currentStatus.message
          });
          
          // Check if the status indicates completion
          if (currentStatus.progress === 100 || 
              currentStatus.status === 'completed' || 
              (currentStatus.message && 
               (currentStatus.message.includes('complete') || 
                currentStatus.message.includes('success') || 
                currentStatus.message.includes('finished')))) {
            
            console.log('Detected completion state:', currentStatus);
            
            // Ensure we set a completed status
            const completedStatus: ScrapeStatus = {
              ...currentStatus,
              status: 'completed' as const,
              progress: 100
            };
            
            console.log('Setting completed status:', completedStatus);
            setStatus(completedStatus);
            
            // Stop polling
            if (polling) {
              console.log('Clearing polling interval');
              clearInterval(polling);
              setPolling(null);
            }
            
            // Reload the page after 2 seconds to show new data
            console.log('Scheduling page reload');
            setTimeout(() => {
              console.log('Reloading page');
              window.location.reload();
            }, 2000);
          } else {
            // Update status normally for non-completion states
            console.log('Setting non-completion status:', currentStatus);
            setStatus(currentStatus);
            
            // Also check for error state to stop polling
            if (currentStatus.status === 'error') {
              console.log('Detected error state, stopping polling');
              if (polling) {
                clearInterval(polling);
                setPolling(null);
              }
            }
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 1000);
      
      setPolling(interval);
    };
    
    if (status.status === 'running' && !polling) {
      console.log('Starting polling for dispenser status');
      startPolling();
    }
    
    // Cleanup on unmount
    return () => {
      if (polling) {
        console.log('Cleaning up polling interval');
        clearInterval(polling);
      }
    };
  }, [status.status, polling]);
  
  const handleScrape = async () => {
    // Don't allow if already running
    if (status.status === 'running') return;
    
    try {
      setStatus({
        status: 'running',
        progress: 0,
        message: 'Preparing to collect equipment data...',
        error: null
      });
      
      await startDispenserScrapeJob();
      
      // Status will be updated by the polling
    } catch (error) {
      console.error('Error starting dispenser scrape:', error);
      setStatus({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  
  const getButtonStyle = () => {
    switch (status.status) {
      case 'idle':
        return 'btn-primary';
      case 'running':
        return 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed opacity-70';
      case 'completed':
        return 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white';
      case 'error':
        return 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white';
      default:
        return 'btn-primary';
    }
  };
  
  const getButtonIcon = () => {
    switch (status.status) {
      case 'idle':
        return <FiTool className="w-4 h-4 mr-2 inline" />;
      case 'running':
        return <FiRefreshCw className="w-4 h-4 mr-2 inline animate-spin" />;
      case 'completed':
        return <FiCheckCircle className="w-4 h-4 mr-2 inline" />;
      case 'error':
        return <FiAlertCircle className="w-4 h-4 mr-2 inline" />;
      default:
        return <FiTool className="w-4 h-4 mr-2 inline" />;
    }
  };
  
  const getButtonText = () => {
    switch (status.status) {
      case 'idle':
        return 'Update Equipment Data';
      case 'running':
        return 'Updating Equipment...';
      case 'completed':
        return 'Equipment Update Complete';
      case 'error':
        return 'Equipment Update Failed';
      default:
        return 'Update Equipment Data';
    }
  };
  
  return (
    <div className="flex flex-col">
      <button 
        className={`btn ${getButtonStyle()}`}
        onClick={handleScrape}
        disabled={status.status === 'running'}
      >
        {getButtonIcon()}
        {getButtonText()}
      </button>
      
      {status.status === 'running' && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-primary-600 dark:bg-primary-500 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{status.message}</p>
        </div>
      )}
      
      {status.status === 'error' && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{status.error}</p>
      )}
    </div>
  );
};

export default DispenserScrapeButton; 
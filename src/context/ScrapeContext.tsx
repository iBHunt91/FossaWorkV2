import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ScrapeStatus, checkAllScrapeStatus } from '../services/scrapeService';

interface ScrapeContextType {
  workOrderStatus: ScrapeStatus;
  dispenserStatus: ScrapeStatus;
  isAnyScrapingInProgress: boolean;
  updateScrapeStatus: (statusUpdate?: {
    workOrderStatus?: ScrapeStatus;
    dispenserStatus?: ScrapeStatus;
  }) => Promise<void>;
}

const defaultScrapeStatus: ScrapeStatus = {
  status: 'idle',
  progress: 0,
  message: '',
  error: null
};

const ScrapeContext = createContext<ScrapeContextType | undefined>(undefined);

export const useScrapeStatus = () => {
  const context = useContext(ScrapeContext);
  if (!context) {
    throw new Error('useScrapeStatus must be used within a ScrapeProvider');
  }
  return context;
};

export const ScrapeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workOrderStatus, setWorkOrderStatus] = useState<ScrapeStatus>(defaultScrapeStatus);
  const [dispenserStatus, setDispenserStatus] = useState<ScrapeStatus>(defaultScrapeStatus);
  
  // Each job gets its own running flag
  const isWorkOrderScraping = workOrderStatus.status === 'running';
  const isDispenserScraping = dispenserStatus.status === 'running';
  
  // This is maintained for backwards compatibility but no longer used to restrict running both jobs
  const isAnyScrapingInProgress = isWorkOrderScraping || isDispenserScraping;

  // Function to update scrape status from the API
  const updateScrapeStatus = async (statusUpdate?: {
    workOrderStatus?: ScrapeStatus;
    dispenserStatus?: ScrapeStatus;
  }) => {
    try {
      // If statusUpdate is provided, use it to update the status directly
      if (statusUpdate) {
        if (statusUpdate.workOrderStatus) {
          setWorkOrderStatus(statusUpdate.workOrderStatus);
        }
        if (statusUpdate.dispenserStatus) {
          setDispenserStatus(statusUpdate.dispenserStatus);
        }
      } else {
        // Otherwise, fetch status from API
        const statuses = await checkAllScrapeStatus();
        setWorkOrderStatus(statuses.workOrder);
        setDispenserStatus(statuses.dispenser);
      }
    } catch (error) {
      console.error('Failed to update scrape statuses:', error);
    }
  };

  // Initial status check
  useEffect(() => {
    updateScrapeStatus();
    
    // Set polling interval to check for status updates
    const intervalId = setInterval(updateScrapeStatus, 2000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Listen for custom events that might indicate status changes
  useEffect(() => {
    // When a scrape is manually started
    const handleScrapeStarted = () => {
      updateScrapeStatus();
    };
    
    // When a scrape completes
    const handleScrapeComplete = () => {
      updateScrapeStatus();
    };

    window.addEventListener('scrape-started', handleScrapeStarted);
    window.addEventListener('scrape-complete', handleScrapeComplete as EventListener);
    
    return () => {
      window.removeEventListener('scrape-started', handleScrapeStarted);
      window.removeEventListener('scrape-complete', handleScrapeComplete as EventListener);
    };
  }, []);

  return (
    <ScrapeContext.Provider 
      value={{ 
        workOrderStatus, 
        dispenserStatus, 
        isAnyScrapingInProgress,
        updateScrapeStatus 
      }}
    >
      {children}
    </ScrapeContext.Provider>
  );
}; 
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useDispenserData } from '../../context/DispenserContext';
import JobDataService from './JobDataService';
import { WorkOrder } from '../../types';

/**
 * Hook for managing job data loading, reloading, and event handling
 * For use with the filter components
 */
export const useJobData = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { addToast } = useToast();
  const { dispenserData, loadDispenserData, isLoaded } = useDispenserData();
  
  // Create refs
  const isInitializedRef = useRef<boolean>(false);
  const jobService = useRef<JobDataService>(JobDataService.getInstance());
  
  /**
   * Load initial data when component mounts
   */
  const loadInitialData = useCallback(async () => {
    if (isInitializedRef.current) {
      console.log('Job data already initialized, skipping initial load');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Loading initial job data...');
      const data = await jobService.current.loadInitialData(
        setWorkOrders, 
        setIsLoading, 
        loadDispenserData, 
        dispenserData
      );
      
      // Show toast message based on dispenser info
      const { count, hasDispensers } = jobService.current.checkForDispenserInfo(data);
      
      if (hasDispensers) {
        addToast('success', `Loaded ${count} work orders with dispenser information`);
      } else if (data.length > 0) {
        addToast('warning', 'No dispenser information found for any work orders');
      }
      
      // Mark as initialized
      isInitializedRef.current = true;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error loading data');
      console.error('Error loading initial job data:', error);
      setError(error);
      addToast('error', `Failed to load job data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, dispenserData, loadDispenserData]);
  
  /**
   * Reload data from API and fallback sources
   */
  const reloadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Reloading job data...');
      const data = await jobService.current.reloadData(
        setWorkOrders, 
        setIsLoading, 
        loadDispenserData, 
        dispenserData
      );
      
      // Show toast message based on reload results
      if (data.length > 0) {
        addToast('success', `Successfully reloaded ${data.length} work orders`);
        
        // Also report on dispenser info
        const { count, hasDispensers } = jobService.current.checkForDispenserInfo(data);
        if (hasDispensers) {
          addToast('info', `${count} work orders have dispenser information`);
        }
      } else {
        addToast('warning', 'No work orders found during reload');
      }
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error reloading data');
      console.error('Error reloading job data:', error);
      setError(error);
      addToast('error', `Failed to reload job data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, dispenserData, loadDispenserData]);
  
  // Create a debounced version of reloadData
  const debouncedReloadData = useCallback(
    jobService.current.createDebouncedReload(reloadData, 1000),
    [reloadData]
  );
  
  // Set up event listeners for data updates
  useEffect(() => {
    // Set up listener for fossa-data-updated event
    const cleanup = jobService.current.setupDataUpdateListener(debouncedReloadData);
    
    // Also set up internal event listeners
    jobService.current.on('error', (err: Error) => {
      console.error('JobDataService error event:', err);
      setError(err);
    });
    
    // Initialize data if not already loaded
    if (!isInitializedRef.current) {
      // Use a small timeout to ensure everything is properly initialized
      const timeoutId = setTimeout(() => {
        loadInitialData();
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        cleanup();
      };
    }
    
    return cleanup;
  }, [debouncedReloadData, loadInitialData]);
  
  // Return the hook API
  return {
    workOrders,
    isLoading,
    error,
    loadInitialData,
    reloadData,
    isInitialized: isInitializedRef.current
  };
};

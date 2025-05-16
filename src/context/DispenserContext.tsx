import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface Dispenser {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: Record<string, string>;
  html?: string;
}

interface DispenserData {
  dispenserData: Record<string, { dispensers: Dispenser[] }>;
  lastLoaded?: Date;
}

interface DispenserContextType {
  dispenserData: DispenserData;
  setDispenserData: (data: DispenserData) => void;
  isLoaded: boolean;
  loadDispenserData: (forceRefresh?: boolean, showLoading?: boolean) => Promise<void>;
}

export const DispenserContext = createContext<DispenserContextType | undefined>(undefined);

export const useDispenserData = () => {
  const context = useContext(DispenserContext);
  if (!context) {
    throw new Error('useDispenserData must be used within a DispenserProvider');
  }
  return context;
};

export const DispenserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dispenserData, setDispenserData] = useState<DispenserData>({ dispenserData: {} });
  const [isLoaded, setIsLoaded] = useState(false);

  const loadDispenserData = async (forceRefresh = false, showLoading = true) => {
    // Check if data is already loaded and is recent (less than 5 minutes old)
    const now = new Date();
    if (
      !forceRefresh && 
      isLoaded && 
      dispenserData.lastLoaded && 
      (now.getTime() - dispenserData.lastLoaded.getTime()) < 5 * 60 * 1000
    ) {
      console.log('Using cached dispenser data, last loaded at', dispenserData.lastLoaded);
      return;
    }

    try {
      console.log('Fetching fresh dispenser data', forceRefresh ? '(forced refresh)' : '');
      // Add cache-busting timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      // Use the API endpoint instead of direct file access to get user-specific data
      const dispenserResponse = await fetch(`/api/dispensers?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (dispenserResponse.ok) {
        const data = await dispenserResponse.json();
        console.log('Raw dispenser data loaded:', data);
        
        if (!data || !data.dispenserData) {
          console.error('Invalid dispenser data format:', data);
          throw new Error('Invalid dispenser data format');
        }
        
        const numOrders = Object.keys(data.dispenserData || {}).length;
        console.log(`Loaded dispenser data for ${numOrders} work orders`);
        
        // Sample the data
        const sampleOrderId = Object.keys(data.dispenserData)[0];
        if (sampleOrderId) {
          console.log(`Sample order data for ${sampleOrderId}:`, data.dispenserData[sampleOrderId]);
        }
        
        setDispenserData({ ...data, lastLoaded: new Date() });
        if (showLoading) {
          setIsLoaded(true);
        }
      } else {
        console.warn(`Failed to load dispenser data store - Status: ${dispenserResponse.status}`);
        console.warn('Response:', await dispenserResponse.text());
        throw new Error(`Failed to load dispenser data: ${dispenserResponse.statusText}`);
      }
    } catch (error) {
      console.error('Error loading dispenser data:', error);
      // Still mark as loaded but with empty data
      setDispenserData({ dispenserData: {}, lastLoaded: new Date() });
      if (showLoading) {
        setIsLoaded(true);
      }
    }
  };

  // Load dispenser data on initial mount
  useEffect(() => {
    loadDispenserData();
  }, []);

  return (
    <DispenserContext.Provider value={{ dispenserData, setDispenserData, isLoaded, loadDispenserData }}>
      {children}
    </DispenserContext.Provider>
  );
}; 
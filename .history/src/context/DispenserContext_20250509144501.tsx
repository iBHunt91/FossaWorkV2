import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';

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

const DispenserContext = createContext<DispenserContextType | undefined>(undefined);

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

  const loadDispenserData = useCallback(async (forceRefresh = false, showLoading = true) => {
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
      const timestamp = new Date().getTime();
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
        if (!data || !data.dispenserData) {
          console.error('Invalid dispenser data format:', data);
          throw new Error('Invalid dispenser data format');
        }
        setDispenserData({ ...data, lastLoaded: new Date() });
        if (showLoading) {
          setIsLoaded(true);
        }
      } else {
        console.warn(`Failed to load dispenser data store - Status: ${dispenserResponse.status}`);
        throw new Error(`Failed to load dispenser data: ${dispenserResponse.statusText}`);
      }
    } catch (error) {
      console.error('Error loading dispenser data:', error);
      setDispenserData({ dispenserData: {}, lastLoaded: new Date() });
      if (showLoading) {
        setIsLoaded(true);
      }
    }
  }, [isLoaded, dispenserData, setDispenserData, setIsLoaded]);

  // Load dispenser data on initial mount - this loadDispenserData is now stable
  useEffect(() => {
    loadDispenserData();
  }, [loadDispenserData]); // Added loadDispenserData as a dependency

  return (
    <DispenserContext.Provider value={{ dispenserData, setDispenserData, isLoaded, loadDispenserData }}>
      {children}
    </DispenserContext.Provider>
  );
}; 
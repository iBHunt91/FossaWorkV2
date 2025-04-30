import React, { useEffect, useRef, ReactNode, createContext, useContext } from 'react';
import usePageState from '../hooks/usePageState';

// Create the context outside the component
type PersistenceContextType = {
  createState: <T>(key: string, initialValue: T | (() => T)) => [T, React.Dispatch<React.SetStateAction<T>>];
  createDateState: (key: string, initialValue?: Date | (() => Date)) => [Date, React.Dispatch<React.SetStateAction<Date>>];
  clearPageState: () => void;
};

const PersistenceContext = createContext<PersistenceContextType | null>(null);

interface PersistentViewProps {
  id: string;
  children: ReactNode;
  persistScrollPosition?: boolean;
  persistTabSelection?: boolean;
  storageType?: 'local' | 'session';
  expireAfterMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A component wrapper that provides state persistence across page reloads
 * Automatically handles common UI states like scroll position
 */
export const PersistentView: React.FC<PersistentViewProps> = ({
  id,
  children,
  persistScrollPosition = true,
  persistTabSelection = false,
  storageType = 'local',
  expireAfterMs,
  className = '',
  style = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { createState, createDateState, clearPageState } = usePageState(id, { 
    storageType, 
    expireAfterMs 
  });
  
  // Persist scroll position
  const [scrollPosition, setScrollPosition] = createState<number>('scrollPosition', 0);
  
  // Save scroll position when unmounting or before reload
  useEffect(() => {
    if (!persistScrollPosition) return;
    
    // Restore scroll position on mount
    if (containerRef.current && scrollPosition > 0) {
      containerRef.current.scrollTop = scrollPosition;
    }

    // Setup scroll event handler to save position
    const saveScrollPosition = () => {
      if (containerRef.current) {
        setScrollPosition(containerRef.current.scrollTop);
      }
    };
    
    // Save before unload (page refresh)
    window.addEventListener('beforeunload', saveScrollPosition);
    
    // Save on scroll, but use a throttled approach to avoid excessive updates
    let scrollTimeout: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        saveScrollPosition();
      }, 200); // Throttle to once every 200ms
    };
    
    if (containerRef.current) {
      containerRef.current.addEventListener('scroll', handleScroll);
    }

    return () => {
      // Clean up event listeners
      window.removeEventListener('beforeunload', saveScrollPosition);
      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
      }
      // Final save on unmount
      saveScrollPosition();
    };
  }, [persistScrollPosition, setScrollPosition]); // Remove scrollPosition from dependency array
  
  return (
    <PersistenceContext.Provider value={{ createState, createDateState, clearPageState }}>
      <div 
        ref={containerRef}
        className={`persistent-view ${className}`}
        style={{ 
          overflow: persistScrollPosition ? 'auto' : 'visible',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          ...style
        }}
      >
        {children}
      </div>
    </PersistenceContext.Provider>
  );
};

/**
 * Hook to use persistence features within a PersistentView component
 */
export const usePersistentViewContext = (): PersistenceContextType => {
  const context = useContext(PersistenceContext);
  
  if (context === null) {
    throw new Error('usePersistentViewContext must be used within a PersistentView component');
  }
  
  return context;
};

export default PersistentView; 
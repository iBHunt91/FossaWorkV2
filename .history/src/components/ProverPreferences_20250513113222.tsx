import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  FiRefreshCw, 
  FiSave, 
  FiCheck, 
  FiAlertCircle, 
  FiLoader, 
  FiDroplet,
  FiHash,
  FiX,
  FiChevronDown,
  FiPlus,
  FiDatabase,
  FiSettings,
  FiArrowLeft,
  FiArrowRight,
  FiInfo,
  FiChevronRight
} from 'react-icons/fi';
import { Prover, ProverPreferencesData } from '../types/electron';

// Extend the ProverPreferencesData interface if we can't modify the original
interface ExtendedProverPreferencesData extends ProverPreferencesData {
  autoPositionEthanolFree?: boolean;
}

// Dropdown component that renders in a portal
const FuelTypeDropdown: React.FC<{
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  fuelTypes: string[];
  selectedFuelTypes: string[];
  onSelect: (fuelType: string) => void;
  onClose: () => void;
}> = ({ isOpen, anchorElement, fuelTypes, selectedFuelTypes, onSelect, onClose }) => {
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && anchorElement && dropdownRef.current) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate available space in different directions
      const spaceBelow = viewportHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      const spaceRight = viewportWidth - anchorRect.left;

      // Determine vertical position
      let top = 0;
      let placement = 'bottom';
      
      if (spaceBelow >= dropdownRect.height || spaceBelow >= spaceAbove) {
        // Position below the button
        top = anchorRect.bottom + window.scrollY;
        placement = 'bottom';
      } else {
        // Position above the button
        top = anchorRect.top - dropdownRect.height + window.scrollY;
        placement = 'top';
      }

      // Determine horizontal position - ensure it doesn't go off-screen
      let left = anchorRect.left + window.scrollX;
      
      // If dropdown would go off right edge, align to right edge of button instead
      if (left + dropdownRect.width > viewportWidth) {
        left = (anchorRect.right - dropdownRect.width) + window.scrollX;
        
        // If now it would go off left edge, align to left edge of viewport with padding
        if (left < 0) {
          left = 10;
        }
      }

      setPosition({ top, left, placement });
      
      // Add global click handler to close dropdown when clicking outside
      const handleGlobalClick = (e: MouseEvent) => {
        if (
          dropdownRef.current && 
          !dropdownRef.current.contains(e.target as Node) && 
          !anchorElement.contains(e.target as Node)
        ) {
          onClose();
        }
      };
      
      document.addEventListener('mousedown', handleGlobalClick);
      return () => document.removeEventListener('mousedown', handleGlobalClick);
    }
  }, [isOpen, anchorElement, onClose]);

  if (!isOpen || !anchorElement) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        width: '220px',
        maxHeight: '280px',
        overflow: 'auto',
        marginTop: position.placement === 'bottom' ? '8px' : '0',
        marginBottom: position.placement === 'top' ? '8px' : '0'
      }}
    >
      <div className="sticky top-0 bg-gray-600 dark:bg-gray-600 px-3 py-2 border-b border-gray-500 dark:border-gray-500">
        <span className="text-xs font-medium text-gray-300 dark:text-gray-300">Select Fuel Type</span>
      </div>
      <div className="py-1">
        {fuelTypes
          .filter(type => !selectedFuelTypes.includes(type))
          .map(fuelType => (
            <div
              key={fuelType}
              className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-600 dark:hover:bg-gray-600 text-gray-200 dark:text-gray-200"
              onClick={() => {
                onSelect(fuelType);
                onClose();
              }}
            >
              {fuelType}
            </div>
          ))}
        {fuelTypes.filter(type => !selectedFuelTypes.includes(type)).length === 0 && (
          <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-400 italic">
            All fuel types selected
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const ProverPreferences: React.FC = () => {
  const [provers, setProvers] = useState<Prover[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [autoPositionEthanolFree, setAutoPositionEthanolFree] = useState(true);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Organized list of fuel types in standard order
  const fuelTypes = [
    'Regular',
    'Premium',
    'Plus',
    'Super',
    'Super Premium',
    'Ultra',
    'Diesel',
    'Ethanol-Free Gasoline Plus',
    'Ethanol-Free',
    'Race Fuel',
    'Rec Fuel 90'
  ];
  
  const positions = [1, 2, 3];

  // Fetch prover data on component mount
  useEffect(() => {
    fetchProverData();
  }, []);
  
  // Reset success/error messages after delay
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (message || error) {
      timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [message, error]);

  // Get sorted provers array by priority
  const getSortedProvers = (proversArray: Prover[]): Prover[] => {
    return [...proversArray].sort((a, b) => {
      const positionA = a.priority || 3;
      const positionB = b.priority || 3;
      return positionA - positionB;
    });
  };

  // Scrape prover information
  const scrapeProverInfo = async () => {
    setIsScraping(true);
    setError('');
    setMessage('');
    
    try {
      // Use the API endpoint instead of Electron IPC
      const response = await fetch('/api/scrape-prover-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('Successfully scraped prover information');
        // Refresh the data
        fetchProverData();
      } else {
        throw new Error(result.error || 'Failed to scrape prover information');
      }
    } catch (err: any) {
      console.error('Failed to scrape prover information:', err);
      setError(`Failed to scrape prover information: ${err.message}`);
    } finally {
      setIsScraping(false);
    }
  };

  // Fetch prover data from the backend
  const fetchProverData = async () => {
    setIsLoading(true);
    try {
      // Call the IPC bridge function to get prover data
      if (window.electron?.getProverPreferences) {
        const data = await window.electron.getProverPreferences() as ExtendedProverPreferencesData;
        if (data && data.provers && data.provers.length > 0) {
          // Get auto position setting, defaulting to true if not found
          setAutoPositionEthanolFree(data.autoPositionEthanolFree !== false);

          // Assign unique positions if not already set
          const assignedPositions = new Set();
          let availablePositions = [1, 2, 3];
          
          // First pass - keep existing positions if they don't conflict
          const proversWithPositions = data.provers.map((prover: any) => {
            let position = prover.priority || 0;
            
            // If position is invalid or already assigned, we'll reassign later
            if (position < 1 || position > 3 || assignedPositions.has(position)) {
              position = 0; // Mark for reassignment
            } else {
              assignedPositions.add(position);
              availablePositions = availablePositions.filter(p => p !== position);
            }
            
            return {
              ...prover,
              priority: position
            };
          });
          
          // Second pass - assign available positions to provers without valid positions
          const fullyAssignedProvers = proversWithPositions.map((prover: any) => {
            if (prover.priority === 0 && availablePositions.length > 0) {
              const newPosition = availablePositions.shift();
              assignedPositions.add(newPosition);
              return { ...prover, priority: newPosition };
            }
            return prover;
          });
          
          // Ensure every prover has a preferred_fuel_types array
          const proversWithUpdatedFields = fullyAssignedProvers.map(prover => {
            // Get existing fuel type preferences or create empty array
            let preferredFuelTypes = prover.preferred_fuel_types || 
              (prover.preferred_fuel_type ? [prover.preferred_fuel_type] : ['Regular']);
            
            return {
              ...prover,
              preferred_fuel_types: preferredFuelTypes,
              // Update the single preferred_fuel_type for backwards compatibility
              preferred_fuel_type: preferredFuelTypes[0] || "Regular"
            };
          });
          
          // Sort provers by priority
          setProvers(getSortedProvers(proversWithUpdatedFields));
          setLastUpdated(data.last_updated);
        } else {
          // No prover data, set empty array
          setProvers([]);
          setLastUpdated('');
        }
      } else {
        // For development without IPC, try to fetch from the API endpoint
        try {
          const response = await fetch('/api/prover-preferences');
          const data = await response.json();
          
          if (data && data.provers && data.provers.length > 0) {
            // Assign unique positions if not already set
            const assignedPositions = new Set();
            let availablePositions = [1, 2, 3];
            
            // First pass - keep existing positions if they don't conflict
            const proversWithPositions = data.provers.map((prover: any) => {
              let position = prover.priority || 0;
              
              // If position is invalid or already assigned, we'll reassign later
              if (position < 1 || position > 3 || assignedPositions.has(position)) {
                position = 0; // Mark for reassignment
              } else {
                assignedPositions.add(position);
                availablePositions = availablePositions.filter(p => p !== position);
              }
              
              return {
                ...prover,
                priority: position
              };
            });
            
            // Second pass - assign available positions to provers without valid positions
            const fullyAssignedProvers = proversWithPositions.map((prover: any) => {
              if (prover.priority === 0 && availablePositions.length > 0) {
                const newPosition = availablePositions.shift();
                assignedPositions.add(newPosition);
                return { ...prover, priority: newPosition };
              }
              return prover;
            });
            
            // Final pass - if we still have unassigned provers (when we have more than 3),
            // assign them positions 1-3 cyclically
            let positionCounter = 1;
            const finalAssignedProvers = fullyAssignedProvers.map((prover: any) => {
              if (prover.priority === 0) {
                const newPosition = positionCounter;
                positionCounter = positionCounter % 3 + 1;
                return { ...prover, priority: newPosition };
              }
              return prover;
            });
            
            // Ensure every prover has a preferred_fuel_types array
            const proversWithUpdatedFields = finalAssignedProvers.map((prover: any) => {
              let preferredFuelTypes = prover.preferred_fuel_types || 
                (prover.preferred_fuel_type ? [prover.preferred_fuel_type] : ['Regular']);
              
              return {
                ...prover,
                preferred_fuel_types: preferredFuelTypes,
                preferred_fuel_type: preferredFuelTypes[0] || "Regular"
              };
            });
            
            // Sort provers by priority
            setProvers(getSortedProvers(proversWithUpdatedFields));
            setLastUpdated(data.last_updated);
          } else {
            setProvers([]);
            setLastUpdated('');
          }
        } catch (err) {
          console.warn('API not available, cannot fetch prover data');
          setError('API is not available. Unable to fetch prover preferences.');
          setProvers([]);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch prover data:', err);
      setError(`Failed to load prover preferences: ${err.message}`);
      setProvers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save updated prover preferences
  const saveProverPreferences = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');
    
    try {
      // Before saving, ensure we also set the preferred_fuel_type to the first item in the array
      // for backward compatibility
      const proversToSave = provers.map(prover => ({
        ...prover,
        preferred_fuel_type: prover.preferred_fuel_types && prover.preferred_fuel_types.length > 0 
          ? prover.preferred_fuel_types[0] 
          : ''
      }));

      if (window.electron?.updateProverPreferences) {
        const result = await window.electron.updateProverPreferences({
          provers: proversToSave,
          last_updated: new Date().toISOString(),
          autoPositionEthanolFree
        } as ExtendedProverPreferencesData);
        
        if (result.success) {
          setMessage('Prover preferences saved successfully');
          if (result.data) {
            setLastUpdated(result.data.last_updated);
          }
        } else {
          throw new Error(result.error || 'Failed to save preferences');
        }
      } else {
        // For development without IPC
        console.log('Saving prover preferences (mock):', { proversToSave, autoPositionEthanolFree });
        setMessage('Prover preferences saved successfully (mock)');
        setLastUpdated(new Date().toISOString());
      }
    } catch (err: any) {
      console.error('Failed to save prover preferences:', err);
      setError(`Failed to save preferences: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle a fuel type for a prover
  const toggleProverFuelType = (proverId: string, fuelType: string) => {
    setProvers(provers.map(prover => {
      if (prover.prover_id === proverId) {
        const currentTypes = prover.preferred_fuel_types || [];
        let updatedTypes;
        
        if (currentTypes.includes(fuelType)) {
          // Remove the fuel type
          updatedTypes = currentTypes.filter(type => type !== fuelType);
        } else {
          // Add the fuel type
          updatedTypes = [...currentTypes, fuelType];
        }
        
        return { 
          ...prover, 
          preferred_fuel_types: updatedTypes,
          // Update the single preferred_fuel_type for backwards compatibility
          preferred_fuel_type: updatedTypes.length > 0 ? updatedTypes[0] : '' 
        };
      }
      return prover;
    }));
  };

  // Update a single prover's position
  const updateProverPosition = (proverId: string, position: number) => {
    setProvers(provers => {
      // First, find if any other prover has this position
      const updatedProvers = provers.map(prover => {
        if (prover.prover_id === proverId) {
          // Update the selected prover
          return { ...prover, priority: position };
        } else if (prover.priority === position) {
          // If another prover has this position, remove it
          // We'll auto-assign a new position (the next available one)
          const availablePositions = [1, 2, 3].filter(p => 
            !provers.some(pr => pr.prover_id !== proverId && pr.priority === p)
          );
          return { 
            ...prover, 
            priority: availablePositions[0] || (position % 3) + 1 
          };
        }
        return prover;
      });
      
      // Return the sorted provers
      return getSortedProvers(updatedProvers);
    });
  };

  // Format the last updated timestamp
  const formatLastUpdated = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return 'Unknown';
    }
  };

  // Show empty state if no provers exist
  if (!isLoading && provers.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md">
        <div className="flex flex-col items-center justify-center space-y-6 py-16">
          <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <FiDroplet className="h-14 w-14 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-medium text-gray-900 dark:text-white">No Prover Data Available</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 max-w-md">
            You need to scrape prover information from Work Fossa to configure your prover preferences.
          </p>
          <button
            onClick={scrapeProverInfo}
            disabled={isScraping}
            className="mt-6 px-6 py-3 flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isScraping ? (
              <>
                <FiLoader className="h-5 w-5 mr-3 animate-spin" /> 
                Scraping Prover Info...
              </>
            ) : (
              <>
                <FiDatabase className="h-5 w-5 mr-3" /> 
                Scrape Prover Info
              </>
            )}
          </button>

          {message && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-900">
              <div className="flex items-center">
                <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{message}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900">
              <div className="flex items-center">
                <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Rest of the component for displaying and managing provers
  return (
    <div className="max-w-4xl mx-auto p-6 rounded-lg bg-gray-900 dark:bg-gray-800 shadow-md">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <div className="flex items-center">
            <div className="p-2 bg-gray-800 dark:bg-blue-900/30 rounded-lg mr-3">
              <FiSettings className="text-blue-500 dark:text-blue-400" size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-white dark:text-white">Prover Preferences</h2>
          </div>
          <div className="mt-2 ml-11 text-sm text-gray-400 dark:text-gray-400">
            Configure the order of your provers:
            <div className="flex items-center mt-2 space-x-2">
              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded bg-green-900/40 text-green-400 text-xs font-medium">
                1 - Left
              </span>
              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded bg-amber-900/40 text-amber-400 text-xs font-medium">
                2 - Center
              </span>
              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded bg-blue-900/40 text-blue-400 text-xs font-medium">
                3 - Right
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchProverData()}
            className="p-2 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-gray-300 rounded-md transition-colors"
            title="Refresh data"
          >
            <FiRefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={scrapeProverInfo}
            disabled={isScraping}
            className="px-5 py-2.5 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isScraping ? (
              <>
                <FiLoader className="h-4 w-4 mr-2 animate-spin" /> 
                Scraping...
              </>
            ) : (
              <>
                <FiDatabase className="h-4 w-4 mr-2" /> 
                Rescrape Data
              </>
            )}
          </button>
          <button
            onClick={saveProverPreferences}
            disabled={isSaving || isLoading || provers.length === 0}
            className="px-5 py-2.5 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Save your prover position preferences"
          >
            {isSaving ? (
              <>
                <FiLoader className="h-4 w-4 mr-2 animate-spin" /> 
                Saving...
              </>
            ) : (
              <>
                <FiSave className="h-4 w-4 mr-2" />
                Save Positions
              </>
            )}
          </button>
        </div>
      </div>

      {/* Special Fuel Handling Section with Toggle */}
      <div className="mb-5 p-3 bg-blue-900/20 text-blue-300 rounded-lg border border-blue-800 dark:border-blue-900">
        <div className="flex items-start justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => setIsInfoExpanded(!isInfoExpanded)}>
            <FiInfo className="h-5 w-5 mr-2 flex-shrink-0" />
            <div className="font-medium">Auto-Position Special Fuel Types</div>
            <FiChevronRight className={`ml-2 h-4 w-4 transition-transform ${isInfoExpanded ? 'rotate-90' : ''}`} />
          </div>
          
          {/* Toggle switch */}
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={autoPositionEthanolFree}
                onChange={() => setAutoPositionEthanolFree(!autoPositionEthanolFree)}
              />
              <div className={`block w-10 h-6 rounded-full ${autoPositionEthanolFree ? 'bg-green-400' : 'bg-gray-600'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoPositionEthanolFree ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>
        
        {/* Collapsible description */}
        {isInfoExpanded && (
          <div className="mt-2 pl-7 text-sm">
            When enabled, special fuel types (Ethanol-Free, Ethanol-Free Gasoline Plus, Rec Fuel 90)
            will be handled as follows:
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>If one of these special fuels is the <strong>only</strong> grade on a dispenser, it will use the standard Position 1.</li>
              <li>If one of these special fuels appears with other grades (but <strong>without</strong> Diesel), it will automatically use Position 3.</li>
              <li>If Diesel is present with these special fuels, standard position preferences will be used.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {message && (
        <div className="mb-5 p-3 bg-green-900/20 dark:bg-green-900/20 text-green-400 dark:text-green-400 rounded-lg border border-green-800 dark:border-green-900">
          <div className="flex items-center">
            <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{message}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 bg-red-900/20 dark:bg-red-900/20 text-red-400 dark:text-red-400 rounded-lg border border-red-800 dark:border-red-900">
          <div className="flex items-center">
            <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Last updated info */}
      {lastUpdated && (
        <div className="text-sm text-gray-400 dark:text-gray-400 flex items-center mb-6">
          <FiRefreshCw className="mr-1" /> Last updated: {formatLastUpdated(lastUpdated)}
        </div>
      )}

      <div className="border-b border-gray-700 dark:border-gray-700 mb-6"></div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FiLoader className="h-12 w-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-400 dark:text-gray-400">Loading prover preferences...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {provers.map(prover => (
            <div 
              key={prover.prover_id} 
              className="rounded-xl border border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-900 overflow-hidden shadow-sm"
            >
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-20 h-20 text-white font-medium
                  ${prover.priority === 1 ? 'bg-green-800' : 
                   prover.priority === 2 ? 'bg-amber-800' : 
                   'bg-blue-800'}`}>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs uppercase font-bold text-white/70">POSITION</span>
                    <div className="flex items-center mt-1">
                      {prover.priority === 1 && <FiArrowLeft className="h-3 w-3 mr-1" />}
                      <span className="text-2xl font-bold">{prover.priority}</span>
                      {prover.priority === 3 && <FiArrowRight className="h-3 w-3 ml-1" />}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 flex-1">
                  <h3 className="text-lg font-medium text-white dark:text-white flex items-center">
                    <span className="mr-2">{prover.prover_id}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-700 dark:bg-gray-800 text-gray-300 dark:text-gray-400 rounded">
                      {prover.make || "Seraphin Prover"}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
                    Serial: {prover.serial || prover.prover_id}
                  </p>
                </div>
                <div className="px-5">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-300 dark:text-gray-300">Position:</label>
                    <select
                      value={prover.priority}
                      onChange={(e) => updateProverPosition(prover.prover_id, parseInt(e.target.value))}
                      className="p-2 border border-gray-600 dark:border-gray-600 bg-gray-700 dark:bg-gray-700 rounded-md shadow-sm text-sm text-gray-200 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="1">1 (Left)</option>
                      <option value="2">2 (Center)</option>
                      <option value="3">3 (Right)</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="p-5 border-t border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-800">
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 dark:text-gray-300 mb-3 flex items-center">
                    <FiDroplet className="mr-1.5 text-blue-400 dark:text-blue-400" />
                    Preferred Fuel Types
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {prover.preferred_fuel_types && prover.preferred_fuel_types.length > 0 ? (
                      prover.preferred_fuel_types.map(fuelType => (
                        <div 
                          key={fuelType}
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium
                            ${fuelType === 'Regular' ? 'bg-blue-900/40 text-blue-300' :
                             fuelType === 'Premium' ? 'bg-purple-900/40 text-purple-300' :
                             fuelType === 'Diesel' ? 'bg-amber-800 text-amber-300' :
                             fuelType.includes('Ethanol') ? 'bg-green-900/40 text-green-300' :
                             fuelType === 'Race Fuel' ? 'bg-red-900/40 text-red-300' :
                             fuelType === 'Rec Fuel 90' ? 'bg-cyan-900/40 text-cyan-300' :
                             fuelType === 'Super' || fuelType === 'Super Premium' ? 'bg-indigo-900/40 text-indigo-300' :
                             fuelType === 'Ultra' ? 'bg-violet-900/40 text-violet-300' :
                             fuelType === 'Plus' ? 'bg-teal-900/40 text-teal-300' :
                             'bg-gray-700 text-gray-300'}`}
                        >
                          {fuelType}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProverFuelType(prover.prover_id, fuelType);
                            }}
                            className="ml-2 -mr-0.5 h-5 w-5 rounded-full flex items-center justify-center hover:bg-red-800 hover:text-white transition-colors"
                            aria-label={`Remove ${fuelType}`}
                          >
                            <FiX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No fuel types selected
                      </div>
                    )}
                    
                    {/* New Portal-based dropdown */}
                    <div className="relative inline-block">
                      <button
                        type="button"
                        ref={(el) => { buttonRefs.current[prover.prover_id] = el; }}
                        className="flex items-center justify-between px-3 py-1.5 text-sm border border-gray-600 dark:border-gray-600 rounded-full bg-gray-700 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-200 dark:text-gray-300"
                        onClick={() => setOpenDropdownId(openDropdownId === prover.prover_id ? null : prover.prover_id)}
                      >
                        <FiPlus className="w-4 h-4 mr-1" />
                        <span>Add Fuel Type</span>
                      </button>
                      
                      <FuelTypeDropdown
                        isOpen={openDropdownId === prover.prover_id}
                        anchorElement={buttonRefs.current[prover.prover_id]}
                        fuelTypes={fuelTypes}
                        selectedFuelTypes={prover.preferred_fuel_types || []}
                        onSelect={(fuelType) => toggleProverFuelType(prover.prover_id, fuelType)}
                        onClose={() => setOpenDropdownId(null)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Scrape button (empty state) - keeping for safety but should never be shown due to the earlier conditional return */}
      {!isLoading && provers.length === 0 && (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <FiDroplet className="h-12 w-12 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">No Prover Data Available</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 max-w-md">
            You need to scrape prover information from Work Fossa to configure your prover preferences.
          </p>
          <button
            onClick={scrapeProverInfo}
            disabled={isScraping}
            className="mt-4 px-4 py-2 flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isScraping ? (
              <>
                <FiLoader className="h-5 w-5 mr-2 animate-spin" /> 
                Scraping Prover Info...
              </>
            ) : (
              <>
                <FiDatabase className="h-5 w-5 mr-2" /> 
                Scrape Prover Info
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProverPreferences; 
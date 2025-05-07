import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FiDatabase
} from 'react-icons/fi';
import { Prover, ProverPreferencesData } from '../types/electron';

const ProverPreferences: React.FC = () => {
  const [provers, setProvers] = useState<Prover[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Updated list of fuel types in standard order
  const fuelTypes = [
    'Regular',
    'Premium',
    'Super',
    'Super Premium',
    'Ultra',
    'Diesel',
    'Ethanol-Free Gasoline Plus',
    'Ethanol-Free',
    'Race Fuel',
    'Rec Fuel 90',
    'Plus'
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (openDropdownId && dropdownRefs.current[openDropdownId] && 
          !dropdownRefs.current[openDropdownId]?.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [openDropdownId]);

  // Get sorted provers array by priority
  const getSortedProvers = (proversArray: Prover[]): Prover[] => {
    return [...proversArray].sort((a, b) => {
      const priorityA = a.priority || 3;
      const priorityB = b.priority || 3;
      return priorityA - priorityB;
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
        const data = await window.electron.getProverPreferences();
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
          last_updated: new Date().toISOString()
        });
        
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
        console.log('Saving prover preferences (mock):', proversToSave);
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

  // Update a single prover's priority
  const updateProverPriority = (proverId: string, priority: number) => {
    setProvers(provers => {
      // First, find if any other prover has this priority
      const updatedProvers = provers.map(prover => {
        if (prover.prover_id === proverId) {
          // Update the selected prover
          return { ...prover, priority };
        } else if (prover.priority === priority) {
          // If another prover has this priority, remove it
          // We'll auto-assign a new priority (the next available one)
          const availablePriorities = [1, 2, 3].filter(p => 
            !provers.some(pr => pr.prover_id !== proverId && pr.priority === p)
          );
          return { 
            ...prover, 
            priority: availablePriorities[0] || (priority % 3) + 1 
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

  // Render fuel type dropdown for a prover
  const renderFuelTypeDropdown = (prover: Prover) => {
    if (openDropdownId !== prover.prover_id) return null;
    
    return (
      <div 
        ref={(el) => { dropdownRefs.current[prover.prover_id] = el; }}
        className="absolute mt-1 shadow-lg bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
        style={{
          zIndex: 9999,
          width: '180px',
          maxHeight: '200px',
          overflow: 'auto',
          position: 'absolute',
          left: '0',
          top: 'calc(100% + 4px)'
        }}
      >
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 border-b border-gray-200 dark:border-gray-600">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Select Fuel Type</span>
        </div>
        <div>
          {fuelTypes
            .filter(type => !(prover.preferred_fuel_types || []).includes(type))
            .map(fuelType => (
              <button
                key={fuelType}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProverFuelType(prover.prover_id, fuelType);
                  setOpenDropdownId(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {fuelType}
              </button>
            ))}
          {fuelTypes.filter(type => !(prover.preferred_fuel_types || []).includes(type)).length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
              All fuel types selected
            </div>
          )}
        </div>
      </div>
    );
  };

  // Show empty state if no provers exist
  if (!isLoading && provers.length === 0) {
    return (
      <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md space-y-6">
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

          {message && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-900">
              <div className="flex items-center">
                <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{message}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900">
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
    <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <FiDroplet className="text-blue-500 mr-2" size={20} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Prover Preferences</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchProverData()}
            className="px-3 py-1 flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none"
          >
            <FiRefreshCw className="mr-1" /> Refresh
          </button>
          <button
            onClick={scrapeProverInfo}
            disabled={isScraping}
            className="px-3 py-1 flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isScraping ? (
              <>
                <FiLoader className="h-4 w-4 mr-1 animate-spin" /> 
                Scraping...
              </>
            ) : (
              <>
                <FiDatabase className="h-4 w-4 mr-1" /> 
                Rescrape
              </>
            )}
          </button>
          <button
            onClick={saveProverPreferences}
            disabled={isSaving || isLoading || provers.length === 0}
            className="px-4 py-2 flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <FiLoader className="h-4 w-4 mr-2 animate-spin" /> 
                Saving...
              </>
            ) : (
              <>
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-900">
          <div className="flex items-center">
            <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{message}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900">
          <div className="flex items-center">
            <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Last updated info */}
      {lastUpdated && (
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center mb-6">
          <FiRefreshCw className="mr-1" /> Last updated: {formatLastUpdated(lastUpdated)}
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6"></div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <FiLoader className="h-10 w-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading prover preferences...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {provers.map(prover => (
            <div 
              key={prover.prover_id} 
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden"
            >
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-14 h-14 text-white font-medium
                  ${prover.priority === 1 ? 'bg-green-600' : 
                   prover.priority === 2 ? 'bg-amber-600' : 
                   'bg-blue-600'}`}>
                  # {prover.priority}
                </div>
                <div className="px-4 py-3 flex-1">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    {prover.prover_id}
                  </h3>
                </div>
                <div className="px-4">
                  <select
                    value={prover.priority}
                    onChange={(e) => updateProverPriority(prover.prover_id, parseInt(e.target.value))}
                    className="block w-16 py-1.5 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
              </div>
              
              <div className="p-5 border-t border-gray-200 dark:border-gray-700">
                <div className="mb-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preferred Fuel Types</h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {prover.preferred_fuel_types && prover.preferred_fuel_types.map(fuelType => (
                      <div 
                        key={fuelType}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                          ${fuelType === 'Regular' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                           fuelType === 'Premium' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' :
                           fuelType === 'Diesel' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                           fuelType.includes('Ethanol') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                           fuelType === 'Race Fuel' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                           fuelType === 'Rec Fuel 90' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' :
                           fuelType === 'Super' || fuelType === 'Super Premium' || fuelType === 'Ultra' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' :
                           'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}
                      >
                        {fuelType}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProverFuelType(prover.prover_id, fuelType);
                          }}
                          className="ml-1.5 -mr-1 h-4 w-4 rounded-full flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    <div 
                      className="relative inline-block" 
                      ref={(el) => { dropdownRefs.current[prover.prover_id] = el; }}
                    >
                       <button
                        type="button"
                        className="flex items-center justify-between px-2.5 py-1.5 text-sm border border-gray-600 dark:border-gray-600 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 min-w-[140px]"
                        onClick={() => setOpenDropdownId(openDropdownId === prover.prover_id ? null : prover.prover_id)}
                       >
                        <span className="text-sm">{prover.preferred_fuel_types && prover.preferred_fuel_types.length > 0 ? prover.preferred_fuel_types[0] : 'Select fuel type'}</span>
                        <FiChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-70" />
                       </button>
                       
                      {openDropdownId === prover.prover_id && (
                        <div 
                          className="fixed z-[9999] bg-gray-800 border border-gray-600 rounded shadow-xl" 
                          style={{ 
                            width: '180px',
                            maxHeight: '220px',
                            overflow: 'auto',
                            // Calculate position dynamically based on the button's position
                            top: (dropdownRefs.current[prover.prover_id]?.getBoundingClientRect()?.bottom || 0) + window.scrollY + 4 + 'px',
                            left: (dropdownRefs.current[prover.prover_id]?.getBoundingClientRect()?.left || 0) + window.scrollX + 'px'
                          }}
                        >
                          <div className="py-1">
                            {fuelTypes
                              .filter(type => !(prover.preferred_fuel_types || []).includes(type))
                              .map(fuelType => (
                                <div
                                  key={fuelType}
                                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-700 text-gray-300"
                                  onClick={() => {
                                    toggleProverFuelType(prover.prover_id, fuelType);
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  {fuelType}
                                </div>
                              ))}
                              {fuelTypes.filter(type => !(prover.preferred_fuel_types || []).includes(type)).length === 0 && (
                                <div className="px-3 py-1.5 text-sm text-gray-500 italic">
                                  All fuel types selected
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                     </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Scrape button (empty state) */}
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
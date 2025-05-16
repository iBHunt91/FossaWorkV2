import React, { useState, useEffect } from 'react';
import { 
  FiX, 
  FiChevronDown, 
  FiSettings, 
  FiInfo,
  FiHash,
  FiEye
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';

// Import the fuel grades array for proper ordering
const fuelGrades = require('../../data/fuel_grades');

interface Dispenser {
  title?: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: Record<string, string>;
  html?: string;
}

interface DispenserModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispensers: Dispenser[];
  orderId?: string | null;
  visitNumber?: number | string;
  sortFuelTypes?: (gradeString: string) => string[];
}

const DispenserModal: React.FC<DispenserModalProps> = ({ 
  isOpen, 
  onClose, 
  dispensers,
  orderId,
  visitNumber = "—", // Default value to ensure it's always displayed
  sortFuelTypes
}) => {
  const [expandedTechnicalDetails, setExpandedTechnicalDetails] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Handle animation timing
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isOpen) {
      // Small delay to allow CSS transition to work properly
      setModalVisible(true);
    } else {
      // Allow time for exit animation
      timer = setTimeout(() => {
        setModalVisible(false);
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  // Default implementation for sortFuelTypes that uses the fuelGrades array for ordering
  const defaultSortFuelTypes = (gradeString: string): string[] => {
    if (!gradeString) return [];
    
    // Split the grades from the string
    const grades = gradeString.split(',').map(type => type.trim()).filter(Boolean);
    
    // Sort grades based on their index in the fuelGrades array
    return grades.sort((a, b) => {
      const indexA = fuelGrades.findIndex(g => g.toLowerCase() === a.toLowerCase());
      const indexB = fuelGrades.findIndex(g => g.toLowerCase() === b.toLowerCase());
      
      // If a grade isn't found in the array, place it at the end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      // Return the difference in indices to sort by position in fuelGrades array
      return indexA - indexB;
    });
  };

  // Use the provided sortFuelTypes function or fall back to the default
  const sortFuelTypesImpl = typeof sortFuelTypes === 'function' ? sortFuelTypes : defaultSortFuelTypes;

  const toggleTechnicalDetails = (index: number) => {
    setExpandedTechnicalDetails(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };
  
  if (!isOpen && !modalVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm transition-opacity duration-300 modal-overlay"
      style={{ opacity: isOpen ? '1' : '0' }}
      onClick={onClose}
      aria-labelledby="dispenser-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>
        
        <div 
          className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-xl text-left shadow-xl transform transition-all duration-300 sm:my-8 sm:align-middle max-w-4xl w-full border border-gray-200 dark:border-gray-700 modal-content"
          style={{ 
            transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.95)', 
            opacity: isOpen ? '1' : '0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - more compact */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 px-4 py-2 rounded-t-xl">
            <div className="flex justify-between items-center">
              <h3 
                className="text-base leading-6 font-medium text-white flex items-center"
                id="dispenser-modal-title"
              >
                <div className="bg-primary-500/40 p-1 rounded-md mr-2 shadow-inner">
                  <GiGasPump className="text-white" size={18} />
                </div>
                <span className="whitespace-nowrap">Visit #{visitNumber}</span> 
                {orderId && (
                  <span className="ml-2 font-normal text-primary-100 flex items-center bg-primary-700/40 px-2 py-0.5 rounded-md text-xs">
                    <FiHash className="mr-1 opacity-80" size={12} />
                    <span className="font-semibold">{orderId}</span>
                  </span>
                )}
              </h3>
              <button
                className="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors p-1 rounded-full hover:bg-primary-700/50 dark:hover:bg-primary-800/70"
                onClick={onClose}
                aria-label="Close"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Content - more compact with increased height */}
          <div className="bg-white dark:bg-gray-800 p-3">
            {dispensers.length > 0 ? (
              <div className="space-y-2 max-h-[calc(90vh-100px)] overflow-y-auto">
                {dispensers.map((dispenser, index) => {
                  // Extract the dispenser number from the title with improved pattern matching
                  let dispenserNumber = `#${index+1}`;
                  
                  if (dispenser.title) {
                    // First try dual format (e.g., "1/2 - Regular...")
                    const dualMatch = dispenser.title.match(/^(\d+\/\d+)/);
                    if (dualMatch) {
                      dispenserNumber = dualMatch[1];
                    } else {
                      // Then try single number format (e.g., "13 - Diesel...")
                      const singleMatch = dispenser.title.match(/^(\d+)\s*-/);
                      if (singleMatch) {
                        dispenserNumber = singleMatch[1];
                      }
                    }
                  }
                  
                  // Whether this dispenser is expanded or not
                  const isExpanded = expandedTechnicalDetails.includes(index);
                  
                  return (
                    <div 
                      key={index} 
                      className={`bg-white dark:bg-gray-800 rounded-md border ${isExpanded ? 'border-primary-300 dark:border-primary-600/80' : 'border-gray-200 dark:border-gray-700'} shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 card`}
                    >
                      {/* Dispenser card header - more compact */}
                      <div 
                        className={`flex items-center ${isExpanded ? 'bg-primary-50 dark:bg-primary-900/20 p-2 panel-header' : 'p-2 panel-header'}`}
                      >
                        {/* Dispenser number badge - smaller */}
                        <div className="bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-600 dark:to-primary-800 text-white rounded-md min-w-[40px] px-2 py-1 text-sm font-bold shadow-sm mr-3 flex-shrink-0 text-center">
                          {dispenserNumber}
                        </div>
                        
                        {/* Fuel types - middle section, made more compact */}
                        <div className="flex-1 overflow-x-auto">
                          {dispenser.fields && dispenser.fields.Grade ? (
                            <div className="flex flex-wrap gap-1">
                              {sortFuelTypesImpl(dispenser.fields.Grade).map((grade: string, i: number) => {
                                // Enhanced color coding for fuel grades
                                let badgeClass = '';
                                let gradeLower = grade.toLowerCase();
                                
                                if (gradeLower.includes('regular')) {
                                  badgeClass = 'bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700';
                                } else if (gradeLower.includes('plus')) {
                                  badgeClass = 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700';
                                } else if (gradeLower.includes('premium')) {
                                  badgeClass = 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700';
                                } else if (gradeLower.includes('diesel')) {
                                  badgeClass = 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700';
                                } else if (gradeLower.includes('e-85') || gradeLower.includes('ethanol')) {
                                  badgeClass = 'bg-pink-100 text-pink-800 border border-pink-300 dark:bg-pink-900/50 dark:text-pink-200 dark:border-pink-700';
                                } else if (gradeLower.includes('super')) {
                                  badgeClass = 'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700';
                                } else {
                                  badgeClass = 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-700/80 dark:text-gray-300 dark:border-gray-600';
                                }
                                
                                return (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClass} shadow-sm flex items-center justify-center`}
                                  >
                                    {grade.trim()}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                              No fuel data available
                            </div>
                          )}
                        </div>
                        
                        {/* Details button - smaller */}
                        <button
                          onClick={() => toggleTechnicalDetails(index)}
                          className={`ml-2 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors duration-200 shadow-sm ${
                            isExpanded 
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800/50 btn-secondary' 
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 btn-secondary'
                          }`}
                          aria-expanded={isExpanded}
                          aria-controls={`dispenser-details-${index}`}
                        >
                          {isExpanded ? (
                            <>
                              <FiChevronDown className="h-3 w-3" />
                              <span>Details</span>
                            </>
                          ) : (
                            <>
                              <FiEye className="h-3 w-3" />
                              <span>Details</span>
                            </>
                          )}
                        </button>
                      </div>
                        
                      {/* Technical specs - ONLY SHOWN WHEN EXPANDED - more compact layout */}
                      {isExpanded && (
                        <div 
                          className="p-2 border-t border-primary-200 dark:border-primary-700/30 bg-gray-50 dark:bg-gray-700/50"
                          id={`dispenser-details-${index}`}
                        >
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {dispenser.make && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5 font-medium uppercase tracking-wider">Make/Model</span>
                                <span className="font-medium text-gray-800 dark:text-white">
                                  {dispenser.make} {dispenser.model && `/ ${dispenser.model}`}
                                </span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Number of Nozzles (per side)'] && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5 font-medium uppercase tracking-wider">Nozzles per side</span>
                                <span className="font-medium text-gray-800 dark:text-white">{dispenser.fields['Number of Nozzles (per side)']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Meter Type'] && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5 font-medium uppercase tracking-wider">Meter type</span>
                                <span className="font-medium text-gray-800 dark:text-white">{dispenser.fields['Meter Type']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Stand Alone Code'] && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5 font-medium uppercase tracking-wider">Stand Alone Code</span>
                                <span className="font-medium text-gray-800 dark:text-white">{dispenser.fields['Stand Alone Code']}</span>
                              </div>
                            )}
                            
                            {dispenser.serial && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5 font-medium uppercase tracking-wider">Serial Number</span>
                                <span className="font-medium text-gray-800 dark:text-white">{dispenser.serial}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex justify-center mb-2 opacity-40">
                  <GiGasPump className="h-8 w-8" />
                </div>
                <p>No dispenser data available</p>
              </div>
            )}
          </div>
          
          {/* Footer - more compact */}
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
            <div className="text-xs text-gray-600 dark:text-gray-300 font-medium flex items-center">
              <GiGasPump className="mr-1 text-gray-500 dark:text-gray-400" size={14} />
              <span>{dispensers.length} dispensers</span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => expandedTechnicalDetails.length === dispensers.length 
                  ? setExpandedTechnicalDetails([])
                  : setExpandedTechnicalDetails([...Array(dispensers.length).keys()])}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <FiEye className="mr-1 h-3 w-3 flex-shrink-0" />
                <span>{expandedTechnicalDetails.length === dispensers.length ? 'Collapse All' : 'Show All Details'}</span>
              </button>
              
              <button
                onClick={onClose}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispenserModal; 
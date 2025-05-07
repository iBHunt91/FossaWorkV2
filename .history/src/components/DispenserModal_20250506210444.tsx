import React, { useState } from 'react';
import { 
  FiX, 
  FiChevronDown, 
  FiSettings, 
  FiInfo 
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';

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
  sortFuelTypes?: (gradeString: string) => string[];
}

const DispenserModal: React.FC<DispenserModalProps> = ({ 
  isOpen, 
  onClose, 
  dispensers,
  orderId,
  sortFuelTypes
}) => {
  const [expandedTechnicalDetails, setExpandedTechnicalDetails] = useState<number[]>([]);

  // Default implementation for sortFuelTypes
  const defaultSortFuelTypes = (gradeString: string): string[] => {
    return gradeString ? gradeString.split(',').map(type => type.trim()).filter(Boolean) : [];
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
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm"
      onClick={onClose} // Close modal when clicking the backdrop
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>
        
        <div 
          className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle max-w-2xl w-full border border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-white flex items-center">
                <GiGasPump className="mr-3 text-white" size={22} />
                Dispenser Data {orderId && <span className="ml-1 font-normal opacity-90">for Order <span className="font-semibold">#{orderId}</span></span>}
              </h3>
              <button
                className="text-white hover:text-gray-200 focus:outline-none transition-colors p-1 rounded-full hover:bg-blue-700 dark:hover:bg-blue-900"
                onClick={onClose}
                aria-label="Close"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="bg-white dark:bg-gray-800 p-5">
            {dispensers.length > 0 ? (
              <div className="space-y-4 max-h-[calc(85vh-140px)] overflow-y-auto pr-1 scrollbar-thin">
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
                  
                  return (
                    <div 
                      key={index} 
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                    >
                      {/* Condensed single line layout */}
                      <div className="p-4 flex items-center">
                        {/* Dispenser number badge */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white rounded-lg min-w-[52px] px-2 py-1.5 text-sm font-bold shadow-sm mr-4 flex-shrink-0 text-center">
                          {dispenserNumber}
                        </div>
                        
                        {/* Fuel types - middle section */}
                        <div className="flex-1 overflow-x-auto">
                          {dispenser.fields && dispenser.fields.Grade ? (
                            <div className="flex flex-wrap gap-2">
                              {sortFuelTypesImpl(dispenser.fields.Grade).map((grade: string, i: number) => {
                                // Define consistent colors based on fuel type
                                let bgClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
                                let gradeLower = grade.toLowerCase();
                                
                                if (gradeLower.includes('regular')) {
                                  bgClass = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800/30';
                                } else if (gradeLower.includes('plus')) {
                                  bgClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30';
                                } else if (gradeLower.includes('premium')) {
                                  bgClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/30';
                                } else if (gradeLower.includes('diesel')) {
                                  bgClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30';
                                } else if (gradeLower.includes('e-85') || gradeLower.includes('ethanol')) {
                                  bgClass = 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800/30';
                                } else if (gradeLower.includes('super')) {
                                  bgClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/30';
                                } else {
                                  bgClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50';
                                }
                                
                                return (
                                  <span
                                    key={i}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${bgClass}`}
                                  >
                                    {grade.trim()}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No fuel data
                            </div>
                          )}
                        </div>
                        
                        {/* Details button */}
                        <button
                          onClick={() => toggleTechnicalDetails(index)}
                          className="text-xs flex items-center px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 ml-3 flex-shrink-0 transition-colors duration-150 border border-gray-300 dark:border-gray-600"
                        >
                          {expandedTechnicalDetails.includes(index) ? (
                            <>
                              <FiChevronDown className="mr-1.5 h-3 w-3" />
                              Details
                            </>
                          ) : (
                            <>
                              <FiSettings className="mr-1.5 h-3 w-3" />
                              Details
                            </>
                          )}
                        </button>
                      </div>
                        
                      {/* Technical specs - ONLY SHOWN WHEN EXPANDED */}
                      {expandedTechnicalDetails.includes(index) && (
                        <div className="p-4 pt-1 mt-1 border-t border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/50">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {dispenser.make && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium">Make/Model</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {dispenser.make} {dispenser.model && `/ ${dispenser.model}`}
                                </span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Number of Nozzles (per side)'] && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium">Nozzles per side</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Number of Nozzles (per side)']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Meter Type'] && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium">Meter type</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Meter Type']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Stand Alone Code'] && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium">Stand Alone Code</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Stand Alone Code']}</span>
                              </div>
                            )}
                            
                            {dispenser.serial && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium">Serial Number</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.serial}</span>
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
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                  <FiInfo className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">No Dispenser Information</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  This work order does not have any dispenser information available.
                </p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {dispensers.length > 0 ? 
                `${dispensers.length} dispenser${dispensers.length !== 1 ? 's' : ''}` : 
                'No dispensers available'
              }
            </div>
            <div className="flex gap-3">
              {dispensers.length > 0 && (
                <button 
                  type="button" 
                  className="text-sm px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 shadow-sm"
                  onClick={() => {
                    // Toggle all technical details at once
                    if (expandedTechnicalDetails.length === dispensers.length) {
                      setExpandedTechnicalDetails([]);
                    } else {
                      setExpandedTechnicalDetails([...Array(dispensers.length).keys()]);
                    }
                  }}
                >
                  {expandedTechnicalDetails.length === dispensers.length ? 
                    'Hide All Details' : 'Show All Details'}
                </button>
              )}
              <button 
                type="button" 
                className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium shadow-sm focus:outline-none transition-colors duration-150"
                onClick={onClose}
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
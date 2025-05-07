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
  sortFuelTypes: (gradeString: string) => string[];
}

const DispenserModal: React.FC<DispenserModalProps> = ({ 
  isOpen, 
  onClose, 
  dispensers,
  orderId,
  sortFuelTypes
}) => {
  const [expandedTechnicalDetails, setExpandedTechnicalDetails] = useState<number[]>([]);

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
      className="fixed inset-0 z-50 overflow-y-auto"
      onClick={onClose} // Close modal when clicking the backdrop
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>
        
        <div 
          className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-2xl w-full"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 px-6 py-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-white flex items-center">
                <GiGasPump className="mr-2 text-white" size={20} />
                Dispenser Data {orderId && `for Order #${orderId}`}
              </h3>
              <button
                className="text-white hover:text-gray-200 focus:outline-none"
                onClick={onClose}
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="bg-white dark:bg-gray-800 p-4">
            {dispensers.length > 0 ? (
              <div className="space-y-3 max-h-[calc(85vh-130px)] overflow-y-auto pr-1">
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
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"
                    >
                      {/* Condensed single line layout */}
                      <div className="p-3 flex items-center">
                        {/* Dispenser number badge */}
                        <div className="bg-blue-600 text-white rounded-lg min-w-[50px] px-2 py-1 text-sm font-bold shadow-sm mr-3 flex-shrink-0 text-center">
                          {dispenserNumber}
                        </div>
                        
                        {/* Fuel types - middle section */}
                        <div className="flex-1 overflow-x-auto">
                          {dispenser.fields && dispenser.fields.Grade ? (
                            <div className="flex flex-wrap gap-1.5">
                              {sortFuelTypes(dispenser.fields.Grade).map((grade: string, i: number) => {
                                // Define consistent colors based on fuel type
                                let bgClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
                                let gradeLower = grade.toLowerCase();
                                
                                if (gradeLower.includes('regular')) {
                                  bgClass = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
                                } else if (gradeLower.includes('plus')) {
                                  bgClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
                                } else if (gradeLower.includes('premium')) {
                                  bgClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
                                } else if (gradeLower.includes('diesel')) {
                                  bgClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
                                } else if (gradeLower.includes('e-85') || gradeLower.includes('ethanol')) {
                                  bgClass = 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300';
                                } else if (gradeLower.includes('super')) {
                                  bgClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
                                }
                                
                                return (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${bgClass}`}
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
                          className="text-xs flex items-center px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 ml-2 flex-shrink-0"
                        >
                          {expandedTechnicalDetails.includes(index) ? (
                            <>
                              <FiChevronDown className="mr-1 h-3 w-3" />
                              Details
                            </>
                          ) : (
                            <>
                              <FiSettings className="mr-1 h-3 w-3" />
                              Details
                            </>
                          )}
                        </button>
                      </div>
                        
                      {/* Technical specs - ONLY SHOWN WHEN EXPANDED */}
                      {expandedTechnicalDetails.includes(index) && (
                        <div className="p-3 pt-0 mt-1 border-t border-gray-200 dark:border-gray-600">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {dispenser.make && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Make/Model</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {dispenser.make} {dispenser.model && `/ ${dispenser.model}`}
                                </span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Number of Nozzles (per side)'] && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Nozzles per side</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Number of Nozzles (per side)']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Meter Type'] && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Meter type</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Meter Type']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Stand Alone Code'] && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Stand Alone Code</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Stand Alone Code']}</span>
                              </div>
                            )}
                            
                            {dispenser.serial && (
                              <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Serial Number</span>
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
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {dispensers.length > 0 ? 
                `${dispensers.length} dispenser${dispensers.length !== 1 ? 's' : ''}` : 
                'No dispensers available'
              }
            </div>
            <div className="flex gap-2">
              {dispensers.length > 0 && (
                <button 
                  type="button" 
                  className="text-sm px-4 py-1.5 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => {
                    // Toggle all technical details at once
                    if (expandedTechnicalDetails.length === dispensers.length) {
                      setExpandedTechnicalDetails([]);
                    } else {
                      setExpandedTechnicalDetails([...Array(dispensers.length).keys()]);
                    }
                  }}
                >
                  {expandedTechnicalDetails.length === dispensers.length ? 'Hide All Details' : 'Show All Details'}
                </button>
              )}
              <button 
                type="button" 
                className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
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
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

  // Add custom scrollbar styles
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    
    // Add the scrollbar styling CSS
    styleElement.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.25);
      }
      .dark .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      
      .custom-scrollbar-x::-webkit-scrollbar {
        height: 6px;
      }
      .custom-scrollbar-x::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 6px;
      }
      .custom-scrollbar-x::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 6px;
      }
      .custom-scrollbar-x::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.25);
      }
      .dark .custom-scrollbar-x::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      .dark .custom-scrollbar-x::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
      }
      .dark .custom-scrollbar-x::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
      }
    `;
    
    // Append the style element to the head
    document.head.appendChild(styleElement);
    
    // Clean up function to remove the style when component unmounts
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []); // Empty dependency array means this runs once on mount

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
  
  if (!isOpen && !modalVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose} // Close modal when clicking the backdrop
      aria-labelledby="dispenser-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>
        
        <div 
          className={`inline-block align-bottom bg-white dark:bg-gray-800 rounded-xl text-left overflow-hidden shadow-2xl transform transition-all duration-300 sm:my-8 sm:align-middle max-w-3xl w-full border border-gray-200 dark:border-gray-700 ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95 opacity-0'}`}
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 
                className="text-lg leading-6 font-medium text-white flex items-center"
                id="dispenser-modal-title"
              >
                <div className="bg-blue-500/30 p-1.5 rounded-lg mr-3">
                  <GiGasPump className="text-white" size={22} />
                </div>
                <span>Dispenser Data</span> 
                {orderId && (
                  <span className="ml-2 font-normal text-blue-100/90 flex items-center bg-blue-700/30 px-2 py-0.5 rounded-md text-sm">
                    <FiHash className="mr-1 opacity-70" size={14} />
                    <span className="font-semibold">{orderId}</span>
                  </span>
                )}
              </h3>
              <button
                className="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors p-1.5 rounded-full hover:bg-blue-700 dark:hover:bg-blue-900"
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
              <div className="space-y-4 max-h-[calc(85vh-140px)] overflow-y-auto pr-1 custom-scrollbar">
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
                      className={`bg-gray-50 dark:bg-gray-700 rounded-lg border ${isExpanded ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-600'} shadow-sm overflow-hidden hover:shadow-md transition-all duration-200`}
                    >
                      {/* Dispenser card header */}
                      <div 
                        className={`flex items-center ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20 p-4' : 'p-4'}`}
                      >
                        {/* Dispenser number badge */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white rounded-lg min-w-[60px] px-3 py-2 text-base font-bold shadow-sm mr-4 flex-shrink-0 text-center">
                          {dispenserNumber}
                        </div>
                        
                        {/* Fuel types - middle section */}
                        <div className="flex-1 overflow-x-auto custom-scrollbar-x">
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
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${bgClass} shadow-sm flex items-center justify-center`}
                                  >
                                    {grade.trim()}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No fuel data available
                            </div>
                          )}
                        </div>
                        
                        {/* Details button */}
                        <button
                          onClick={() => toggleTechnicalDetails(index)}
                          className={`ml-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                            isExpanded 
                              ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-700' 
                              : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                          aria-expanded={isExpanded}
                          aria-controls={`dispenser-details-${index}`}
                        >
                          {isExpanded ? (
                            <>
                              <FiChevronDown className="h-4 w-4" />
                              <span>Details</span>
                            </>
                          ) : (
                            <>
                              <FiEye className="h-4 w-4" />
                              <span>Details</span>
                            </>
                          )}
                        </button>
                      </div>
                        
                      {/* Technical specs - ONLY SHOWN WHEN EXPANDED */}
                      {isExpanded && (
                        <div 
                          className="p-4 pt-1 mt-1 border-t border-blue-200 dark:border-blue-800/30 bg-gray-50/50 dark:bg-gray-700/50"
                          id={`dispenser-details-${index}`}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {dispenser.make && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium uppercase tracking-wide">Make/Model</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {dispenser.make} {dispenser.model && `/ ${dispenser.model}`}
                                </span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Number of Nozzles (per side)'] && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium uppercase tracking-wide">Nozzles per side</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Number of Nozzles (per side)']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Meter Type'] && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium uppercase tracking-wide">Meter type</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Meter Type']}</span>
                              </div>
                            )}
                            
                            {dispenser.fields && dispenser.fields['Stand Alone Code'] && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium uppercase tracking-wide">Stand Alone Code</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{dispenser.fields['Stand Alone Code']}</span>
                              </div>
                            )}
                            
                            {dispenser.serial && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 shadow-sm hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors duration-200">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 font-medium uppercase tracking-wide">Serial Number</span>
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
              <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                No dispenser data available.
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-750 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-300 font-medium flex items-center">
              <GiGasPump className="mr-2 text-gray-500 dark:text-gray-400" size={16} />
              <span>{dispensers.length} dispensers</span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => expandedTechnicalDetails.length === dispensers.length 
                  ? setExpandedTechnicalDetails([])
                  : setExpandedTechnicalDetails([...Array(dispensers.length).keys()])}
                className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors duration-200 flex items-center"
              >
                <FiEye className="mr-1.5 h-4 w-4" />
                {expandedTechnicalDetails.length === dispensers.length ? 'Collapse All' : 'Show All Details'}
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200"
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
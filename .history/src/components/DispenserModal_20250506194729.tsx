import React, { useState, useMemo } from 'react';
import { 
  FiX, 
  FiChevronDown,
  FiChevronUp,
  FiSettings, 
  FiInfo,
  FiEye,
  FiEyeOff
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
  const [areAllDetailsExpanded, setAreAllDetailsExpanded] = useState<boolean>(false);

  const toggleTechnicalDetails = (index: number) => {
    setExpandedTechnicalDetails(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  const toggleAllDetails = () => {
    if (areAllDetailsExpanded) {
      setExpandedTechnicalDetails([]);
    } else {
      setExpandedTechnicalDetails(dispensers.map((_, index) => index));
    }
    setAreAllDetailsExpanded(!areAllDetailsExpanded);
  };

  // Effect to update areAllDetailsExpanded when individual items cause all to be expanded/collapsed
  React.useEffect(() => {
    if (dispensers.length > 0 && expandedTechnicalDetails.length === dispensers.length) {
      setAreAllDetailsExpanded(true);
    } else if (expandedTechnicalDetails.length === 0) {
      setAreAllDetailsExpanded(false);
    }
  }, [expandedTechnicalDetails, dispensers.length]);
  
  if (!isOpen) return null;

  const getFuelTypeColor = (grade: string) => {
    const gradeLower = grade.toLowerCase();
    if (gradeLower.includes('regular')) return 'bg-green-100 text-green-800 dark:bg-green-700/30 dark:text-green-300';
    if (gradeLower.includes('plus')) return 'bg-blue-100 text-blue-800 dark:bg-blue-700/30 dark:text-blue-300';
    if (gradeLower.includes('premium') || gradeLower.includes('super')) return 'bg-purple-100 text-purple-800 dark:bg-purple-700/30 dark:text-purple-300';
    if (gradeLower.includes('diesel')) return 'bg-amber-100 text-amber-800 dark:bg-amber-700/30 dark:text-amber-300';
    if (gradeLower.includes('e-85') || gradeLower.includes('ethanol')) return 'bg-pink-100 text-pink-800 dark:bg-pink-700/30 dark:text-pink-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-600/30 dark:text-gray-300';
  };

  const memoizedDispensers = useMemo(() => dispensers.map((dispenser, index) => {
    let dispenserNumber = `#${index + 1}`;
    if (dispenser.title) {
      const dualMatch = dispenser.title.match(/^(\d+\/\d+)/);
      if (dualMatch) {
        dispenserNumber = dualMatch[1];
      } else {
        const singleMatch = dispenser.title.match(/^(\d+)\s*-/);
        if (singleMatch) {
          dispenserNumber = singleMatch[1];
        }
      }
    }
    return {
      ...dispenser,
      dispenserNumber,
      isExpanded: expandedTechnicalDetails.includes(index)
    };
  }), [dispensers, expandedTechnicalDetails]);

  return (
    <div 
      className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispenser-modal-title"
    >
      <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 opacity-75 transition-opacity" aria-hidden="true"></div>
      
      <div 
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl transform transition-all sm:my-8 w-full max-w-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 4rem)' }} // Prevents modal from being too tall
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 id="dispenser-modal-title" className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
            <GiGasPump className="mr-3 text-blue-600 dark:text-blue-400" size={24} />
            Dispenser Information {orderId && <span className='text-gray-500 dark:text-gray-400 ml-2'>for Order #{orderId}</span>}
          </h3>
          <button
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow">
          {memoizedDispensers.length > 0 ? (
            <div className="space-y-4">
              {memoizedDispensers.map((dispenser, index) => (
                <div 
                  key={index} 
                  className="bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden transition-all duration-300"
                >
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700 transition-colors" onClick={() => toggleTechnicalDetails(index)}>
                    <div className='flex items-center'>
                      <div className="bg-blue-500 text-white rounded-md w-10 h-10 flex items-center justify-center text-lg font-bold shadow-sm mr-4 flex-shrink-0">
                        {dispenser.dispenserNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        {dispenser.fields?.Grade ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sortFuelTypes(dispenser.fields.Grade).map((grade: string, i: number) => (
                              <span
                                key={i}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getFuelTypeColor(grade)}`}
                              >
                                {grade.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                            No fuel data available
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTechnicalDetails(index); }}
                      className="text-sm flex items-center px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors ml-3 flex-shrink-0"
                      aria-expanded={dispenser.isExpanded}
                    >
                      {dispenser.isExpanded ? 
                        <FiChevronUp className="mr-1.5 h-4 w-4" /> :
                        <FiChevronDown className="mr-1.5 h-4 w-4" />
                      }
                      Details
                    </button>
                  </div>
                    
                  {dispenser.isExpanded && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Technical Specifications:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {dispenser.make && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">Make/Model</span>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {dispenser.make} {dispenser.model && `/ ${dispenser.model}`}
                            </span>
                          </div>
                        )}
                        {dispenser.fields?.['Number of Nozzles (per side)'] && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">Nozzles (per side)</span>
                            <span className="font-medium text-gray-800 dark:text-gray-100">{dispenser.fields['Number of Nozzles (per side)']}</span>
                          </div>
                        )}
                        {dispenser.fields?.['Meter Type'] && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">Meter Type</span>
                            <span className="font-medium text-gray-800 dark:text-gray-100">{dispenser.fields['Meter Type']}</span>
                          </div>
                        )}
                        {dispenser.fields?.['Stand Alone Code'] && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">Stand Alone Code</span>
                            <span className="font-medium text-gray-800 dark:text-gray-100">{dispenser.fields['Stand Alone Code']}</span>
                          </div>
                        )}
                        {dispenser.serial && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">Serial Number</span>
                            <span className="font-medium text-gray-800 dark:text-gray-100">{dispenser.serial}</span>
                          </div>
                        )}
                        {/* Display any other fields dynamically */}
                        {Object.entries(dispenser.fields || {}).map(([key, value]) => {
                          if (['Grade', 'Number of Nozzles (per side)', 'Meter Type', 'Stand Alone Code'].includes(key)) return null;
                          return (
                            <div key={key}>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">{key}</span>
                              <span className="font-medium text-gray-800 dark:text-gray-100">{String(value)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
              <FiInfo className="h-12 w-12 text-blue-500 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-2">No Dispenser Information</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                Dispenser details are not available for this work order, or they may still be loading.
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {memoizedDispensers.length > 0 ? 
              `Displaying ${memoizedDispensers.length} dispenser${memoizedDispensers.length !== 1 ? 's' : ''}` : 
              'No dispensers to display'
            }
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {memoizedDispensers.length > 0 && (
              <button 
                type="button" 
                className="flex-1 sm:flex-initial text-sm px-4 py-2.5 border border-gray-300 dark:border-gray-500 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                onClick={toggleAllDetails}
                aria-pressed={areAllDetailsExpanded}
              >
                {areAllDetailsExpanded ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                {areAllDetailsExpanded ? 'Hide All' : 'Show All'}
              </button>
            )}
            <button 
              type="button" 
              className="flex-1 sm:flex-initial text-sm px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispenserModal; 
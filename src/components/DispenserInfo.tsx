import React, { useState, useEffect, useMemo } from 'react';
import { FiInfo, FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';

// Import fuel grades list
import fuelGrades from '../data/fuel_grades';

interface DispenserInfoProps {
  dispenserHtml: string;
  dispensers?: any[];
  isOpen: boolean;
  onClose: () => void;
}

interface DispenserSpecs {
  make?: string;
  model?: string;
  grade?: string;
  standAloneCode?: string;
  nozzlesPerSide?: string;
  meterType?: string;
  serial?: string;
  title?: string;
}

// Error boundary component
class DispenserErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('DispenserInfo Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl p-6 max-w-md mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Something went wrong</h3>
            <p className="text-gray-700 dark:text-gray-300">There was an error loading the dispenser information. Please try again.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const DispenserInfo: React.FC<DispenserInfoProps> = ({ dispenserHtml, dispensers = [], isOpen, onClose }) => {
  // Always ensure we have a proper HTML string
  const safeDispenserHtml = dispenserHtml || "";

  // Fallback method if dispensers array is not available
  const extractDispenserSpecs = (html: string): DispenserSpecs[] => {
    const specs: DispenserSpecs = {};
    
    // Parse from the main title or header
    const titleMatch = html.match(/(\d\/\d)\s*-\s*(.*?)\s*-\s*([\w-]+)/);
    if (titleMatch) {
      specs.title = titleMatch[0].trim();
      specs.grade = titleMatch[2].trim();
      specs.make = titleMatch[3].trim();
    }
    
    // Extract specific fields
    const makeMatch = html.match(/MAKE:\s*([\w-]+)/i);
    if (makeMatch) specs.make = makeMatch[1].trim();
    
    const modelMatch = html.match(/MODEL:\s*([\w\d-]+)/i);
    if (modelMatch) specs.model = modelMatch[1].trim();
    
    const codeMatch = html.match(/STAND\s*ALONE\s*CODE\s*(\d+)/i);
    if (codeMatch) specs.standAloneCode = codeMatch[1].trim();
    
    const nozzlesMatch = html.match(/NUMBER\s*OF\s*NOZZLES\s*\(PER\s*SIDE\)\s*(\d+)/i);
    if (nozzlesMatch) specs.nozzlesPerSide = nozzlesMatch[1].trim();
    
    const meterTypeMatch = html.match(/METER\s*TYPE\s*([\w-]+)/i);
    if (meterTypeMatch) specs.meterType = meterTypeMatch[1].trim();
    
    return [specs];
  };

  // Extract dispenser specifications from the dispensers array
  const getDispenserSpecs = () => {
    if (!dispensers || dispensers.length === 0) {
      // Only fallback to HTML parsing if dispenserHtml is available
      if (dispenserHtml) {
        return extractDispenserSpecs(safeDispenserHtml);
      }
      return []; // Return empty array if neither dispensers nor dispenserHtml are available
    }

    return dispensers.map((dispenser) => {
      const specs: DispenserSpecs = {
        title: dispenser.title || '',
        serial: dispenser.serial || '',
        make: dispenser.make?.replace('Make: ', '') || '',
        model: dispenser.model?.replace('Model: ', '') || '',
      };

      // Extract fields from the fields object
      if (dispenser.fields) {
        specs.grade = dispenser.fields['Grade'] || '';
        specs.standAloneCode = dispenser.fields['Stand Alone Code'] || '';
        specs.nozzlesPerSide = dispenser.fields['Number of Nozzles (per side)'] || '';
        specs.meterType = dispenser.fields['Meter Type'] || '';
      }

      return specs;
    });
  };

  // Extract dispenser number from title
  const getDispenserNumber = (title: string) => {
    if (!title) return '';
    
    // First check for dual-sided dispensers (e.g., "1/2 - Regular...")
    const dualMatch = title.match(/^(\d+\/\d+)/);
    if (dualMatch) return dualMatch[1];
    
    // Check for single number at the beginning of title (e.g., "13 - Diesel High Flow...")
    // This will work for all dispensers including diesel high flow ones (13, 14)
    const singleMatch = title.match(/^(\d+)\s*-/);
    if (singleMatch) return singleMatch[1];
    
    // If no match, return empty string
    return '';
  };

  // Format fuel grades based on the official list order
  const formatFuelGrades = (gradeString: string | undefined): React.ReactNode => {
    if (!gradeString) return 'Regular, Plus, Premium, Diesel, Super';
    
    // Split by commas, semicolons, or slashes to get individual grades
    const gradeParts = gradeString.split(/[,;\/]+/).map(grade => grade.trim());
    
    // Sort grades according to the order in fuelGrades list
    const sortedGrades = [...gradeParts].sort((a, b) => {
      // Get lowercase versions for case-insensitive comparison
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // Try exact match first for both
      const exactMatchA = fuelGrades.findIndex(grade => 
        grade.toLowerCase() === aLower
      );
      const exactMatchB = fuelGrades.findIndex(grade => 
        grade.toLowerCase() === bLower
      );
      
      // If both have exact matches, use those
      if (exactMatchA !== -1 && exactMatchB !== -1) {
        return exactMatchA - exactMatchB;
      }
      
      // If only one has an exact match, prioritize it
      if (exactMatchA !== -1) return -1;
      if (exactMatchB !== -1) return 1;
      
      // Otherwise, find the best match by finding the shortest containing grade
      // (This prevents "Plus" in "Ethanol-Free Gasoline Plus" from matching with "Plus")
      const bestMatchA = fuelGrades.reduce((best, grade) => {
        if (aLower.includes(grade.toLowerCase()) && 
            (best === -1 || grade.length > fuelGrades[best].length)) {
          return fuelGrades.indexOf(grade);
        }
        return best;
      }, -1);
      
      const bestMatchB = fuelGrades.reduce((best, grade) => {
        if (bLower.includes(grade.toLowerCase()) && 
            (best === -1 || grade.length > fuelGrades[best].length)) {
          return fuelGrades.indexOf(grade);
        }
        return best;
      }, -1);
      
      // If not found in list, put at the end
      if (bestMatchA === -1) return 1;
      if (bestMatchB === -1) return -1;
      
      return bestMatchA - bestMatchB;
    });
    
    // Create a colored badge for each fuel type
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 w-full whitespace-nowrap">
        {sortedGrades.map((grade, idx) => {
          const normalGrade = grade.toLowerCase();
          // Handle "Unleaded" as "Regular" for consistency
          const isRegular = normalGrade.includes('regular') || normalGrade.includes('unleaded');
          
          return (
            <span key={idx} className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap
              ${isRegular ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                normalGrade.includes('plus') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 
                normalGrade.includes('premium') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 
                normalGrade.includes('diesel high flow') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-semibold' : 
                normalGrade.includes('diesel') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 
                normalGrade === 'def' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600' :
                normalGrade.includes('def') ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600' :
                normalGrade.includes('e-85') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                normalGrade.includes('ethanol') ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' :
                normalGrade.includes('super') ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' : 
                'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300'
              }`}
            >
              {grade}
            </span>
          );
        })}
      </div>
    );
  };

  const [expandedDispenser, setExpandedDispenser] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add memoization for dispenser specs to prevent unnecessary recalculations
  const dispenserSpecsList = useMemo(() => getDispenserSpecs(), [dispensers, dispenserHtml]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Reset expanded state when dispensers change
      setExpandedDispenser(null);
      
      // Process the data immediately
      if (dispenserSpecsList.length > 0) {
        setIsLoading(false);
      } else {
        // If no specs found, finish loading after a brief delay to prevent UI flash
        setTimeout(() => setIsLoading(false), 100);
      }
    }
  }, [isOpen, dispenserSpecsList]);

  // Debug if we're missing required data
  useEffect(() => {
    if (!dispenserHtml && (!dispensers || dispensers.length === 0)) {
      console.warn('DispenserInfo has no data to display');
    }
  }, [dispenserHtml, dispensers]);

  useEffect(() => {
    // Add the hidden scrollbar styles to the document
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      // Clean up when component unmounts
      document.head.removeChild(styleElement);
    };
  }, []);

  // Handle backdrop click - only close when clicking outside the modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle dispenser row click to toggle expanded view
  const toggleExpandDispenser = (index: number) => {
    setExpandedDispenser(expandedDispenser === index ? null : index);
  };

  // Early return if not open, AFTER all hooks have been called
  if (!isOpen) {
    console.log('DispenserInfo not shown because isOpen is false');
    return null;
  }

  return (
    <DispenserErrorBoundary>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={handleBackdropClick}>
        <div 
          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl p-0 w-auto min-w-[500px] max-w-4xl mx-4 max-h-[90vh] overflow-hidden transform transition-all flex flex-col border border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold flex items-center">
              <FiInfo className="mr-2 text-blue-600 dark:text-blue-400" /> Dispenser Information
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 p-1 transition-colors"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : dispenserSpecsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                  <thead>
                    <tr className="text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="py-3 px-4 w-[80px]">Dispenser</th>
                      <th className="py-3 px-4 flex-1 min-w-[300px]">Fuels</th>
                      <th className="py-3 px-4 w-[90px] text-center">Meter Type</th>
                      <th className="py-3 px-4 w-[80px] text-center">Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispenserSpecsList.map((spec, index) => (
                      <React.Fragment key={index}>
                        <tr 
                          className={`border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${expandedDispenser === index ? 'bg-gray-50 dark:bg-gray-800/40' : ''}`}
                          onClick={() => toggleExpandDispenser(index)}
                        >
                          <td className="py-3 px-4 w-[80px]">
                            <div className="font-medium flex items-center">
                              {spec.title?.toLowerCase().includes('diesel high flow') ? (
                                <div className="flex items-center">
                                  <GiGasPump className="mr-1.5 text-amber-600 dark:text-amber-400 flex-shrink-0" size={16} /> 
                                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-md px-1.5 py-0.5 text-xs font-semibold">
                                    {getDispenserNumber(spec.title || '')}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <GiGasPump className="mr-1.5 text-blue-600 dark:text-blue-400 flex-shrink-0" size={16} /> 
                                  <span>{getDispenserNumber(spec.title || '') || `#${index + 1}`}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 overflow-x-auto whitespace-nowrap flex-1 min-w-[300px]">
                            {formatFuelGrades(spec.grade)}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs text-center w-[90px]">
                            {spec.meterType || 'Electronic'}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs flex items-center justify-between w-[80px]">
                            <span>{spec.model || '-'}</span>
                            <div className="ml-2 p-0.5 rounded-full bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400">
                              {expandedDispenser === index ? 
                                <FiChevronUp className="flex-shrink-0" size={14} /> : 
                                <FiChevronDown className="flex-shrink-0" size={14} />
                              }
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded details for dispenser */}
                        {expandedDispenser === index && (
                          <tr className="bg-gray-50 dark:bg-gray-800/20">
                            <td colSpan={4} className="py-4 px-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  {spec.title && spec.title.toLowerCase().includes('diesel high flow') && (
                                    <div className="mb-3 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md border border-amber-200 dark:border-amber-800">
                                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400 block mb-1">Special Equipment</span>
                                      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Diesel High Flow Dispenser</span>
                                    </div>
                                  )}
                                  {spec.make && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Make</span>
                                      <span className="text-sm">{spec.make}</span>
                                    </div>
                                  )}
                                  {spec.model && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Model</span>
                                      <span className="text-sm">{spec.model}</span>
                                    </div>
                                  )}
                                  {spec.standAloneCode && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Stand Alone Code</span>
                                      <span className="text-sm">{spec.standAloneCode}</span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  {spec.nozzlesPerSide && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Nozzles Per Side</span>
                                      <span className="text-sm">{spec.nozzlesPerSide}</span>
                                    </div>
                                  )}
                                  {spec.meterType && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Meter Type</span>
                                      <span className="text-sm">{spec.meterType}</span>
                                    </div>
                                  )}
                                  {spec.serial && (
                                    <div className="mb-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Serial</span>
                                      <span className="text-sm font-mono">{spec.serial}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No dispenser information available</p>
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end bg-gray-50 dark:bg-gray-800/20">
            <button
              onClick={onClose}
              className="inline-flex justify-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </DispenserErrorBoundary>
  );
};

export default DispenserInfo; 
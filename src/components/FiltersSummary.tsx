import React from 'react';
import { FiFilter } from 'react-icons/fi';

// Define the filter type interface
interface FilterType {
  type: string;
  count: number;
  fuelType: 'GAS' | 'DIESEL' | 'DEF' | 'UNKNOWN';
}

interface FilterTotals {
  gas: number;
  diesel: number;
  types: Record<string, number>;
}

interface FiltersSummaryProps {
  filterTotals: FilterTotals;
  gasBoxes: number;
  dieselBoxes: number;
  specificFilterTypes: {
    gas: string[];
    diesel: string[];
  };
}

const FiltersSummary: React.FC<FiltersSummaryProps> = ({ 
  filterTotals, 
  gasBoxes, 
  dieselBoxes,
  specificFilterTypes
}) => {
  // Map filter types to their categories
  const getFilterTypeClass = (type: string): string => {
    // Check for diesel filter types
    if (type.toLowerCase().includes('diesel') || 
        type.toLowerCase().includes('kerosene')) {
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200';
    }
    
    // Check for DEF filter types
    if (type.toLowerCase().includes('def') || 
        type.toLowerCase().includes('exhaust')) {
      return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50 text-purple-800 dark:text-purple-200';
    }
    
    // Default to gas filter types
    return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200';
  };

  return (
    <div className="pt-4">
      {/* Filter types summary - Featured prominently at the top */}
      {Object.keys(filterTotals.types).length > 0 && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filter Types Needed:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(filterTotals.types)
              .sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
              .map(([type, count]) => (
                <div 
                  key={type} 
                  className={`px-2.5 py-1.5 rounded border text-sm flex items-center ${getFilterTypeClass(type)}`}
                >
                  <span className="font-medium">{type}:</span>
                  <span className="ml-1">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Overview cards for total filters - Now secondary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Gas filters card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center">
                <FiFilter className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400">Gas Filters</h4>
                <div className="flex items-center">
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{filterTotals.gas}</p>
                  <p className="ml-2 text-sm text-blue-600 dark:text-blue-400">
                    ({gasBoxes} box{gasBoxes !== 1 ? 'es' : ''})
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Gas filter types */}
          {specificFilterTypes.gas.length > 0 && (
            <div className="mt-3 border-t border-blue-200 dark:border-blue-800/50 pt-2">
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-1.5">Specific Types:</p>
              <div className="flex flex-wrap gap-1.5">
                {specificFilterTypes.gas.map((type, index) => (
                  <span 
                    key={`gas-${index}`} 
                    className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800/40 text-blue-800 dark:text-blue-200 rounded text-xs"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Diesel filters card */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
                <FiFilter className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400">Diesel Filters</h4>
                <div className="flex items-center">
                  <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{filterTotals.diesel}</p>
                  <p className="ml-2 text-sm text-amber-600 dark:text-amber-400">
                    ({dieselBoxes} box{dieselBoxes !== 1 ? 'es' : ''})
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Diesel filter types */}
          {specificFilterTypes.diesel.length > 0 && (
            <div className="mt-3 border-t border-amber-200 dark:border-amber-800/50 pt-2">
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-1.5">Specific Types:</p>
              <div className="flex flex-wrap gap-1.5">
                {specificFilterTypes.diesel.map((type, index) => (
                  <span 
                    key={`diesel-${index}`} 
                    className="px-2 py-0.5 bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 rounded text-xs"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FiltersSummary;
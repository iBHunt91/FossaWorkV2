import React from 'react';
import { FiFilter } from 'react-icons/fi';

// Define filter data types
interface FilterCardData {
  gasModel: string;
  dieselModel: string;
  gasCount: number;
  dieselCount: number;
  gasBoxes: number;
  dieselBoxes: number;
  totalFilters: number;
  totalBoxes: number;
}

interface FiltersByTypeProps {
  filterCards: FilterCardData[];
}

const FiltersByType: React.FC<FiltersByTypeProps> = ({ filterCards }) => {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center">
          <span className="mr-2">
            <FiFilter />
          </span>
          Filter Breakdown
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Detailed analysis of filter inventory needs by type
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filterCards.map((card, index) => (
          <div 
            key={index} 
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <h4 className="font-medium text-gray-800 dark:text-white flex items-center">
                <FiFilter className="text-primary-500 mr-2" />
                {card.gasModel} / {card.dieselModel}
              </h4>
            </div>

            <div className="p-4">
              <div className="flex justify-between mb-5">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Filters</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.totalFilters}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Boxes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.totalBoxes}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full mb-6 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-500" 
                  style={{ 
                    width: `${(card.gasCount / card.totalFilters) * 100}%`,
                    borderRadius: card.dieselCount === 0 ? '9999px' : '9999px 0 0 9999px' 
                  }}
                ></div>
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-500 -mt-2" 
                  style={{ 
                    width: `${(card.dieselCount / card.totalFilters) * 100}%`,
                    marginLeft: `${(card.gasCount / card.totalFilters) * 100}%`,
                    borderRadius: card.gasCount === 0 ? '9999px' : '0 9999px 9999px 0'
                  }}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Gas */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                  <div className="flex items-center mb-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Gas</span>
                  </div>
                  <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{card.gasCount}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 flex justify-between">
                    <span>{card.gasModel}</span>
                    <span>{card.gasBoxes} box{card.gasBoxes !== 1 ? 'es' : ''}</span>
                  </div>
                </div>

                {/* Diesel */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/50">
                  <div className="flex items-center mb-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Diesel</span>
                  </div>
                  <div className="text-xl font-bold text-amber-900 dark:text-amber-100">{card.dieselCount}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex justify-between">
                    <span>{card.dieselModel}</span>
                    <span>{card.dieselBoxes} box{card.dieselBoxes !== 1 ? 'es' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FiltersByType;
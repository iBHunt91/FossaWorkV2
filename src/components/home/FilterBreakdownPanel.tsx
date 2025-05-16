import React from 'react';
import { FiAlertTriangle, FiBox } from 'react-icons/fi';

interface FilterType {
  partNumber: string;
  type: string;
  quantity: number;
  stores: string[];
  orderId?: string;
  filterType?: string;
}

interface FilterBreakdownPanelProps {
  filterNeeds: FilterType[];
  loading: boolean;
}

const FilterBreakdownPanel: React.FC<FilterBreakdownPanelProps> = ({ filterNeeds, loading }) => {
  // Function to get total quantity for a filter type
  const getTotalQuantity = (filterType: string): number => {
    return filterNeeds
      .filter(need => need.type === filterType)
      .reduce((sum, need) => sum + need.quantity, 0);
  };

  // Function to calculate boxes needed
  const getBoxesNeeded = (quantity: number): number => {
    return Math.ceil(quantity / 6);
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading filter data...</div>
        </div>
      ) : (
        <>
          {filterNeeds.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400">No filter data available or all filters are in stock.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                {/* Summary boxes for each filter type */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Premier Plus Filters</h3>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalQuantity('premierplus')}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">filters needed</p>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center">
                        <FiBox className="mr-1 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{getBoxesNeeded(getTotalQuantity('premierplus'))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Phase Coalescer Filters</h3>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalQuantity('phasecoalescer')}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">filters needed</p>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center">
                        <FiBox className="mr-1 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{getBoxesNeeded(getTotalQuantity('phasecoalescer'))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">DEF Filters</h3>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalQuantity('def')}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">filters needed</p>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center">
                        <FiBox className="mr-1 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{getBoxesNeeded(getTotalQuantity('def'))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Particulate Filters</h3>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalQuantity('particulate')}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">filters needed</p>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center">
                        <FiBox className="mr-1 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{getBoxesNeeded(getTotalQuantity('particulate'))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed breakdown for each filter type */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Filter Part #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Stores
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filterNeeds.map((need, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {need.partNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {need.type === 'premierplus'
                            ? 'Premier Plus'
                            : need.type === 'phasecoalescer'
                            ? 'Phase Coalescer'
                            : need.type === 'def'
                            ? 'DEF'
                            : 'Particulate'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {need.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex flex-wrap gap-1">
                            {need.stores.map((store, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              >
                                {store}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Note about filters */}
              <div className="mt-4 flex items-start">
                <FiAlertTriangle className="mt-1 mr-2 text-yellow-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This data is calculated based on filter data gathered from previous service visits. Actual filter needs may vary.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FilterBreakdownPanel;

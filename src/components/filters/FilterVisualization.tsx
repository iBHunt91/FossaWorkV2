import React, { useMemo } from 'react';
import { FiInfo, FiBox, FiPieChart, FiBarChart2 } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { WorkOrder } from '../../types';
import { ExtendedFilterNeed } from './FilterTypes';
import FilterUtils from './FilterUtils';

interface FilterVisualizationProps {
  filterNeeds: ExtendedFilterNeed[];
  workOrders: WorkOrder[];
  isLoading: boolean;
}

/**
 * Component for visualizing filter distribution
 * Shows charts and graphs for filter data
 * Updated styling to match Schedule.tsx design patterns
 */
const FilterVisualization: React.FC<FilterVisualizationProps> = ({ 
  filterNeeds, 
  workOrders,
  isLoading 
}) => {
  // Calculate filter distribution by part number
  const filterDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    
    filterNeeds.forEach(need => {
      const partNumber = need.partNumber || 'Unknown';
      if (!distribution[partNumber]) {
        distribution[partNumber] = 0;
      }
      distribution[partNumber] += need.quantity;
    });
    
    return distribution;
  }, [filterNeeds]);

  // Calculate filter usage by store
  const filterByStore = useMemo(() => {
    const stores: Record<string, { 
      count: number; 
      storeName: string;
      storeType: string;
      boxes: number;
      partNumbers: Set<string>;
    }> = {};
    
    filterNeeds.forEach(need => {
      // Create a key that combines store name and ID to ensure uniqueness
      const storeKey = `${need.storeName}_${need.orderId.split('_')[0]}`;
      
      if (!stores[storeKey]) {
        // Determine store type from store name
        let storeType = 'Other';
        const storeName = need.storeName.toLowerCase();
        
        if (storeName.includes('7-eleven') || storeName.includes('7 eleven') || storeName.includes('7-11') || 
            storeName.includes('speedway') || storeName.includes('marathon')) {
          storeType = '7-Eleven';
        } else if (storeName.includes('circle') && storeName.includes('k')) {
          storeType = 'Circle K';
        } else if (storeName.includes('wawa')) {
          storeType = 'Wawa';
        }
        
        stores[storeKey] = {
          count: 0,
          storeName: need.storeName,
          storeType,
          boxes: 0,
          partNumbers: new Set()
        };
      }
      
      // Add to the store totals
      stores[storeKey].count += need.quantity;
      stores[storeKey].boxes += FilterUtils.calculateBoxesNeeded(need.quantity, need.partNumber);
      stores[storeKey].partNumbers.add(need.partNumber);
    });
    
    return stores;
  }, [filterNeeds]);

  // Group stores by type for display
  const storesByType = useMemo(() => {
    const byType: Record<string, {
      storeCount: number;
      filterCount: number;
      boxCount: number;
    }> = {
      '7-Eleven': { storeCount: 0, filterCount: 0, boxCount: 0 },
      'Circle K': { storeCount: 0, filterCount: 0, boxCount: 0 },
      'Wawa': { storeCount: 0, filterCount: 0, boxCount: 0 },
      'Other': { storeCount: 0, filterCount: 0, boxCount: 0 }
    };
    
    Object.values(filterByStore).forEach(store => {
      byType[store.storeType].storeCount++;
      byType[store.storeType].filterCount += store.count;
      byType[store.storeType].boxCount += store.boxes;
    });
    
    return byType;
  }, [filterByStore]);

  // Calculate max value for bar scaling
  const maxValue = useMemo(() => {
    const values = Object.values(filterDistribution);
    return values.length > 0 ? Math.max(...values) : 0;
  }, [filterDistribution]);

  return (
    <div>
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : filterNeeds.length === 0 ? (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          <FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />
          No filter data available for visualization.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {/* Filter Part Numbers Distribution - Styled like Schedule.tsx cards */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <FiBarChart2 className="w-4 h-4 mr-2 text-blue-500" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter Part Numbers Distribution
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(filterDistribution).map(([partNumber, count]) => {
                const boxesNeeded = FilterUtils.calculateBoxesNeeded(count, partNumber);
                
                // Determine color based on part number
                const barColor = 
                  partNumber.includes('MB') ? 'bg-blue-500' :
                  partNumber.includes('HS') ? 'bg-green-500' :
                  partNumber.includes('MG') ? 'bg-orange-500' :
                  'bg-purple-500';
                
                return (
                  <div key={partNumber} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <GiGasPump className="w-3.5 h-3.5 mr-1.5 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium text-blue-600 dark:text-blue-400">
                          {partNumber}
                          {partNumber === '800HS-30' && ' (High Flow)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {count} filters
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          {boxesNeeded} boxes
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`${barColor} h-2.5 rounded-full`} 
                        style={{ width: `${(count / maxValue) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Filter Usage by Store Type - Styled like Schedule.tsx cards */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <FiPieChart className="w-4 h-4 mr-2 text-green-500" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter Usage by Store Type
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(storesByType)
                .filter(([_, data]) => data.storeCount > 0) // Only show store types with stores
                .map(([type, data]) => {
                  // Determine color based on store type
                  const barColor = 
                    type === '7-Eleven' ? 'bg-green-500 dark:bg-green-600' :
                    type === 'Circle K' ? 'bg-red-500 dark:bg-red-600' :
                    type === 'Wawa' ? 'bg-purple-500 dark:bg-purple-600' :
                    'bg-gray-500 dark:bg-gray-600';
                    
                  const badgeColor =
                    type === '7-Eleven' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                    type === 'Circle K' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    type === 'Wawa' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                    'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
                  
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {data.filterCount} filters
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`}>
                            {data.storeCount} stores
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                        <div 
                          className={`${barColor} h-2.5 rounded-full`}
                          style={{ width: `${Math.min(100, (data.filterCount / maxValue) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          
          {/* Box Requirements Summary - Styled like Schedule.tsx cards */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <FiBox className="w-4 h-4 mr-2 text-amber-500" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Box Requirements Summary
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(filterDistribution).map(([partNumber, count]) => {
                  const boxesNeeded = FilterUtils.calculateBoxesNeeded(count, partNumber);
                  const perBox = partNumber === '800HS-30' ? 6 : 12;
                  
                  // Determine badge color based on part number
                  const badgeColor = 
                    partNumber.includes('MB') ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300' :
                    partNumber.includes('HS') ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                    partNumber.includes('MG') ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300' :
                    'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300';
                  
                  return (
                    <div key={partNumber} className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium text-blue-600 dark:text-blue-400 ${badgeColor}`}>
                          {partNumber}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {perBox}/box
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Total Filters
                        </div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {count}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Boxes Needed
                        </div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {boxesNeeded}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Work Order Summary - Styled like Schedule.tsx overview panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <FiInfo className="w-4 h-4 mr-2 text-primary-500" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Summary Overview
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
                  <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                    Work Orders
                  </h4>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Orders:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{workOrders.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">With Filters:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {new Set(filterNeeds.map(need => need.orderId)).size}
                    </span>
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg">
                  <h4 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                    Store Types
                  </h4>
                  {Object.entries(storesByType)
                    .filter(([_, data]) => data.storeCount > 0)
                    .map(([type, data]) => (
                      <div key={type} className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{type}:</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {data.storeCount}
                        </span>
                      </div>
                    ))}
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg">
                  <h4 className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">
                    Filters
                  </h4>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Quantity:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {filterNeeds.reduce((sum, need) => sum + need.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Filter Types:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {Object.keys(filterDistribution).length}
                    </span>
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg">
                  <h4 className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
                    Boxes
                  </h4>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Boxes:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {filterNeeds.reduce((sum, need) => sum + FilterUtils.calculateBoxesNeeded(need.quantity, need.partNumber), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Avg per Order:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {Math.round(filterNeeds.reduce((sum, need) => sum + FilterUtils.calculateBoxesNeeded(need.quantity, need.partNumber), 0) / 
                        (new Set(filterNeeds.map(need => need.orderId)).size || 1) * 10) / 10}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterVisualization;
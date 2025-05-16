import React, { useState, useEffect } from 'react';
import { FiBox } from 'react-icons/fi';

// This is a standalone example of the Filter Breakdown component
// You can implement this in Home.tsx

const FilterBreakdown = ({ filterTotals }) => {
  // Get all filter types from the work orders
  const filterTypes = Object.keys(filterTotals.types);
  
  // Group similar filter types (gas/diesel pairs)
  const filterPairs = [
    { types: ['450MB-10', '450MG-10'], description: 'Standard Flow' },
    { types: ['400MB-10', '400HS-10'], description: 'High Flow' },
    { types: ['40510D-AD', '40530W-AD'], description: 'Electronic Dispenser' },
    { types: ['40510A-AD', '40510W-AD'], description: 'Standard Dispenser' }
  ];
  
  // Find which pairs are present in our data
  const presentPairs = filterPairs.filter(pair => 
    pair.types.some(type => filterTypes.includes(type))
  );
  
  // Get filters that don't belong to any pair
  const singleFilters = filterTypes.filter(type => 
    !filterPairs.flatMap(pair => pair.types).includes(type)
  );
  
  // Calculate grid columns based on number of cards
  const getGridColumnsClass = (itemCount) => {
    // For mobile, always 1 column
    // For medium screens and up, adjust based on item count
    switch (itemCount) {
      case 1: return 'grid-cols-1 md:grid-cols-1';
      case 2: return 'grid-cols-1 md:grid-cols-2';
      case 3: return 'grid-cols-1 md:grid-cols-3';
      case 4: return 'grid-cols-1 md:grid-cols-4';
      case 5: return 'grid-cols-1 md:grid-cols-5';
      case 6: return 'grid-cols-1 md:grid-cols-6';
      default: return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4';
    }
  };

  return (
    <div className="panel mb-6 animate-fadeIn delay-100">
      <div className="panel-header flex items-center justify-between">
        <div>
          <h3 className="panel-title flex items-center">
            <FiBox className="mr-2 text-primary-500 dark:text-primary-400" /> 
            Filter Breakdown
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed analysis of filter inventory needs by type</p>
        </div>
      </div>
      
      <div className="space-y-6 mt-4">
        {/* Paired filters section */}
        {presentPairs.length > 0 && (
          <div>
            <div className={`grid ${getGridColumnsClass(presentPairs.length)} gap-4 auto-rows-fr w-full`}>
              {presentPairs.map((pair, idx) => {
                const presentTypes = pair.types.filter(type => filterTypes.includes(type));
                
                // Get quantities for comparison
                const quantities = pair.types.map(type => {
                  if (!filterTypes.includes(type)) return 0;
                  return filterTotals.types[type] || 0;
                });
                
                // Sum of all quantities for this pair
                const totalQuantity = quantities.reduce((sum, qty) => sum + qty, 0);
                
                return (
                  <div key={idx} className="border dark:border-gray-700 rounded-lg overflow-hidden h-full flex flex-col">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-600">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {presentTypes.join(' / ')}
                      </div>
                    </div>
                    
                    <div className="p-3 flex-grow flex flex-col">
                      <div className="flex items-center mb-1">
                        <div className="w-24 text-xs font-medium text-gray-500 dark:text-gray-400">Total Filters:</div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 ml-2">{totalQuantity}</div>
                      </div>
                      
                      <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-1.5">
                        {pair.types.map((type, index) => {
                          if (!filterTypes.includes(type)) return null;
                          const quantity = filterTotals.types[type] || 0;
                          // Calculate width as percentage of total for this pair
                          const widthPercent = totalQuantity > 0 ? (quantity / totalQuantity) * 100 : 0;
                          // Determine if gas or diesel based on part number pattern
                          const isGas = type.includes('MB') || type.includes('510A') || type.includes('510D');
                          
                          return (
                            <div 
                              key={type} 
                              className={`h-2 rounded-full ${isGas ? 'bg-blue-500 dark:bg-blue-600' : 'bg-amber-500 dark:bg-amber-600'}`} 
                              style={{ 
                                width: `${widthPercent}%`,
                                float: 'left',
                                borderTopRightRadius: index === pair.types.length - 1 ? '0.25rem' : '0',
                                borderBottomRightRadius: index === pair.types.length - 1 ? '0.25rem' : '0'
                              }}
                              title={`${type}: ${quantity} filters`}
                            ></div>
                          );
                        })}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-auto pt-4">
                        {pair.types.map(type => {
                          if (!filterTypes.includes(type)) return null;
                          
                          const quantity = filterTotals.types[type] || 0;
                          // Determine if gas or diesel based on part number pattern
                          const isGas = type.includes('MB') || type.includes('510A') || type.includes('510D');
                          const filterCategory = isGas ? 'Gas' : 'Diesel';
                          const bgColorClass = isGas ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20';
                          const borderColorClass = isGas ? 'border-blue-100 dark:border-blue-800/30' : 'border-amber-100 dark:border-amber-800/30';
                          
                          return (
                            <div key={type} className={`border ${borderColorClass} rounded-lg p-3 ${bgColorClass} h-full flex flex-col`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-center">
                                  <span className={`inline-block w-3 h-3 rounded-full mr-1.5 ${isGas ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                                  <span className="font-medium text-gray-800 dark:text-gray-200">
                                    {filterCategory}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className="text-xl font-bold text-gray-700 dark:text-gray-300">{quantity}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Individual filters section */}
        {singleFilters.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Individual Filters</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 auto-rows-fr">
              {singleFilters.map(type => {
                const quantity = filterTotals.types[type] || 0;
                // Determine if gas or diesel based on part number pattern
                const isGas = type.includes('MB') || type.includes('510A') || type.includes('510D');
                const colorClass = isGas ? 'bg-blue-500 dark:bg-blue-600' : 'bg-amber-500 dark:bg-amber-600';
                const bgColorClass = isGas ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20';
                const borderColorClass = isGas ? 'border-blue-100 dark:border-blue-800/30' : 'border-amber-100 dark:border-amber-800/30';
                
                return (
                  <div key={type} className={`border ${borderColorClass} rounded-lg p-3 ${bgColorClass} h-full flex flex-col`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {isGas ? 'Gas' : 'Diesel'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{quantity}</span>
                        <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">filters</span>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                        <div 
                          className={`h-2 rounded-full ${colorClass}`}
                          style={{ width: `${Math.min(100, quantity * 10)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBreakdown;
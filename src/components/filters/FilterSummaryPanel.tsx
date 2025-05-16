import React, { useMemo, useState } from 'react';
import { FiBarChart2, FiDownload, FiFilter, FiInfo } from 'react-icons/fi';
import { CSVLink } from 'react-csv';
import { ExtendedFilterNeed, CSVFilterSummary } from './FilterTypes';
import FilterUtils from './FilterUtils';

interface FilterSummaryPanelProps {
  filterNeeds: ExtendedFilterNeed[];
  isLoading: boolean;
  selectedFilterType: string | null;
  onFilterTypeChange: (filterType: string | null) => void;
}

/**
 * Component for displaying filter summary and export functionality
 * Shows filter needs grouped by type with quantity totals
 * Updated styling to match Schedule.tsx design patterns
 */
const FilterSummaryPanel: React.FC<FilterSummaryPanelProps> = ({ 
  filterNeeds, 
  isLoading,
  selectedFilterType,
  onFilterTypeChange
}) => {
  // Group filter needs by part number (rather than type categories)
  const groupedFilterNeeds = useMemo(() => {
    const grouped: Record<string, {
      count: number;
      boxes: number;
      filters: ExtendedFilterNeed[];
    }> = {};
    
    filterNeeds.forEach(need => {
      // Use part number as the grouping key
      const partNumber = need.partNumber || 'Unknown';
      
      if (!grouped[partNumber]) {
        grouped[partNumber] = {
          count: 0,
          boxes: 0,
          filters: []
        };
      }
      
      grouped[partNumber].count += need.quantity;
      // Special case for 800HS-30 which is 6 per box instead of 12
      const boxesNeeded = partNumber === '800HS-30' ? 
        Math.ceil(need.quantity / 6) : 
        Math.ceil(need.quantity / 12);
      
      grouped[partNumber].boxes += boxesNeeded;
      grouped[partNumber].filters.push(need);
    });
    
    return grouped;
  }, [filterNeeds]);

  // Handle filter part number selection
  const handleFilterTypeClick = (partNumber: string) => {
    onFilterTypeChange(selectedFilterType === partNumber ? null : partNumber);
  };

  // Get display name for filter types
  const getFilterTypeDisplayName = (type: string): string => {
    // Follow format in original Filters.tsx
    switch (type) {
      case 'GAS': return 'Gas';
      case 'DIESEL': return 'Diesel';
      case 'DEF': return 'DEF';
      case 'Unknown': return 'Unknown';
      default: return type;
    }
  };

  // Prepare CSV data for export with format matching the original
  const csvData = useMemo((): CSVFilterSummary[] => {
    return filterNeeds.map(need => ({
      'Part Number': need.partNumber,
      'Quantity': need.quantity,
      'Boxes Needed': need.partNumber === '800HS-30' ? 
        Math.ceil(need.quantity / 6) : 
        Math.ceil(need.quantity / 12),
      'Stores': need.stores.join(', '),
      'Visit ID': need.visitId,
      'Date': need.visitDate
    }));
  }, [filterNeeds]);

  return (
    <div>
      {/* Panel Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : filterNeeds.length === 0 ? (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          <FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />
          No filter needs found for the selected date range. Try adjusting your search criteria.
        </div>
      ) : (
        <>
          {/* Summary Cards - More responsive grid with Schedule.tsx styling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
            {Object.entries(groupedFilterNeeds).map(([type, data]) => {
              // Determine card styling based on filter type
              let cardBgColor = 'bg-white dark:bg-gray-800';
              let borderColor = selectedFilterType === type ? 
                'border-primary-500 dark:border-primary-500' :
                'border-gray-200 dark:border-gray-700';
              let hoverColor = 'hover:bg-gray-50 dark:hover:bg-gray-700';
              
              // Apply styling based on part number
              if (type.includes('CIM')) {
                // CimTek filters use blue accent
                cardBgColor = selectedFilterType === type ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800';
              } else if (type.includes('800HS')) {
                // 800HS filters use green accent
                cardBgColor = selectedFilterType === type ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800';
              } else if (type.includes('DEF')) {
                // DEF filters use purple accent
                cardBgColor = selectedFilterType === type ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-white dark:bg-gray-800';
              }
              
              return (
                <div 
                  key={type}
                  onClick={() => handleFilterTypeClick(type)}
                  className={`p-4 rounded-lg border ${borderColor} ${cardBgColor} cursor-pointer transition-colors ${hoverColor} shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {type} 
                      {type === '800HS-30' && ' (High Flow)'}
                    </h3>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {data.count}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Filters
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {data.boxes}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Boxes
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Total Summary - Styled more like the Schedule.tsx cards */}
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 mx-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Filters
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {filterNeeds.reduce((total, need) => total + need.quantity, 0)}
                </p>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Boxes
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {filterNeeds.reduce((total, need) => 
                    total + FilterUtils.calculateBoxesNeeded(need.quantity, need.partNumber), 0)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterSummaryPanel;
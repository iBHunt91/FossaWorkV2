import React, { useMemo, useState } from 'react';
import { 
  FiChevronLeft, 
  FiChevronRight, 
  FiEdit, 
  FiCheck, 
  FiX,
  FiArrowUp,
  FiArrowDown,
  FiEye,
  FiCalendar,
  FiInfo,
  FiAlertTriangle
} from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { format } from 'date-fns';
import { WorkOrder } from '../../types';
import { ExtendedFilterNeed, SortConfig } from './FilterTypes';
import FilterUtils from './FilterUtils';

interface FilterDetailsPanelProps {
  filterNeeds: ExtendedFilterNeed[];
  workOrders: WorkOrder[];
  isLoading: boolean;
  selectedFilterType: string | null;
  sortConfig: SortConfig | null;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig | null>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  onOpenDispenserModal: (orderId: string, dispensers: any[], visitId: string) => void;
  onUpdateFilterQuantity?: (orderId: string, partNumber: string, quantity: number) => void;
  onRevertFilterQuantity?: (orderId: string, partNumber: string) => void;
}

/**
 * Component for displaying detailed filter information
 * Shows filter details in a paginated table with sorting and editing capabilities
 * Updated styling to match Schedule.tsx design patterns
 */
const FilterDetailsPanel: React.FC<FilterDetailsPanelProps> = ({ 
  filterNeeds, 
  workOrders,
  isLoading,
  selectedFilterType,
  sortConfig,
  setSortConfig,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  onOpenDispenserModal,
  onUpdateFilterQuantity,
  onRevertFilterQuantity
}) => {
  // State for editing filter quantities
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [editedQuantity, setEditedQuantity] = useState<number>(0);

  // Load previous edits when component mounts
  React.useEffect(() => {
    if (!isLoading) {
      // Check if there are any edits in localStorage
      try {
        const storedEdits = localStorage.getItem('filterQuantityEdits');
        if (storedEdits) {
          const edits = JSON.parse(storedEdits);
          console.log('Found stored edits:', Object.keys(edits).length);
        }
      } catch (error) {
        console.error('Error checking stored edits:', error);
      }
    }
  }, [isLoading]);

  // Filter needs based on selected filter type
  const filteredNeeds = useMemo(() => {
    if (!selectedFilterType) return filterNeeds;
    return filterNeeds.filter(need => need.partNumber === selectedFilterType);
  }, [filterNeeds, selectedFilterType]);

  // Group filter needs by visit date and then by visit ID
  const groupedByDate = useMemo(() => {
    const grouped = new Map<string, Map<string, ExtendedFilterNeed[]>>();
    
    filteredNeeds.forEach(need => {
      const dateString = need.visitDate ? format(new Date(need.visitDate), 'yyyy-MM-dd') : 'No Date';
      if (!grouped.has(dateString)) {
        grouped.set(dateString, new Map<string, ExtendedFilterNeed[]>());
      }
      
      const dateGroup = grouped.get(dateString)!;
      const visitId = need.visitId || 'Unknown';
      
      if (!dateGroup.has(visitId)) {
        dateGroup.set(visitId, []);
      }
      
      dateGroup.get(visitId)!.push(need);
    });
    
    return grouped;
  }, [filteredNeeds]);

  // Convert the nested map into a flat array for rendering
  const groupedFilterNeeds = useMemo(() => {
    const result: {
      dateString: string;
      formattedDate: string;
      visitGroups: {
        visitId: string;
        displayVisitId: string;
        needs: ExtendedFilterNeed[];
      }[];
    }[] = [];
    
    // Sort date keys
    const sortedDates = Array.from(groupedByDate.keys()).sort();
    
    sortedDates.forEach(dateString => {
      const visitGroups: {
        visitId: string;
        displayVisitId: string;
        needs: ExtendedFilterNeed[];
      }[] = [];
      
      const dateGroup = groupedByDate.get(dateString)!;
      
      // Sort visit IDs within each date
      const sortedVisitIds = Array.from(dateGroup.keys()).sort((a, b) => {
        return FilterUtils.extractVisitNumber(a).localeCompare(
          FilterUtils.extractVisitNumber(b), undefined, { numeric: true }
        );
      });
      
      sortedVisitIds.forEach(visitId => {
        visitGroups.push({
          visitId,
          displayVisitId: FilterUtils.extractVisitNumber(visitId),
          needs: dateGroup.get(visitId)!
        });
      });
      
      result.push({
        dateString,
        formattedDate: dateString === 'No Date' ? 'Not Scheduled' : 
                      format(new Date(dateString), 'MMM d, yyyy'),
        visitGroups
      });
    });
    
    return result;
  }, [groupedByDate]);

  // Paginate the grouped data
  const paginatedData = useMemo(() => {
    // Calculate how many date groups to show per page
    // This is a simplification - in a real implementation you might want to count
    // the total number of rows and paginate based on that
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return groupedFilterNeeds.slice(startIndex, endIndex);
  }, [groupedFilterNeeds, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(groupedFilterNeeds.length / itemsPerPage);
  }, [groupedFilterNeeds, itemsPerPage]);

  // Handle editing filter quantity
  const handleEditQuantity = (filterId: string, currentQuantity: number) => {
    setEditingFilterId(filterId);
    // Use a default of 1 if quantity is 0, otherwise use the current quantity
    setEditedQuantity(currentQuantity > 0 ? currentQuantity : 1);
  };

  // Save edited quantity
  const handleSaveQuantity = (orderId: string, partNumber: string) => {
    // In a real implementation, you would save this to a backend
    // For now, we'll just update localStorage
    saveEditedQuantity(orderId, partNumber, editedQuantity);
    
    // Call the callback if provided to update the parent state
    if (onUpdateFilterQuantity) {
      onUpdateFilterQuantity(orderId, partNumber, editedQuantity);
    }
    
    // Clear the editing state
    setEditingFilterId(null);
    
    // Log success
    console.log(`Updated quantity for ${partNumber} to ${editedQuantity}`);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingFilterId(null);
  };

  // Save edited quantity to localStorage
  const saveEditedQuantity = (orderId: string, partNumber: string, quantity: number) => {
    try {
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      const edits = storedEdits ? JSON.parse(storedEdits) : {};
      
      const key = `${orderId}_${partNumber}`;
      edits[key] = quantity;
      
      localStorage.setItem('filterQuantityEdits', JSON.stringify(edits));
    } catch (error) {
      console.error('Error saving edited quantity to localStorage', error);
    }
  };
  
  // Handle reverting edited quantity
  const handleRevertQuantity = (orderId: string, partNumber: string) => {
    // Remove from localStorage
    try {
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      if (storedEdits) {
        const edits = JSON.parse(storedEdits);
        const key = `${orderId}_${partNumber}`;
        if (key in edits) {
          delete edits[key];
          localStorage.setItem('filterQuantityEdits', JSON.stringify(edits));
        }
      }
    } catch (error) {
      console.error('Error removing edited quantity from localStorage', error);
    }
    
    // Call the callback if provided
    if (onRevertFilterQuantity) {
      onRevertFilterQuantity(orderId, partNumber);
    }
    
    // Log success
    console.log(`Reverted quantity for ${partNumber}`);
  };

  // Handle viewing dispenser data
  const handleViewDispenserData = (orderId: string, visitId: string) => {
    // Find matching work order
    const order = workOrders.find(o => o.id === orderId);
    
    if (order && order.dispensers && order.dispensers.length > 0) {
      // Pass both orderId and visitId to ensure the correct visit is shown
      onOpenDispenserModal(orderId, order.dispensers, visitId);
    } else {
      alert('No dispenser data available for this work order');
    }
  };

  // Pagination navigation
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  return (
    <div>
      {/* Panel Header Info - Updated with Schedule.tsx styling */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
          <span className="font-medium">Filter Details:</span> 
          <span className="ml-2">{filteredNeeds.length} items</span>
          {selectedFilterType && (
            <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs">
              Filtered: {selectedFilterType}
            </span>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        )}
      </div>
      
      {/* Panel Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredNeeds.length === 0 ? (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          <FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />
          No filter details found for the selected criteria.
        </div>
      ) : (
        <>
          {/* Filter Details - Styled like Schedule.tsx cards */}
          <div className="p-2 sm:p-4 space-y-5">
            {paginatedData.map(dateGroup => (
              <div key={dateGroup.dateString} className="rounded-md overflow-hidden shadow-sm">
                {/* Date header with improved styling */}
                <div className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 flex items-center justify-between rounded-t-md">
                  <div className="flex items-center">
                    <FiCalendar className="mr-2" />
                    <span className="font-medium">{dateGroup.formattedDate}</span>
                  </div>
                  <div className="flex items-center bg-white dark:bg-blue-800 text-blue-700 dark:text-white px-2 py-1 rounded-md">
                    <span className="text-xs font-bold">{dateGroup.visitGroups.length}</span>
                    <span className="text-xs ml-1">visit{dateGroup.visitGroups.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                {/* Visit Groups within this date */}
                <div className="bg-blue-50 dark:bg-blue-900/10 pt-3 pb-2 px-3 rounded-b-md divide-y divide-blue-100 dark:divide-blue-800/20">
                  {dateGroup.visitGroups.map((visitGroup, visitIndex) => {
                    const isFirst = visitIndex === 0;
                    const isLast = visitIndex === dateGroup.visitGroups.length - 1;
                    
                    // Get store type for styling
                    const storeName = visitGroup.needs[0].storeName || '';
                    const storeType = 
                      storeName.toLowerCase().includes('7-eleven') ? '7-eleven' :
                      storeName.toLowerCase().includes('circle k') ? 'circle-k' :
                      storeName.toLowerCase().includes('wawa') ? 'wawa' : 'other';
                    
                    // Custom styling based on store type
                    const storeStyles = getStoreTypeStyles(storeType);
                    
                    return (
                      <div key={visitGroup.visitId} className={`py-3 ${!isLast ? 'mb-2' : ''} relative`}>
                        {/* Same day indicator badge - only on non-first items */}
                        {!isFirst && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full z-10 whitespace-nowrap shadow-sm">
                            Same Day
                          </div>
                        )}
                        
                        {/* Styled card with store info */}
                        <div className={`p-3 rounded-lg border-l-4 ${storeStyles.cardBorder} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm`}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                              {visitGroup.needs[0].storeName}
                              <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${storeStyles.badge}`}>
                                #{visitGroup.displayVisitId}
                              </span>
                            </div>
                            <button
                              onClick={() => handleViewDispenserData(visitGroup.needs[0].orderId, visitGroup.visitId)}
                              className="p-1.5 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded shadow-sm transition-colors"
                              title="View Dispenser Data"
                            >
                              <GiGasPump className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {/* Filter needs table */}
                          <div className="overflow-hidden bg-gray-50 dark:bg-gray-900/20 rounded-md mt-3">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50">
                                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Filter Type
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Quantity
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Action
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {visitGroup.needs.map((need) => (
                                  <tr key={`${need.orderId}-${need.partNumber}`} className={`hover:bg-gray-100 dark:hover:bg-gray-800 ${need.hasWarnings ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                                    <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                                      <span className="font-medium text-sm text-blue-600 dark:text-blue-400">
                                        {need.partNumber}
                                        {need.partNumber === '800HS-30' && ' (High Flow)'}
                                      </span>
                                      {need.hasWarnings && (
                                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded-sm text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/20">
                                          Calculation Issue
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center font-medium text-gray-800 dark:text-gray-200">
                                      {editingFilterId === `${need.orderId}-${need.partNumber}` ? (
                                        <input
                                          type="number"
                                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                                          value={editedQuantity}
                                          onChange={(e) => setEditedQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                                          min="1"
                                          autoFocus
                                        />
                                      ) : need.hasWarnings && need.quantity === 0 && !need.isDefaulted ? (
                                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 rounded-full flex items-center justify-center">
                                          <FiAlertTriangle className="mr-1" />
                                          Unknown
                                        </span>
                                      ) : need.isDefaulted ? (
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-full">
                                          {need.quantity} <span className="text-xs text-blue-600 dark:text-blue-400">(Default)</span>
                                        </span>
                                      ) : need.isEdited ? (
                                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 rounded-full">
                                          {need.quantity} <span className="text-xs text-purple-600 dark:text-purple-400">(Edited)</span>
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-full">
                                          {need.quantity}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-center">
                                      {editingFilterId === `${need.orderId}-${need.partNumber}` ? (
                                        <div className="flex items-center justify-center space-x-1">
                                          <button
                                            onClick={() => handleSaveQuantity(need.orderId, need.partNumber)}
                                            className="p-1 bg-green-500 hover:bg-green-600 text-white rounded"
                                            title="Save"
                                          >
                                            <FiCheck className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            className="p-1 bg-red-500 hover:bg-red-600 text-white rounded"
                                            title="Cancel"
                                          >
                                            <FiX className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : need.isEdited ? (
                                        <div className="flex items-center justify-center space-x-1">
                                          <button
                                            onClick={() => handleEditQuantity(`${need.orderId}-${need.partNumber}`, need.quantity)}
                                            className="p-1 bg-purple-500 hover:bg-purple-600 text-white rounded"
                                            title="Edit Quantity"
                                          >
                                            <FiEdit className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleRevertQuantity(need.orderId, need.partNumber)}
                                            className="p-1 bg-gray-500 hover:bg-gray-600 text-white rounded"
                                            title="Revert to Original"
                                          >
                                            <FiArrowUp className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleEditQuantity(`${need.orderId}-${need.partNumber}`, need.quantity)}
                                          className={`p-1 ${need.hasWarnings ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded`}
                                          title={need.hasWarnings ? "Edit Default Quantity" : "Edit Quantity"}
                                        >
                                          <FiEdit className="w-3 h-3" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination - Improved styling */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  title="Previous Page"
                >
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="text-sm text-gray-700 dark:text-gray-300 px-2">
                  <span className="font-medium">{currentPage}</span> / {totalPages}
                </div>
                
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  title="Next Page"
                >
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Helper function to get store styling based on type (similar to Schedule.tsx)
const getStoreTypeStyles = (storeType: string) => {
  switch (storeType.toLowerCase()) {
    case '7-eleven':
      return {
        cardBorder: 'border-green-500',
        badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      };
    case 'circle-k':
      return {
        cardBorder: 'border-red-500',
        badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      };
    case 'wawa':
      return {
        cardBorder: 'border-purple-500',
        badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
      };
    default:
      return {
        cardBorder: 'border-blue-500',
        badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      };
  }
};

// Helper function to get user-friendly filter descriptions
const getFilterTypeDescription = (partNumber: string): string => {
  switch (partNumber) {
    case '450MB-10':
      return 'Wawa Gas Filter';
    case '450MG-10':
      return 'Wawa Diesel Filter';
    case '400MB-10':
      return 'Gas Filter';
    case '400HS-10':
      return 'Diesel Filter';
    case '800HS-30':
      return 'High Flow Filter';
    case '40510A-AD':
      return 'Ecometer Gas Filter';
    case '40510W-AD':
      return 'Ecometer Diesel Filter';
    case '40510D-AD':
      return 'Circle K Gas Filter';
    case '40530W-AD':
      return 'Circle K Diesel Filter';
    default:
      return 'Standard Filter';
  }
};

export default FilterDetailsPanel;
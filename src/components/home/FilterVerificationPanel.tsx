import React, { useState, useEffect } from 'react';
import { 
  FiAlertTriangle, 
  FiFilter, 
  FiShoppingBag, 
  FiCheck, 
  FiX,
  FiClock,
  FiInfo
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { WorkOrder } from '../../types/workOrder';
import FilterBreakdownPanel from './FilterBreakdownPanel';

// Define the types we need
interface ExtendedFilterWarning {
  message: string;
  severity: string | number;
  orderId: string;
  storeName: string;
  partNumber?: string;
  filterType?: string;
  missingDispenserData?: boolean;
}

interface FilterNeedType {
  partNumber: string;
  type: string;
  quantity: number;
  stores: string[];
  orderId?: string;
  filterType?: string;
}

// Import HomeUtils and create wrapper functions for the methods we need
import * as HomeUtils from './HomeUtils';

interface FilterVerificationPanelProps {
  workOrders: WorkOrder[];
  dispenserData: any;
  loading: boolean;
  dateRanges: {
    currentWeekStart: Date;
    currentWeekEnd: Date;
    nextWeekStart: Date;
    nextWeekEnd: Date;
  };
}

const FilterVerificationPanel: React.FC<FilterVerificationPanelProps> = ({
  workOrders,
  dispenserData,
  loading,
  dateRanges
}) => {
  const [activeTab, setActiveTab] = useState<'warnings' | 'filters'>('warnings');
  const [isLoading, setIsLoading] = useState(true);
  const [warnings, setWarnings] = useState<ExtendedFilterWarning[]>([]);
  const [filterNeeds, setFilterNeeds] = useState<FilterNeedType[]>([]);

  // Load data when component mounts or dependencies change
  useEffect(() => {
    console.log('===== FilterVerificationPanel effect triggered =====');
    console.log('workOrders count:', workOrders?.length || 0);
    console.log('dispenserData available:', !!dispenserData);
    console.log('loading state:', loading);
    console.log('Date ranges:', {
      currentWeekStart: dateRanges.currentWeekStart.toISOString(),
      currentWeekEnd: dateRanges.currentWeekEnd.toISOString(),
      nextWeekStart: dateRanges.nextWeekStart.toISOString(),
      nextWeekEnd: dateRanges.nextWeekEnd.toISOString(),
    });
    
    let isComponentMounted = true;
    
    const loadData = async () => {
      console.log('FilterVerificationPanel loadData started');
      setIsLoading(true);
      
      try {
        console.log('FilterVerificationPanel processing', workOrders?.length || 0, 'work orders');
        
        if (workOrders && workOrders.length > 0) {
          // Debug check for work order formats
          const firstOrder = workOrders[0];
          console.log('Sample work order:', {
            id: firstOrder.id,
            scheduledDate: firstOrder.scheduledDate,
            hasDispensers: firstOrder.dispensers && firstOrder.dispensers.length > 0,
            dispenserCount: firstOrder.dispensers?.length || 0,
            customer: firstOrder.customer
          });
          
          // Generate warnings with timing
          console.time('generateWarningsFromWorkOrders');
          const warningResults = generateWarningsFromWorkOrders(workOrders, dispenserData);
          console.timeEnd('generateWarningsFromWorkOrders');
          console.log('Generated', warningResults.length, 'filter warnings');
          
          // Only update state if component is still mounted
          if (isComponentMounted) {
            setWarnings(warningResults);
          
            // Generate filter needs with timing
            console.time('generateFilterNeeds');
            const filterResults = generateFilterNeeds(workOrders);
            console.timeEnd('generateFilterNeeds');
            console.log('Generated', filterResults.length, 'filter needs');
            setFilterNeeds(filterResults);
          }
        } else {
          console.log('No work orders available, clearing data');
          if (isComponentMounted) {
            setWarnings([]);
            setFilterNeeds([]);
          }
        }
      } catch (error) {
        console.error('Error loading verification data:', error);
        console.error('Error stack:', error.stack);
      } finally {
        if (isComponentMounted) {
          console.log('FilterVerificationPanel loadData complete, setting isLoading to false');
          setIsLoading(false);
        }
      }
    };
    
    // Use a small delay to prevent rapid re-renders
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      console.log('===== FilterVerificationPanel effect cleanup =====');
      isComponentMounted = false;
      clearTimeout(timeoutId);
    };
  }, [workOrders, dispenserData, dateRanges]);

  // Function to generate warnings from work orders
  const generateWarningsFromWorkOrders = (workOrders: WorkOrder[], dispenserData: any): ExtendedFilterWarning[] => {
    const warnings: ExtendedFilterWarning[] = [];
    
    console.log(`Processing ${workOrders.length} work orders for filter warnings`);
    console.log(`Dispenser data available:`, dispenserData ? true : false);
    
    workOrders.forEach(order => {
      try {
        // Only process orders in the current and next week timeframe
        const scheduledDate = order.scheduledDate ? new Date(order.scheduledDate) : 
                             order.visits?.nextVisit?.date ? new Date(order.visits.nextVisit.date) :
                             order.createdDate ? new Date(order.createdDate) : null;
        
        if (!scheduledDate) return;
        
        const isRelevant = scheduledDate >= dateRanges.currentWeekStart && 
                          scheduledDate <= dateRanges.nextWeekEnd;
        
        if (!isRelevant) return;
        
        console.log(`Processing order: ${order.id} - ${getDisplayName(order)}`);
        console.log(`Order has dispensers: ${order.dispensers && order.dispensers.length > 0}`);
        
        // Calculate filter warnings for this order
        const calculationResult = calculateFiltersSafely(order);
        
        // Extract warnings array if available, otherwise use the result as is if it's already an array
        const orderWarnings = calculationResult && calculationResult.warnings ? 
                             calculationResult.warnings : 
                             Array.isArray(calculationResult) ? calculationResult : [];
        
        // Don't add a "missing dispenser data" warning if the order actually has dispenser data
        if ((!order.dispensers || order.dispensers.length === 0) && orderWarnings.length === 0) {
          console.log(`No dispensers found in order ${order.id}`);
          
          // Check if this order exists in the context data
          if (dispenserData && dispenserData.dispensers) {
            const dispenserExists = Array.isArray(dispenserData.dispensers) && 
              dispenserData.dispensers.some(d => d.orderId === order.id);
              
            if (dispenserExists) {
              console.log(`But found dispenser data in the context for order ${order.id}`);
              // We have dispenser data in the context, so we don't need to add a warning
            } else {
              // Add a warning about missing dispenser data if we don't have any other warnings
              warnings.push({
                message: 'Missing dispenser data, cannot determine filter requirements',
                severity: 'medium',
                orderId: order.id,
                storeName: getDisplayName(order),
                missingDispenserData: true
              });
            }
          } else {
            // Add a warning about missing dispenser data if we don't have any other warnings
            warnings.push({
              message: 'Missing dispenser data, cannot determine filter requirements',
              severity: 'medium',
              orderId: order.id,
              storeName: getDisplayName(order),
              missingDispenserData: true
            });
          }
        }
        
        // Convert basic warnings to extended warnings with additional data
        orderWarnings.forEach((warning: any) => {
          if (warning.warning) {
            warnings.push({
              message: warning.warning,
              severity: warning.severity === undefined ? 'medium' : 
                       typeof warning.severity === 'number' ? 
                       (warning.severity > 7 ? 'high' : warning.severity > 3 ? 'medium' : 'low') : 
                       warning.severity,
              orderId: order.id,
              storeName: getDisplayName(order),
              partNumber: warning.partNumber || undefined,
              filterType: warning.filterType || undefined
            });
          }
        });
      } catch (error) {
        console.error('Error calculating filter warnings for order:', order.id, error);
        // Add a fallback warning if an error occurs
        warnings.push({
          message: 'Error processing filter data',
          severity: 'medium',
          orderId: order.id,
          storeName: getDisplayName(order)
        });
      }
    });
    
    return warnings;
  };

  // Utility functions to access HomeUtils safely
  const calculateFiltersSafely = (order: WorkOrder): any[] => {
    try {
      // Check if the utility function exists
      if (typeof HomeUtils.calculateFiltersSafely === 'function') {
        const result = HomeUtils.calculateFiltersSafely(order);
        return Array.isArray(result) ? result : [];
      } else if (typeof HomeUtils.calculateFilters === 'function') {
        const result = HomeUtils.calculateFilters(order);
        return Array.isArray(result) ? result : [];
      }
      return [];
    } catch (error) {
      console.error('Error calculating filters:', error);
      return [];
    }
  };

  const getDisplayName = (order: WorkOrder): string => {
    try {
      if (typeof HomeUtils.getDisplayName === 'function') {
        return HomeUtils.getDisplayName(order) || order.id || 'Unknown';
      }
      // Fallback display name logic
      return order.customer?.name || order.id || 'Unknown';
    } catch (error) {
      return order.id || 'Unknown';
    }
  };

  const checkForSpecialFuelTypes = (order: WorkOrder): { hasDEF: boolean; hasDieselHighFlow: boolean } => {
    try {
      if (typeof HomeUtils.checkForSpecialFuelTypes === 'function') {
        return HomeUtils.checkForSpecialFuelTypes(order);
      }
      return { hasDEF: false, hasDieselHighFlow: false };
    } catch (error) {
      return { hasDEF: false, hasDieselHighFlow: false };
    }
  };

  // Generate filter needs from work orders - always provide standard filters
  const generateFilterNeeds = (workOrders: WorkOrder[]): FilterNeedType[] => {
    const filterMap: Record<string, FilterNeedType> = {};
    
    console.log(`Generating filter needs for ${workOrders.length} work orders`);

    // Standard filter types we always want to show
    const standardFilters = [
      { partNumber: 'PCP-2-1', type: 'premierplus', name: 'Premier Plus Filter' },
      { partNumber: 'PCN-2-1', type: 'phasecoalescer', name: 'Phase Coalescer Filter' },
      { partNumber: 'DEF-1', type: 'def', name: 'DEF Filter' }
    ];
    
    // Track which orders are in the date range
    const relevantOrders: WorkOrder[] = [];

    // First pass: filter orders by date range and collect relevant ones
    workOrders.forEach(order => {
      try {
        // Check if the order is in the current/next week date range
        const scheduledDate = order.scheduledDate ? new Date(order.scheduledDate) : 
                             order.visits?.nextVisit?.date ? new Date(order.visits.nextVisit.date) :
                             order.createdDate ? new Date(order.createdDate) : null;
      
        if (!scheduledDate) return;
        
        const isRelevant = scheduledDate >= dateRanges.currentWeekStart && 
                           scheduledDate <= dateRanges.nextWeekEnd;
                           
        if (isRelevant) {
          relevantOrders.push(order);
        }
      } catch (error) {
        console.error('Error processing order dates:', error);
      }
    });
    
    console.log(`Found ${relevantOrders.length} orders in date range`);
    
    // If we have relevant orders but no filter data was calculated,
    // generate default filters to ensure the UI shows something
    if (relevantOrders.length > 0) {
      // Initialize with standard filters
      standardFilters.forEach(filter => {
        const key = `${filter.partNumber}-${filter.type}`;
        // Initialize with at least one of each filter type
        filterMap[key] = {
          partNumber: filter.partNumber,
          type: filter.type,
          quantity: 1, 
          stores: [], // Will be populated below
          filterType: filter.type
        };
      });
      
      // Second pass: process each relevant order for filter data
      relevantOrders.forEach(order => {
        const { hasDEF, hasDieselHighFlow } = checkForSpecialFuelTypes(order);
        const storeName = getDisplayName(order);
        
        // Try to get filter data from the calculation
        const calculationResult = calculateFiltersSafely(order);
        console.log(`Filter calculation for ${order.id}:`, calculationResult);
        
        // Get gas/diesel filter counts or estimate from dispensers/services
        let gasFilters = 0;
        let dieselFilters = 0;
        
        if (calculationResult && calculationResult.gasFilters) {
          gasFilters = calculationResult.gasFilters;
        } else if (order.dispensers && order.dispensers.length > 0) {
          // Estimate: 2 filters per dispenser if no specific count
          gasFilters = order.dispensers.length * 2;
        } else if (order.services?.find(s => s.type === "Meter Calibration")?.quantity) {
          // Fallback to service count if available
          gasFilters = order.services.find(s => s.type === "Meter Calibration")?.quantity || 2;
        } else {
          // Default fallback
          gasFilters = 2;
        }
        
        if (calculationResult && calculationResult.dieselFilters) {
          dieselFilters = calculationResult.dieselFilters;
        } else if (hasDEF || hasDieselHighFlow) {
          dieselFilters = 1;
        }
        
        // Ensure we have Premier Plus filters (gas) for each order
        const premierPlusKey = 'PCP-2-1-premierplus';
        filterMap[premierPlusKey].quantity += gasFilters - 1; // -1 because we start with 1
        if (!filterMap[premierPlusKey].stores.includes(storeName)) {
          filterMap[premierPlusKey].stores.push(storeName);
        }
        
        // Add Phase Coalescer (diesel) if needed
        if (dieselFilters > 0) {
          const phaseCoeKey = 'PCN-2-1-phasecoalescer';
          filterMap[phaseCoeKey].quantity += dieselFilters; 
          if (!filterMap[phaseCoeKey].stores.includes(storeName)) {
            filterMap[phaseCoeKey].stores.push(storeName);
          }
        }
        
        // Add DEF filter if detected
        if (hasDEF) {
          const defKey = 'DEF-1-def';
          filterMap[defKey].quantity += 1;
          if (!filterMap[defKey].stores.includes(storeName)) {
            filterMap[defKey].stores.push(storeName);
          }
        }
        
        // Process any specific warnings with part numbers from the calculation
        const filterWarnings = calculationResult && calculationResult.warnings ? 
                             calculationResult.warnings : 
                             Array.isArray(calculationResult) ? calculationResult : [];
        
        if (filterWarnings && Array.isArray(filterWarnings) && filterWarnings.length > 0) {
          filterWarnings.forEach((warning: any) => {
            if (warning.partNumber && warning.partNumber !== 'PCP-2-1' && warning.partNumber !== 'PCN-2-1') {
              const partNumber = warning.partNumber;
              let filterType = '';
              
              if (partNumber.includes('PCP')) {
                filterType = 'premierplus';
              } else if (partNumber.includes('PCN')) {
                filterType = 'phasecoalescer';
              } else if (hasDEF && partNumber.includes('DEF')) {
                filterType = 'def';
              } else {
                filterType = 'particulate';
              }
              
              // Only add non-standard filters here (we already have the standard ones)
              if (partNumber !== 'PCP-2-1' && partNumber !== 'PCN-2-1' && partNumber !== 'DEF-1') {
                const key = `${partNumber}-${filterType}`;
                if (filterMap[key]) {
                  filterMap[key].quantity += 1;
                  if (!filterMap[key].stores.includes(storeName)) {
                    filterMap[key].stores.push(storeName);
                  }
                } else {
                  filterMap[key] = {
                    partNumber,
                    type: filterType,
                    quantity: 1,
                    stores: [storeName],
                    orderId: order.id,
                    filterType
                  };
                }
              }
            }
          });
        }
      });
    }
    
    // Only include filters that have stores associated with them
    const result = Object.values(filterMap).filter(filter => filter.stores.length > 0);
    
    console.log(`Generated ${result.length} filter types with store associations`);
    
    return result;
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getFilterTypeColor = (filterType: string): string => {
    switch (filterType) {
      case 'premierplus':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'phasecoalescer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'def':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'particulate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === 'warnings'
              ? 'text-primary-600 border-b-2 border-primary-600 dark:text-primary-400 dark:border-primary-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('warnings')}
        >
          <FiAlertTriangle className="inline mr-2" />
          Filter Warnings
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === 'filters'
              ? 'text-primary-600 border-b-2 border-primary-600 dark:text-primary-400 dark:border-primary-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('filters')}
        >
          <FiFilter className="inline mr-2" />
          Filter Breakdown
        </button>
      </div>

      {/* Loading state */}
      {(loading || isLoading) && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading data...</span>
        </div>
      )}

      {/* Content based on active tab */}
      {!loading && !isLoading && (
        <>
          {activeTab === 'warnings' && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Filter Verification Warnings
              </h3>
              
              {warnings.length === 0 ? (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md flex items-center">
                  <FiCheck className="text-green-500 dark:text-green-400 mr-2" />
                  <span className="text-green-700 dark:text-green-300">No filter warnings found for the current and next week jobs.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {warnings.map((warning, index) => (
                    <div 
                      key={`${warning.orderId}-${index}`}
                      className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">
                            {warning.storeName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Order ID: {warning.orderId}
                          </div>
                          <div className={`mt-1 text-sm ${getSeverityColor(warning.severity)}`}>
                            <FiAlertTriangle className="inline mr-1" />
                            {warning.message}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(warning.severity)}`}>
                          {warning.severity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'filters' && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Filter Need Breakdown
              </h3>
              
              {filterNeeds.length === 0 ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md flex items-center">
                  <FiInfo className="text-blue-500 dark:text-blue-400 mr-2" />
                  <span className="text-blue-700 dark:text-blue-300">No filter needs identified for the current and next week jobs.</span>
                </div>
              ) : (
                <FilterBreakdownPanel filterNeeds={filterNeeds} loading={isLoading} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FilterVerificationPanel;

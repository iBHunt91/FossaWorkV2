import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FiFilter, 
  FiInfo,
  FiRefreshCw,
  FiBarChart2,
  FiAlertTriangle,
  FiList,
  FiCalendar
} from 'react-icons/fi';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { useDispenserData } from '../../context/DispenserContext';
import { WorkOrder } from '../../types';
import DateSelector from './DateSelector';
import FilterSummaryPanel from './FilterSummaryPanel';
import FilterWarningsPanel from './FilterWarningsPanel';
import FilterDetailsPanel from './FilterDetailsPanel';
import FilterVisualization from './FilterVisualization';
import DispenserModal from '../../components/DispenserModal';
import FilterUtils from './FilterUtils';
import Panel from './Panel';
import { ExtendedFilterNeed, ExtendedFilterWarning } from './FilterTypes';
import { useJobData } from './useJobData';

/**
 * Main content component for the Filters page
 * Manages the state and data flow for all filter-related components
 * Updated styling to match Schedule.tsx design patterns
 */
const FiltersContent: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { addToast } = useToast();
  const { dispenserData } = useDispenserData();
  
  // Use the job data hook for loading work orders
  const { workOrders, isLoading, reloadData } = useJobData();
  
  const [filterNeeds, setFilterNeeds] = useState<ExtendedFilterNeed[]>([]);
  const [filterWarnings, setFilterWarnings] = useState<Map<string, ExtendedFilterWarning[]>>(new Map());
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [sortConfig, setSortConfig] = useState<{ key: 'visitId' | 'store' | 'date'; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dispenserToastShown, setDispenserToastShown] = useState(() => {
    return sessionStorage.getItem('dispenserToastShown') === 'true';
  });
  
  // Define week as Monday (1) to Sunday (0)
  const workWeekStart = 1; // Monday
  const workWeekEnd = 0;   // Sunday
  
  // Dispenser Modal States
  const [currentDispenserInfo, setCurrentDispenserInfo] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const [currentDispenserData, setCurrentDispenserData] = useState<any[]>([]);
  const [hasDispenserInfo, setHasDispenserInfo] = useState(false);
  
  // Filter Type Selection
  const [selectedFilterType, setSelectedFilterType] = useState<string | null>(null);
  
  // Visualization
  const [showVisualization, setShowVisualization] = useState(false);

  // Refs for processing state
  const isProcessingRef = useRef(false);

  // Flag to track if data has been manually edited
  const [dataEdited, setDataEdited] = useState(false);

  // Load saved edits from localStorage
  const loadSavedEdits = () => {
    try {
      const storedEdits = localStorage.getItem('filterQuantityEdits');
      if (storedEdits) {
        const edits = JSON.parse(storedEdits);
        return edits;
      }
    } catch (error) {
      console.error('Error loading saved edits from localStorage', error);
    }
    return {};
  };

  // Get the date ranges for the current work week
  const dateRanges = useMemo(() => 
    FilterUtils.getWorkWeekDateRanges(workWeekStart, workWeekEnd, currentWeek),
    [workWeekStart, workWeekEnd, currentWeek]
  );

  // Filter work orders based on date ranges
  const filteredWorkOrders = useMemo(() => {
    return FilterUtils.filterWorkOrdersByDate(workOrders, dateRanges);
  }, [workOrders, dateRanges]);

  // Generate filter needs from work orders, including those with warnings
  useEffect(() => {
    // Skip processing if we have no work orders or are already loading or processing
    // Also skip if data has been manually edited
    if (isProcessingRef.current || isLoading || dataEdited) {
      console.log("Skipping filter generation - already processing or data edited");
      return;
    }
    
    // Only process if we have actual work orders
    if (!filteredWorkOrders || filteredWorkOrders.length === 0) {
      console.log("No filtered work orders to process");
      setFilterNeeds([]);
      setFilterWarnings(new Map());
      return;
    }
    
    console.log(`Processing ${filteredWorkOrders.length} filtered work orders for filter data`);
    isProcessingRef.current = true;
    
    try {
      // Generate filter needs
      const needs = FilterUtils.generateFilterNeeds(filteredWorkOrders);
      console.log(`Generated ${needs.length} filter needs`);
      setFilterNeeds(needs);
      
      // Generate filter warnings
      const warnings = FilterUtils.generateFilterWarnings(filteredWorkOrders, dispenserData);
      console.log(`Generated warnings for ${warnings.size} orders`);
      setFilterWarnings(warnings);
      
      // Ensure any orders with warnings but no filters are included in the filter needs
      // This makes sure orders with "Unknown fuel grade(s)" show up in the filter details
      filteredWorkOrders.forEach(order => {
        if (warnings.has(order.id) && !needs.some(need => need.orderId === order.id)) {
          // Create a dummy filter need to ensure the order appears in the UI
          const storeName = FilterUtils.getDisplayName(order);
          const visitId = Object.values(order.visits || {})[0]?.visitId || 'Unknown';
          const visitDate = Object.values(order.visits || {})[0]?.date || new Date().toISOString();
          
          const stationType = 
            (storeName.includes('7-Eleven') || 
            storeName.includes('Speedway') || 
            storeName.includes('Marathon')) ? '7-Eleven' :
            storeName.includes('Wawa') ? 'Wawa' : 'Circle K';
          
          // Use the most appropriate filter type based on the warnings
          const orderWarnings = warnings.get(order.id) || [];
          
          // Initialize with a default filter
          let partNumber = '400MB-10'; // Default gas filter
          let filterType = 'GAS';
          
          // Check warnings to determine the right filter type
          for (const warning of orderWarnings) {
            if (warning.partNumber) {
              partNumber = warning.partNumber;
              filterType = FilterUtils.getFilterCategory(partNumber);
              break;
            }
          }
          
          // Add a placeholder filter need with 0 quantity to ensure visibility
          const isWawa = storeName.includes('Wawa');
          
          if (isWawa) {
            // For Wawa, always default to 450MB-10 (gas) and 450MG-10 (diesel)
            // Default values: 2 450MB-10 and 1 450MG-10 per dispenser
            
            // Estimate the number of dispensers - default to 6 if we can't determine
            const dispensers = order.dispensers || [];
            const dispenserCount = dispensers.length > 0 ? dispensers.length : 6;
            
            // Add gas filter with default quantity (2 per dispenser)
            needs.push({
              partNumber: '450MB-10',
              type: 'GAS',
              quantity: dispenserCount * 2, // 2 gas filters per dispenser
              stores: [storeName],
              stationType,
              orderId: order.id,
              visitId,
              visitDate,
              storeName,
              hasWarnings: true, // Flag this as a warning placeholder
              isDefaulted: true  // Flag this as using default values
            });
            
            // Add diesel filter with default quantity (1 per dispenser)
            needs.push({
              partNumber: '450MG-10',
              type: 'DIESEL',
              quantity: dispenserCount * 1, // 1 diesel filter per dispenser
              stores: [storeName],
              stationType,
              orderId: order.id,
              visitId,
              visitDate,
              storeName,
              hasWarnings: true, // Flag this as a warning placeholder
              isDefaulted: true  // Flag this as using default values
            });
          } else {
            // For non-Wawa stores with calculation issues, just add a placeholder
            needs.push({
              partNumber,
              type: filterType,
              quantity: 0, // Zero quantity indicates it's a warning placeholder
              stores: [storeName],
              stationType,
              orderId: order.id,
              visitId,
              visitDate,
              storeName,
              hasWarnings: true // Flag this as a warning placeholder
            });
          }
        }
      });
      
      // Update filter needs with the enhanced list
      console.log(`Updated filter needs to include warning-only orders: ${needs.length} total needs`);
      
      // Apply any saved edits from localStorage
      const savedEdits = loadSavedEdits();
      if (Object.keys(savedEdits).length > 0) {
        console.log('Applying saved edits from localStorage', savedEdits);
        
        // Apply edits to needs
        needs.forEach(need => {
          const editKey = `${need.orderId}_${need.partNumber}`;
          if (editKey in savedEdits) {
            // Apply the saved edit
            need.quantity = savedEdits[editKey];
            need.isEdited = true;
            console.log(`Applied saved edit: ${need.partNumber} => ${need.quantity}`);
          }
        });
        
        // Mark as edited to prevent automatic regeneration
        setDataEdited(true);
      }
      
      setFilterNeeds(needs);
      
    } catch (error) {
      console.error('Error generating filter data:', error);
      console.error('Error details:', error);
      addToast('error', 'Error generating filter data. Please try again.');
    } finally {
      isProcessingRef.current = false;
    }
  }, [filteredWorkOrders, dispenserData, addToast, isLoading, dataEdited]);

  // Handle opening dispenser modal
  const handleOpenDispenserModal = (orderId: string, dispensers: any[], visitId: string) => {
    setSelectedOrderId(orderId);
    setCurrentDispenserData(dispensers);
    setCurrentVisitId(visitId); // Store the visit ID
    setHasDispenserInfo(true);
  };

  // Handle closing dispenser modal
  const handleCloseDispenserModal = () => {
    setSelectedOrderId(null);
    setCurrentVisitId(null);
    setCurrentDispenserData([]);
    setHasDispenserInfo(false);
  };

  // Handle changing filter type
  const handleFilterTypeChange = (filterType: string | null) => {
    setSelectedFilterType(filterType);
  };

  // Handle toggling visualization view
  const handleToggleVisualization = () => {
    setShowVisualization(!showVisualization);
  };
  
  // Handle updating filter quantity
  const handleUpdateFilterQuantity = (orderId: string, partNumber: string, quantity: number) => {
    // Set flag to prevent regenerating data on edit
    setDataEdited(true);
    
    // Find the original work order
    const order = filteredWorkOrders.find(o => o.id === orderId);
    if (!order) {
      console.error('Could not find original work order for update', orderId);
      return;
    }
    
    // Calculate original values to check if we're reverting to original
    const originalNeeds = FilterUtils.generateFilterNeeds([order]);
    const originalNeed = originalNeeds.find(
      n => n.orderId === orderId && n.partNumber === partNumber
    );
    const originalQuantity = originalNeed?.quantity;
    
    // Check if this edit is actually reverting to the original value
    const isRevertingToOriginal = originalQuantity !== undefined && quantity === originalQuantity;
    
    // Update the specific filter quantity
    setFilterNeeds(prevNeeds => {
      return prevNeeds.map(need => {
        if (need.orderId === orderId && need.partNumber === partNumber) {
          return {
            ...need,
            quantity,
            isEdited: !isRevertingToOriginal, // Only mark as edited if different from original
            isReverted: isRevertingToOriginal // Mark as reverted if matching original
          };
        }
        return need;
      });
    });
  };
  
  // Handle reverting filter quantity
  const handleRevertFilterQuantity = (orderId: string, partNumber: string) => {
    // Find the original work order
    const order = filteredWorkOrders.find(o => o.id === orderId);
    if (!order) {
      console.error('Could not find original work order for revert', orderId);
      return;
    }
    
    // Calculate original values directly using FilterUtils
    const originalNeeds = FilterUtils.generateFilterNeeds([order]);
    
    setFilterNeeds(prevNeeds => {
      return prevNeeds.map(need => {
        if (need.orderId === orderId && need.partNumber === partNumber) {
          // Try to find the matching original need
          const originalNeed = originalNeeds.find(
            n => n.orderId === orderId && n.partNumber === partNumber
          );
          
          // Set quantity from original need, defaulting to current if not found
          const originalQuantity = originalNeed?.quantity || need.quantity;
          
          return {
            ...need,
            quantity: originalQuantity,
            isEdited: false,
            isReverted: true
          };
        }
        return need;
      });
    });
  };
  
  // Calculate the number of calculation issues (not filter requirements)
  const calculationIssueCount = useMemo(() => {
    let count = 0;
    filterWarnings.forEach(orderWarnings => {
      // Filter out standard filter requirements
      const issues = orderWarnings.filter(w => {
        const message = (w.message || w.warning || '').toLowerCase();
        
        // Skip standard requirement messages
        if (message.includes('filter(s) required')) return false;
        if (message.includes('gas filter') && message.includes('required')) return false;
        if (message.includes('diesel filter') && message.includes('required')) return false;
        if (message.includes('def detected')) return false;
        
        // Keep true calculation issues
        return message.includes('accuracy') || 
               message.includes('uncertain') || 
               message.includes('estimate') || 
               message.includes('calculation') || 
               message.includes('unclear') || 
               message.includes('error') || 
               message.includes('unknown') ||
               message.includes('unable to determine');
      });
      
      count += issues.length;
    });
    
    return count;
  }, [filterWarnings]);

  // Handle refreshing data
  const handleRefreshData = async () => {
    // Ask user to confirm if there are edited values
    const hasEdits = filterNeeds.some(need => need.isEdited);
    if (hasEdits) {
      const confirm = window.confirm(
        'You have edited filter quantities. Refreshing data will preserve your edits but may update other information. Continue?'
      );
      if (!confirm) {
        return;
      }
    }
    
    // Don't reset edited flag to keep edits
    await reloadData();
  };

  // Panel expansion state
  const [expandedPanels, setExpandedPanels] = useState({
    visualization: true,
    summary: true,
    warnings: true,
    details: true
  });

  // Toggle panel expanded state
  const togglePanel = (panelId: string) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panelId]: !prev[panelId]
    }));
  };

  return (
    <div className="container mx-auto px-4 pt-5 pb-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FiFilter className="text-primary-500" /> Filter Management
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={handleRefreshData}
            disabled={isLoading}
            className="flex items-center px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <FiRefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <button
            onClick={handleToggleVisualization}
            className={`flex items-center px-3 py-1.5 ${showVisualization ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'} 
                       hover:bg-primary-700 rounded-md transition-colors text-sm`}
          >
            <FiBarChart2 className="mr-2" />
            {showVisualization ? 'Hide Charts' : 'Show Charts'}
          </button>
        </div>
      </div>
      
      {/* Filter Header - Styled like Schedule.tsx header */}
      <div className="mb-5 mx-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex justify-between items-center">
            <DateSelector
              currentWeek={currentWeek}
              setCurrentWeek={setCurrentWeek}
              dateRanges={dateRanges}
            />
            
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-2 flex items-center">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ml-2">
                {filteredWorkOrders.length} Jobs
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ml-2">
                {filterNeeds.length} Filters
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 ml-2">
                {calculationIssueCount} Warnings
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Loading Indicator */}
      {isLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mb-5 mx-2 flex items-center shadow-md">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-blue-700 dark:text-blue-300">
            Loading filter data... Please wait.
          </span>
        </div>
      )}
      
      {/* Information Banner */}
      {!isLoading && workOrders.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md mb-5 mx-2 flex items-center shadow-md">
          <FiInfo className="text-yellow-500 dark:text-yellow-400 mr-2" />
          <div className="flex-1">
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">
              No work orders found. 
            </span>
            <span className="text-yellow-600 dark:text-yellow-400 ml-1">
              Please check your connection and try refreshing the data.
            </span>
          </div>
          <button
            onClick={handleRefreshData}
            className="ml-4 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-md flex items-center transition-colors"
          >
            <FiRefreshCw className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}
      
      {/* Main Content */}
      <div className="space-y-5">
        {/* Visualization (conditional) */}
        {showVisualization && (
          <Panel
            id="visualization"
            title="Filter Visualization"
            icon={<FiBarChart2 className="w-5 h-5" />}
            expanded={expandedPanels.visualization}
            onToggle={togglePanel}
            count={filterNeeds.length}
          >
            <FilterVisualization 
              filterNeeds={filterNeeds}
              workOrders={filteredWorkOrders}
              isLoading={isLoading}
            />
          </Panel>
        )}
        
        {/* Filter Summary Panel */}
        <Panel
          id="summary"
          title="Filter Summary"
          icon={<FiBarChart2 className="w-5 h-5" />}
          expanded={expandedPanels.summary}
          onToggle={togglePanel}
          count={Object.keys(filterNeeds.reduce((acc, need) => {
            acc[need.partNumber || 'Unknown'] = true;
            return acc;
          }, {} as Record<string, boolean>)).length}
        >
          <FilterSummaryPanel 
            filterNeeds={filterNeeds}
            isLoading={isLoading}
            selectedFilterType={selectedFilterType}
            onFilterTypeChange={handleFilterTypeChange}
          />
        </Panel>
        
        {/* Filter Warnings Panel */}
        <Panel
          id="warnings"
          title="Filter Warnings"
          icon={<FiAlertTriangle className="w-5 h-5" />}
          expanded={expandedPanels.warnings}
          onToggle={togglePanel}
          count={calculationIssueCount}
        >
          <FilterWarningsPanel 
            filterWarnings={filterWarnings}
            isLoading={isLoading}
          />
        </Panel>
        
        {/* Filter Details Panel */}
        <Panel
          id="details"
          title="Filter Details"
          icon={<FiList className="w-5 h-5" />}
          expanded={expandedPanels.details}
          onToggle={togglePanel}
          count={filterNeeds.length}
        >
          <FilterDetailsPanel 
            filterNeeds={filterNeeds}
            workOrders={filteredWorkOrders}
            isLoading={isLoading}
            selectedFilterType={selectedFilterType}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onOpenDispenserModal={handleOpenDispenserModal}
            onUpdateFilterQuantity={handleUpdateFilterQuantity}
            onRevertFilterQuantity={handleRevertFilterQuantity}
          />
        </Panel>
      </div>
      
      {/* Dispenser Modal */}
      {hasDispenserInfo && (
        <DispenserModal
          isOpen={hasDispenserInfo}
          onClose={handleCloseDispenserModal}
          dispensers={currentDispenserData}
          orderId={selectedOrderId || ''}
          visitNumber={currentVisitId || ''}
        />
      )}
    </div>
  );
};

export default FiltersContent;
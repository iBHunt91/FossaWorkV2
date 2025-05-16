import React from 'react';
import { FiX, FiFilter } from 'react-icons/fi';
import { WorkOrder, FilterNeed as BaseFilterNeed } from '../types'; // Use WorkOrder directly from types
import { calculateFiltersForWorkOrder } from '../utils/filterCalculation'; 

// Define a more flexible Customer type for the modal
interface ModalCustomer {
  name: string;
  storeNumber?: string; // Make optional
  address?: { // Make address and its sub-properties optional
    street?: string;
    intersection?: string;
    cityState?: string;
    county?: string;
  };
}

// Define a WorkOrder type specific to this modal's needs
interface ModalWorkOrder extends Omit<WorkOrder, 'customer'> {
  customer: ModalCustomer;
}

// --- Interfaces ---
interface ExtendedFilterNeed extends Omit<BaseFilterNeed, 'stationType' | 'type'> { 
  orderId: string;
  visitId: string;
  visitDate: string;
  storeName: string;
  filterType?: string; 
  stationType: string; 
  type: string; 
  partNumber: string; 
  quantity: number; 
  stores: string[]; 
}

interface Dispenser {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: Record<string, string>;
  html?: string;
}

// --- Constants ---
const STATION_FILTERS = {
  '7-Eleven': {
    GAS: {
      'Electronic': '400MB-10',
      'HD Meter': '400MB-10',
      'Ecometer': '40510A-AD',
      'default': '400MB-10'
    },
    DIESEL: {
      'Electronic': '400HS-10',
      'HD Meter': '400HS-10',
      'Ecometer': '40510W-AD',
      'default': '400HS-10'
    },
    DEF: '800HS-30'
  },
  'Wawa': {
    GAS: '450MB-10',
    DIESEL: '450MG-10'
  },
  'Circle K': {
    GAS: '40510D-AD',
    DIESEL: '40530W-AD'
  }
};

// --- Helper Functions (should accept WorkOrder from ../types) ---
const parseSpecificDispenserInstructions = (instructions: string): number[] => {
  if (!instructions) return [];
  const dispenserNumbers: number[] = [];
  const pairedPattern = /#(\d+)[\/-](\d+)/g;
  const pairedMatches = [...instructions.matchAll(pairedPattern)];
  pairedMatches.forEach(match => {
    if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
    if (match[2]) dispenserNumbers.push(parseInt(match[2], 10));
  });
  const regularPattern = /(?:(?:[Dd]ispenserss?|[Dd]isp)(?:\s*:)?\s*(?:#?\s*\d+(?:\s*,\s*#?\s*\d+)*)|(?:#\s*\d+(?:\s*,\s*#?\s*\d+)*))/g;
  const regularMatches = instructions.match(regularPattern);
  if (regularMatches) {
    regularMatches.forEach(match => {
      const numberMatches = match.match(/\d+/g);
      if (numberMatches) {
        numberMatches.forEach(num => {
          dispenserNumbers.push(parseInt(num, 10));
        });
      }
    });
  }
  const individualPattern = /#(\d+)(?![\/\-\d])/g;
  const individualMatches = [...instructions.matchAll(individualPattern)];
  individualMatches.forEach(match => {
    if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
  });
  return [...new Set(dispenserNumbers)];
};

const shouldIncludeDispenser = (dispenserTitle: string | undefined, specificDispenserNumbers: number[]): boolean => {
  if (!dispenserTitle || !specificDispenserNumbers.length) return true;
  const titleMatch = dispenserTitle.match(/^(\d+)[\/-](\d+)/);
  if (titleMatch && titleMatch[1] && titleMatch[2]) {
    const dispenser1 = parseInt(titleMatch[1]);
    const dispenser2 = parseInt(titleMatch[2]);
    return specificDispenserNumbers.includes(dispenser1) || specificDispenserNumbers.includes(dispenser2);
  }
  
  // Check for single dispenser number in title
  const singleMatch = dispenserTitle.match(/^#?(\d+)/);
  if (singleMatch && singleMatch[1]) {
    const dispenserNum = parseInt(singleMatch[1]);
    return specificDispenserNumbers.includes(dispenserNum);
  }
  
  return false;
};

const getMeterType = (order: WorkOrder): string => {
  const instructions = order.instructions?.toLowerCase() || '';
  if (instructions.includes('electronic meter') || instructions.includes('electronics')) return 'Electronic';
  if (instructions.includes('hd meter')) return 'HD Meter';
  if (instructions.includes('ecometer')) return 'Ecometer';
  const services = order.services || [];
  for (const service of services) {
    const description = service.description?.toLowerCase() || '';
    if (description.includes('electronic meter')) return 'Electronic';
    if (description.includes('hd meter')) return 'HD Meter';
    if (description.includes('ecometer')) return 'Ecometer';
  }
  return 'default';
};

const checkForSpecialFuelTypes = (order: WorkOrder): { hasDEF: boolean; hasDieselHighFlow: boolean; isSpecificDispensersJob: boolean } => {
  const result = { hasDEF: false, hasDieselHighFlow: false, isSpecificDispensersJob: false };
  const instructions = order.instructions?.toLowerCase() || '';
  const serviceFuel = order.services?.some(service =>
    (service.description?.toLowerCase() || '').includes('def') ||
    (service.description?.toLowerCase() || '').includes('diesel exhaust fluid')
  ) || false;
  result.isSpecificDispensersJob = order.services?.some(
    service => service.code === "2862" || (service.description && service.description.includes("Specific Dispenser"))
  ) || false;
  if (instructions.includes('def') || serviceFuel || instructions.includes('diesel exhaust fluid')) {
    result.hasDEF = true;
  }
  if (instructions.includes('high flow diesel') || instructions.includes('diesel high flow') ||
    order.services?.some(service =>
      (service.description?.toLowerCase() || '').includes('high flow diesel') ||
      (service.description?.toLowerCase() || '').includes('diesel high flow')
    )) {
    result.hasDieselHighFlow = true;
  }
  if (order.dispensers && order.dispensers.length > 0) {
    (order.dispensers as Dispenser[]).forEach((dispenser) => {
      const dispenserTitle = dispenser.title?.toLowerCase() || '';
      const dispenserFields = dispenser.fields || {};
      if (dispenserTitle.includes('def') || dispenserTitle.includes('diesel exhaust fluid')) {
        result.hasDEF = true;
      }
      Object.entries(dispenserFields).forEach(([key, value]) => {
        const fieldKey = key.toLowerCase();
        const fieldValue = (value as string)?.toLowerCase() || '';
        if (fieldValue.includes('def') || fieldValue.includes('diesel exhaust fluid')) {
          result.hasDEF = true;
        }
        if (fieldValue.includes('high flow') && (fieldValue.includes('diesel') || fieldKey.includes('diesel'))) {
          result.hasDieselHighFlow = true;
        }
      });
    });
  }
  return result;
};

const getCalculatedQuantity = (defaultQuantity: number): number => {
  return defaultQuantity;
};

// --- Main Modal Component ---
interface StoreFilterNeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null; // Use WorkOrder from ../types
  isDarkMode?: boolean; 
}

const StoreFilterNeedsModal: React.FC<StoreFilterNeedsModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  isDarkMode = false,
}) => {
  if (!isOpen || !workOrder) {
    return null;
  }

  // Calculate filter needs
  const [calculationResult, setCalculationResult] = React.useState<{
    needs: ExtendedFilterNeed[],
    verificationWarnings: string[]
  }>({ needs: [], verificationWarnings: [] });

  // Effect to calculate filter needs when the work order changes
  React.useEffect(() => {
    if (workOrder) {
      const newNeeds: ExtendedFilterNeed[] = [];
      const newVerificationWarnings: string[] = [];
      if (!workOrder || !workOrder.customer || !workOrder.customer.name) {
        setCalculationResult({ needs: newNeeds, verificationWarnings: newVerificationWarnings });
        return;
      }

      // ---- STEP 1: DETERMINE IF THIS IS A SPECIFIC DISPENSER JOB ----
      const isSpecificDispensersJob = workOrder.services?.some(
        service => service.code === "2862" || 
                   (service.description && service.description.includes("Specific Dispenser"))
      ) || false;
      
      // ---- STEP 2: GET DISPENSER NUMBERS IF IT'S A SPECIFIC JOB ----
      let specificDispenserNumbers: number[] = [];
      if (isSpecificDispensersJob && workOrder.instructions) {
        specificDispenserNumbers = parseSpecificDispenserInstructions(workOrder.instructions);
      }
      
      // ---- STEP 3: CREATE THE CALCULATION ORDER ----
      let calculationOrder = workOrder;
      const hasDispenserData = !!(workOrder.dispensers && workOrder.dispensers.length > 0);
      
      // For specific dispenser jobs, filter dispensers if we have dispenser numbers
      if (isSpecificDispensersJob && specificDispenserNumbers.length > 0 && hasDispenserData) {
        const specificDispensers = (workOrder.dispensers as Dispenser[]).filter(
          dispenser => shouldIncludeDispenser(dispenser.title, specificDispenserNumbers)
        );
        
        // Only use specific dispensers if we found matches
        if (specificDispensers.length > 0) {
          calculationOrder = { ...workOrder, dispensers: specificDispensers as any[] };
        }
      }
      
      // ---- STEP 4: CALCULATE FILTERS ----
      const { gasFilters, dieselFilters, warnings } = calculateFiltersForWorkOrder(calculationOrder);
      
      // ---- STEP 5: DETERMINE VERIFICATION NEEDS USING FILTERS.TSX LOGIC ----
      // In Filters.tsx, ordersNeedingVerification is determined by:
      //   - If any warning contains "verify" in its text
      //   - For specific dispenser jobs only when dispenser numbers can't be determined
      
      if (isSpecificDispensersJob && specificDispenserNumbers.length === 0) {
        newVerificationWarnings.push("Specific dispenser job - requires verification of which dispensers to service.");
      }
      
      // Only add warnings that contain the word "verify" - this exactly matches Filters.tsx
      warnings.forEach(warning => {
        const warningText = warning.warning.toLowerCase();
        if (warningText.includes('verify')) {
          newVerificationWarnings.push(warning.warning);
        }
      });
      
      // ---- STEP 6: DETERMINE FILTER PART NUMBERS ----
      let stationType = 'other';
      let gasFilterPart = '';
      let dieselFilterPart = '';
      let defFilterPart = '';
      
      const storeName = workOrder.customer.name.toLowerCase();
      
      if (storeName.includes('7-eleven') || storeName.includes('7 eleven') || storeName.includes('speedway')) {
        stationType = '7-Eleven';
        const meterType = getMeterType(workOrder);
        // Use type assertions to fix indexing
        const meterTypeKey = (STATION_FILTERS['7-Eleven'].GAS.hasOwnProperty(meterType) ? 
          meterType : 'default') as keyof typeof STATION_FILTERS['7-Eleven']['GAS'];
        
        gasFilterPart = STATION_FILTERS['7-Eleven'].GAS[meterTypeKey];
        dieselFilterPart = STATION_FILTERS['7-Eleven'].DIESEL[meterTypeKey];
        defFilterPart = STATION_FILTERS['7-Eleven'].DEF;
      } else if (storeName.includes('wawa')) {
        stationType = 'Wawa';
        gasFilterPart = STATION_FILTERS['Wawa'].GAS;
        dieselFilterPart = STATION_FILTERS['Wawa'].DIESEL;
      } else { // Circle K
        stationType = 'Circle K';
        gasFilterPart = STATION_FILTERS['Circle K'].GAS;
        dieselFilterPart = STATION_FILTERS['Circle K'].DIESEL;
      }

      // ---- STEP 7: CREATE FILTER NEEDS ----
      // Gas filters
      if (gasFilters > 0 && gasFilterPart) {
        newNeeds.push({
          partNumber: gasFilterPart,
          type: 'GAS',
          quantity: getCalculatedQuantity(gasFilters),
          stores: [workOrder.customer.name],
          stationType,
          orderId: workOrder.id,
          visitId: Object.values(workOrder.visits || {})[0]?.visitId || 'N/A',
          visitDate: Object.values(workOrder.visits || {})[0]?.date || 'N/A',
          storeName: workOrder.customer.name,
          filterType: 'Gas'
        } as ExtendedFilterNeed);
      }

      // Diesel filters
      if (dieselFilters > 0 && dieselFilterPart) {
        newNeeds.push({
          partNumber: dieselFilterPart,
          type: 'DIESEL',
          quantity: getCalculatedQuantity(dieselFilters),
          stores: [workOrder.customer.name],
          stationType,
          orderId: workOrder.id,
          visitId: Object.values(workOrder.visits || {})[0]?.visitId || 'N/A',
          visitDate: Object.values(workOrder.visits || {})[0]?.date || 'N/A',
          storeName: workOrder.customer.name,
          filterType: 'Diesel'
        } as ExtendedFilterNeed);
      }

      // DEF filters - only add if we have clear DEF indicators
      const { hasDEF } = checkForSpecialFuelTypes(calculationOrder);
      const hasDefService = workOrder.services?.some(service => 
        (service.description?.toLowerCase() || '').includes("def") ||
        (service.description?.toLowerCase() || '').includes("diesel exhaust fluid")
      );
      
      if (hasDEF && hasDefService && defFilterPart) {
        newNeeds.push({
          partNumber: defFilterPart,
          type: 'DIESEL',
          quantity: 1,
          stores: [workOrder.customer.name],
          stationType,
          orderId: workOrder.id,
          visitId: Object.values(workOrder.visits || {})[0]?.visitId || 'N/A',
          visitDate: Object.values(workOrder.visits || {})[0]?.date || 'N/A',
          storeName: workOrder.customer.name,
          filterType: 'DEF'
        } as ExtendedFilterNeed);
      }
      
      // If no specific needs, add a placeholder
      if (newNeeds.length === 0) {
        newNeeds.push({
          partNumber: 'N/A',
          type: 'INFO', 
          quantity: 0,
          stores: [workOrder.customer.name],
          stationType,
          orderId: workOrder.id,
          visitId: Object.values(workOrder.visits || {})[0]?.visitId || 'N/A',
          visitDate: Object.values(workOrder.visits || {})[0]?.date || 'N/A',
          storeName: workOrder.customer.name,
          filterType: 'No specific filters calculated'
        } as ExtendedFilterNeed);
      }
      
      setCalculationResult({ needs: newNeeds, verificationWarnings: newVerificationWarnings });
    }
  }, [workOrder]); // Recalculate when workOrder changes

  const { needs: filterNeeds, verificationWarnings } = calculationResult;
  const hasIdentifiedDispensers = React.useMemo(() => {
    return workOrder && workOrder.services?.some(service => 
      service.code === "2862" || (service.description && service.description.includes("Specific Dispenser"))
    ) && workOrder.instructions && parseSpecificDispenserInstructions(workOrder.instructions).length > 0;
  }, [workOrder]);
  
  const identifiedDispenserNumbers = React.useMemo(() => {
    if (!workOrder || !workOrder.instructions) return [];
    return parseSpecificDispenserInstructions(workOrder.instructions);
  }, [workOrder]);
  
  const calibrationInfo = React.useMemo(() => {
    if (!workOrder || !workOrder.services) return null;
    
    const calibrationService = workOrder.services.find(s => 
      s.type === "Meter Calibration" || 
      (s.description && s.description.toLowerCase().includes("calibration"))
    );
    
    if (!calibrationService) return null;
    
    return {
      quantity: calibrationService.quantity || 0,
      description: calibrationService.description || "Meter Calibration"
    };
  }, [workOrder]);

  // CSS classes for dark/light mode consistency
  const modalBgClass = isDarkMode ? 'dark bg-gray-800 text-gray-200' : 'bg-white text-gray-900';
  const buttonClass = isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200';
  const listItemBgClass = isDarkMode ? 'bg-gray-700' : 'bg-gray-100';
  const listItemBorderClass = isDarkMode ? 'border-gray-600' : 'border-gray-200';
  const closeButtonClass = isDarkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800';
  const gasTypeClass = isDarkMode ? 'bg-blue-700 text-blue-200' : 'bg-blue-100 text-blue-800';
  const defTypeClass = isDarkMode ? 'bg-purple-700 text-purple-200' : 'bg-purple-100 text-purple-800';
  const dieselTypeClass = isDarkMode ? 'bg-amber-700 text-amber-200' : 'bg-amber-100 text-amber-800';
  const infoTypeClass = isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700';
  const warningTextClass = isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
  const warningBgClass = isDarkMode ? 'bg-yellow-700/30' : 'bg-yellow-100/70';

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={(e) => {
        // Close if the click is on the backdrop itself
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`${modalBgClass} rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside the modal from closing it
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center">
            <FiFilter className="mr-2 text-primary-500" />
            Filter Needs for {workOrder.customer?.name || 'Selected Job'}
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-full ${buttonClass} transition-colors`}
            aria-label="Close modal"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Combined Visit ID and Store # Line */}
        <div className="text-sm mb-3 flex items-center justify-between">
          <span className="flex items-center">
            <strong className="mr-1">Visit ID:</strong> 
            {Object.values(workOrder.visits || {})[0]?.visitId || 'N/A'}
          </span>
          <span className={`mx-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>|</span>
          <span className="flex items-center">
            <strong className="mr-1">Store #:</strong> 
            {workOrder.customer?.storeNumber?.replace(/^#+/, '') || 'N/A'}
          </span>
        </div>

        {/* Verification Warnings Section */}
        {verificationWarnings.length > 0 && (
          <div className={`p-3 mb-4 rounded-md border ${warningBgClass} ${isDarkMode ? 'border-yellow-600' : 'border-yellow-400'}`}>
            <h4 className={`font-semibold ${warningTextClass} mb-1`}>Verification May Be Needed:</h4>
            <ul className="list-disc list-inside text-xs">
              {verificationWarnings.map((warning, idx) => (
                <li key={idx} className={warningTextClass}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {filterNeeds.length > 0 ? (
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {filterNeeds.map((need, index) => (
              <li 
                key={index} 
                className={`p-3 rounded-md ${listItemBgClass} border ${listItemBorderClass}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{need.partNumber}</span>
                  <span 
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      need.type === 'GAS' ? gasTypeClass :
                      need.type === 'DIESEL' && need.filterType === 'DEF' ? defTypeClass :
                      need.type === 'DIESEL' ? dieselTypeClass :
                      infoTypeClass // For 'INFO' or other types
                    }`}
                  >
                    {need.filterType || need.type}
                  </span>
                </div>
                <div className="text-sm mt-1">
                  Quantity: <span className="font-semibold">{need.quantity}</span>
                </div>
                {need.partNumber === 'N/A' && (
                    <p className="text-xs italic mt-1">{need.filterType}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <FiFilter className="mx-auto h-12 w-12 mb-3 opacity-40" />
            <p>No filter needs calculated.</p>
            <p className="text-sm mt-1">Visit job site for direct assessment.</p>
          </div>
        )}
        
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-md ${closeButtonClass} transition-colors text-sm font-medium`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreFilterNeedsModal; 
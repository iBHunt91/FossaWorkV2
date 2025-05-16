import React from 'react';
import { FiX, FiFilter } from 'react-icons/fi';
import { WorkOrder, FilterNeed } from '../types'; // Assuming FilterNeed is a relevant type
import { calculateFiltersForWorkOrder, FilterWarning } from '../utils/filterCalculation'; // Assuming this path
import { GiGasPump } from 'react-icons/gi'; // Or other relevant icons

// --- Interfaces (can be moved to types.ts if used elsewhere) ---
interface ExtendedFilterNeed extends FilterNeed {
  orderId: string;
  visitId: string;
  visitDate: string;
  storeName: string;
  filterType?: string; // e.g., GAS, DIESEL, DEF, Unknown
  stationType: string; // e.g., 7-Eleven, Wawa, Circle K
}

// Minimal Dispenser interface for what's needed in calculation, based on Filters.tsx
interface Dispenser {
  title: string;
  serial?: string;
  make?: string;
  model?: string;
  fields?: Record<string, string>;
  html?: string;
}


// --- Constants (Consider moving to a shared utils/constants.ts) ---
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

// --- Helper Functions (Adapted from Filters.tsx - Consider moving to shared utils) ---

const parseSpecificDispenserInstructions = (instructions: string): number[] => {
  if (!instructions) return [];
  const dispenserNumbers: number[] = [];
  const pairedPattern = /#(\\d+)[\\/-](\\d+)/g;
  const pairedMatches = [...instructions.matchAll(pairedPattern)];
  pairedMatches.forEach(match => {
    if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
    if (match[2]) dispenserNumbers.push(parseInt(match[2], 10));
  });
  const regularPattern = /(?:(?:[Dd]ispenserss?|[Dd]isp)(?:\\s*:)?\\s*(?:#?\\s*\\d+(?:\\s*,\\s*#?\\s*\\d+)*)|(?:#\\s*\\d+(?:\\s*,\\s*#?\\s*\\d+)*))/g;
  const regularMatches = instructions.match(regularPattern);
  if (regularMatches) {
    regularMatches.forEach(match => {
      const numberMatches = match.match(/\\d+/g);
      if (numberMatches) {
        numberMatches.forEach(num => {
          dispenserNumbers.push(parseInt(num, 10));
        });
      }
    });
  }
  const individualPattern = /#(\\d+)(?![\\/\\-\\d])/g;
  const individualMatches = [...instructions.matchAll(individualPattern)];
  individualMatches.forEach(match => {
    if (match[1]) dispenserNumbers.push(parseInt(match[1], 10));
  });
  return [...new Set(dispenserNumbers)];
};

const shouldIncludeDispenser = (dispenserTitle: string | undefined, specificDispenserNumbers: number[]): boolean => {
  if (!dispenserTitle || !specificDispenserNumbers.length) return true;
  const titleMatch = dispenserTitle.match(/^(\\d+)[\\/-](\\d+)/);
  if (titleMatch && titleMatch[1] && titleMatch[2]) {
    const dispenser1 = parseInt(titleMatch[1]);
    const dispenser2 = parseInt(titleMatch[2]);
    return specificDispenserNumbers.includes(dispenser1) || specificDispenserNumbers.includes(dispenser2);
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
  return 'Unknown'; // Or 'default' to match STATION_FILTERS keys
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

// Simplified getEditedQuantity for modal - no editing, just returns calculated qty
// In a real scenario, this might connect to a shared context or prop for consistency if edits were global
const getCalculatedQuantity = (defaultQuantity: number): number => {
  return defaultQuantity;
};


// --- Main Modal Component ---
interface StoreFilterNeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
  isDarkMode?: boolean; // Optional: for styling consistency
}

const StoreFilterNeedsModal: React.FC<StoreFilterNeedsModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  isDarkMode = false, // Default to false
}) => {
  if (!isOpen || !workOrder) {
    return null;
  }

  const calculateNeedsForOrder = (order: WorkOrder): ExtendedFilterNeed[] => {
    const needs: ExtendedFilterNeed[] = [];
    if (!order) return needs;

    const isSpecificDispensersJob = order.services?.some(
      service => service.code === "2862" || (service.description && service.description.includes("Specific Dispenser"))
    );
    let specificDispenserNumbers: number[] = [];
    if (isSpecificDispensersJob && order.instructions) {
      specificDispenserNumbers = parseSpecificDispenserInstructions(order.instructions);
    }

    let calculationOrder = order;
    if (isSpecificDispensersJob && specificDispenserNumbers.length > 0 && order.dispensers && order.dispensers.length > 0) {
      const specificDispensers = (order.dispensers as Dispenser[]).filter(
        dispenser => shouldIncludeDispenser(dispenser.title, specificDispenserNumbers)
      );
      calculationOrder = { ...order, dispensers: specificDispensers };
    }

    const { gasFilters, dieselFilters } = calculateFiltersForWorkOrder(calculationOrder);

    const stationType = order.customer.name.includes('7-Eleven') ||
                       (order.rawHtml && (order.rawHtml.includes('Speedway') || order.rawHtml.includes('Marathon'))) ?
                       '7-Eleven' :
                       order.customer.name.includes('Wawa') ? 'Wawa' : 'Circle K';

    let gasFilterPart: string | undefined;
    let dieselFilterPart: string | undefined;

    if (stationType === '7-Eleven') {
      const meterType = getMeterType(order);
      const meterTypeKey = meterType.includes('HD') ? 'HD Meter' :
                           meterType.includes('Eco') ? 'Ecometer' : 
                           (STATION_FILTERS['7-Eleven'].GAS.hasOwnProperty(meterType) ? meterType : 'default');
      gasFilterPart = STATION_FILTERS['7-Eleven'].GAS[meterTypeKey as keyof typeof STATION_FILTERS['7-Eleven']['GAS']] || STATION_FILTERS['7-Eleven'].GAS.default;
      dieselFilterPart = STATION_FILTERS['7-Eleven'].DIESEL[meterTypeKey as keyof typeof STATION_FILTERS['7-Eleven']['DIESEL']] || STATION_FILTERS['7-Eleven'].DIESEL.default;
      
      const { hasDEF } = checkForSpecialFuelTypes(order);
      if (hasDEF) {
        const defQuantity = getCalculatedQuantity(1); // Typically 1
        needs.push({
          partNumber: STATION_FILTERS['7-Eleven'].DEF,
          type: 'DIESEL', // Classified as DIESEL for grouping
          quantity: defQuantity,
          stores: [order.customer.name],
          stationType,
          orderId: order.id,
          visitId: Object.values(order.visits || {})[0]?.visitId || 'N/A',
          visitDate: Object.values(order.visits || {})[0]?.date || 'N/A',
          storeName: order.customer.name,
          filterType: 'DEF'
        });
      }
    } else if (stationType === 'Wawa') {
      gasFilterPart = STATION_FILTERS['Wawa'].GAS;
      dieselFilterPart = STATION_FILTERS['Wawa'].DIESEL;
    } else { // Circle K
      gasFilterPart = STATION_FILTERS['Circle K'].GAS;
      dieselFilterPart = STATION_FILTERS['Circle K'].DIESEL;
    }

    if (gasFilters > 0 && gasFilterPart) {
      needs.push({
        partNumber: gasFilterPart,
        type: 'GAS',
        quantity: getCalculatedQuantity(gasFilters),
        stores: [order.customer.name],
        stationType,
        orderId: order.id,
        visitId: Object.values(order.visits || {})[0]?.visitId || 'N/A',
        visitDate: Object.values(order.visits || {})[0]?.date || 'N/A',
        storeName: order.customer.name,
        filterType: 'Gas'
      });
    }

    if (dieselFilters > 0 && dieselFilterPart) {
      needs.push({
        partNumber: dieselFilterPart,
        type: 'DIESEL',
        quantity: getCalculatedQuantity(dieselFilters),
        stores: [order.customer.name],
        stationType,
        orderId: order.id,
        visitId: Object.values(order.visits || {})[0]?.visitId || 'N/A',
        visitDate: Object.values(order.visits || {})[0]?.date || 'N/A',
        storeName: order.customer.name,
        filterType: 'Diesel'
      });
    }
    
    // Placeholder if no filters calculated but job exists (simplified for modal)
    if (needs.length === 0) {
        needs.push({
            partNumber: 'N/A',
            type: 'UNKNOWN',
            quantity: 0,
            stores: [order.customer.name],
            stationType,
            orderId: order.id,
            visitId: Object.values(order.visits || {})[0]?.visitId || 'N/A',
            visitDate: Object.values(order.visits || {})[0]?.date || 'N/A',
            storeName: order.customer.name,
            filterType: 'No specific filters calculated'
        });
    }

    return needs;
  };

  const filterNeeds = calculateNeedsForOrder(workOrder);

  return (
    <div className={\`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-300 \${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}\`}>
      <div className={\`\${isDarkMode ? 'dark bg-gray-800 text-gray-200' : 'bg-white text-gray-900'} rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all duration-300 \${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}\`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center">
            <FiFilter className="mr-2 text-primary-500" />
            Filter Needs for {workOrder.customer.name}
          </h3>
          <button
            onClick={onClose}
            className={\`p-1 rounded-full \${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'} transition-colors\`}
            aria-label="Close modal"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <div className="text-sm mb-2">
          <p><strong>Visit ID:</strong> {Object.values(workOrder.visits || {})[0]?.visitId || 'N/A'}</p>
          <p><strong>Order ID:</strong> {workOrder.id}</p>
        </div>

        {filterNeeds.length > 0 ? (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {filterNeeds.map((need, index) => (
              <li 
                key={index} 
                className={\`p-3 rounded-md \${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} border \${isDarkMode ? 'border-gray-600' : 'border-gray-200'}\`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{need.partNumber}</span>
                  <span 
                    className={\`px-2 py-0.5 text-xs font-semibold rounded-full \${
                      need.type === 'GAS' ? (isDarkMode ? 'bg-blue-700 text-blue-200' : 'bg-blue-100 text-blue-800') :
                      need.type === 'DIESEL' && need.filterType === 'DEF' ? (isDarkMode ? 'bg-purple-700 text-purple-200' : 'bg-purple-100 text-purple-800') :
                      need.type === 'DIESEL' ? (isDarkMode ? 'bg-amber-700 text-amber-200' : 'bg-amber-100 text-amber-800') :
                      (isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700')
                    }\`}
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
          <p className={\`text-center py-4 \${isDarkMode ? 'text-gray-400' : 'text-gray-500'}\`}>
            No specific filter needs calculated for this job.
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className={\`px-4 py-2 rounded-md text-sm font-medium \${isDarkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} transition-colors\`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreFilterNeedsModal; 
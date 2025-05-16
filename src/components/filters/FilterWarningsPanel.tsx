import React, { useMemo } from 'react';
import { FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import { ExtendedFilterWarning } from './FilterTypes';
import FilterUtils from './FilterUtils';

interface FilterWarningsPanelProps {
  filterWarnings: Map<string, ExtendedFilterWarning[]>;
  isLoading: boolean;
}

/**
 * Component for displaying filter warnings
 * Shows warnings without severity levels
 * Updated styling to match Schedule.tsx design patterns
 */
const FilterWarningsPanel: React.FC<FilterWarningsPanelProps> = ({ 
  filterWarnings, 
  isLoading 
}) => {
  // State for info box toggle
  const [infoBoxExpanded, setInfoBoxExpanded] = React.useState(false);
  
  // Flatten the warnings into a single array and add detailed info
  const allWarnings = useMemo(() => {
    const warnings: ExtendedFilterWarning[] = [];
    filterWarnings.forEach(orderWarnings => {
      warnings.push(...orderWarnings);
    });
    
    // Filter warnings to only include actual issues, not standard filter counts
    return warnings.filter(w => {
      const message = (w.message || w.warning || '').toLowerCase();
      
      // Filter out standard filter requirement messages
      if (message.includes('filter(s) required')) return false;
      if (message.includes('gas filter') && message.includes('required')) return false;
      if (message.includes('diesel filter') && message.includes('required')) return false;
      
      // Filter out DEF detection messages as they're shown elsewhere
      if (message.includes('def detected')) return false;
      
      // Only keep warnings related to calculation accuracy or uncertainty
      return message.includes('accuracy') || 
             message.includes('uncertain') || 
             message.includes('estimate') || 
             message.includes('calculation') || 
             message.includes('unclear') || 
             message.includes('error') || 
             message.includes('unknown') ||
             message.includes('unable to determine') ||
             message.includes('unknown fuel grade');
    }).map(warning => {
      // Enhance warning messages with more detail
      if ((warning.message || warning.warning || '').toLowerCase().includes('unknown fuel grade')) {
        const grades = warning.grades || [];
        const gradeList = grades.length > 0 ? 
          `Unknown grades: ${grades.join(', ')}` : 
          'Unknown fuel grade detected';
        
        warning.message = gradeList; // Keep this simple as we'll format it in the UI
      }
      
      return warning;
    });
  }, [filterWarnings]);

  // Simplify warnings by store
  const warningsByStore = useMemo(() => {
    const byStore: Record<string, {
      storeName: string,
      visitId: string,
      warnings: string[],
      orderId: string,
      date: string
    }> = {};
    
    allWarnings.forEach(warning => {
      const storeKey = `${warning.storeName}_${warning.orderId}`;
      const visitId = FilterUtils.extractVisitNumber(warning.orderId || '');
      
      if (!byStore[storeKey]) {
        byStore[storeKey] = {
          storeName: warning.storeName || 'Unknown Store',
          visitId: visitId,
          warnings: [],
          orderId: warning.orderId || '',
          date: warning.visitDate || new Date().toISOString().split('T')[0]
        };
      }
      
      const warningMessage = warning.message || warning.warning || '';
      if (warningMessage && !byStore[storeKey].warnings.includes(warningMessage)) {
        byStore[storeKey].warnings.push(warningMessage);
      }
    });
    
    return Object.values(byStore);
  }, [allWarnings]);

  // Total warning count
  const totalWarnings = useMemo(() => {
    return allWarnings.length;
  }, [allWarnings]);

  return (
    <div>
      {/* Warning Info - Updated with Schedule.tsx styling */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 m-3 rounded-md shadow-sm">
        <div 
          className="flex items-start cursor-pointer"
          onClick={() => setInfoBoxExpanded(!infoBoxExpanded)}
        >
          <FiInfo className="text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex-grow">Calculation Accuracy Information</p>
          <FiAlertTriangle 
            className={`text-blue-500 transform transition-transform ${infoBoxExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
        
        {infoBoxExpanded && (
          <div className="ml-6 mt-2">
            <ul className="text-xs text-blue-600 dark:text-blue-400 list-disc list-inside space-y-1">
              <li>This section shows only critical calculation issues, not standard filter requirements</li>
              <li>Warnings indicate potential problems with determining filter needs accurately</li>
              <li>Review these issues when our system detects uncertainty in calculations</li>
            </ul>
          </div>
        )}
      </div>
      
      {/* Warning Count - Styled like Schedule.tsx stats counter */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
          <FiAlertTriangle className="mr-2 text-yellow-500" />
          Calculation Issues
        </h4>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
          {warningsByStore.length} Issue{warningsByStore.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Warning Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : totalWarnings === 0 ? (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          <FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />
          No calculation accuracy issues detected. All filter calculations appear reliable.
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto px-2 py-3">
          <div className="space-y-3">
            {warningsByStore.map((storeData, index) => (
              <div 
                key={`${storeData.storeName}-${storeData.visitId}-${index}`}
                className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center mb-2">
                  <FiAlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 mr-2" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {storeData.storeName}
                  </p>
                </div>
                <div className="flex ml-6 mb-2">
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Visit #{storeData.visitId}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-auto">
                    {new Date(storeData.date).toLocaleDateString()}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5 pl-3 text-sm text-gray-700 dark:text-gray-300 border-l-2 border-amber-500 dark:border-amber-400">
                  {storeData.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-amber-400 dark:bg-amber-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                      <div className="text-xs">
                        {warning.includes('Unknown grades:') ? (
                          <>
                            <span className="font-medium">Unknown grades:</span> {warning.split('Unknown grades:')[1].split('-')[0].trim()}
                            <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                              This may affect filter calculations
                            </div>
                          </>
                        ) : (
                          warning
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  <FiInfo className="w-3.5 h-3.5 mr-1 text-gray-400" />
                  Please verify filter requirements manually for this visit.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterWarningsPanel;